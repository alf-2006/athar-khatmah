import crypto from 'node:crypto';

export const MEMORIAL_SLUG = 'athar';
export const PARTS = 30;
export const MAX_ROUNDS = 100;
export const KINDS = ['deceased_m', 'deceased_f', 'deceased_p', 'general'];

const SLUG_RE = /^[a-z0-9-]{3,32}$/;
const HASH_RE = /^[a-f0-9]{64}$/;
const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const RESERVED_SLUGS = new Set(['new', 'api', 'admin', 'athar', 'assets', 'k']);

export const isSlug = (v) => typeof v === 'string' && SLUG_RE.test(v);
export const isHash = (v) => typeof v === 'string' && HASH_RE.test(v);

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

export function newSlug() {
  for (let i = 0; i < 20; i += 1) {
    const bytes = crypto.randomBytes(7);
    let out = '';
    for (const b of bytes) out += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
    if (!RESERVED_SLUGS.has(out)) return out;
  }
  return crypto.randomBytes(6).toString('hex');
}

export function newOwnerToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export function clientIpHash(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim();
  const ip = first || req.socket?.remoteAddress || 'unknown';
  return sha256(`athar-ip:${ip}`).slice(0, 32);
}

/** نص عادي: يزيل محارف التحكم والاتجاه ويضغط المسافات ويقصّ للطول. */
export function cleanText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeDigits(text) {
  return text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

/** يرفض الروابط وأرقام الهواتف في الأسماء والرسائل (تحمي المنصة من الإعلانات). */
export function looksLikeContact(text) {
  const t = normalizeDigits(String(text ?? '')).toLowerCase();
  if (/(https?:|www\.|[\w.-]+@[\w-]+|\b(t\.me|wa\.me|bit\.ly)\b|\.(com|net|org|io|me|co|app|ly|info|xyz|tk|ru|cn)\b)/i.test(t)) {
    return true;
  }
  return /(\d[\s\-.()+]*){8,}/.test(t);
}

export function send(res, status, body) {
  return res.status(status).json(body);
}

const KNOWN_DB_ERRORS = {
  PART_TAKEN: 409,
  GROUP_FULL: 409,
  GROUP_CLOSED: 409,
  LIMIT_REACHED: 409,
  GROUP_NOT_FOUND: 404,
  INVALID_PART: 400,
  INVALID_NAME: 400,
  INVALID_TOKEN: 400,
  INVALID_ROUND: 400,
};

/** يحوّل استثناءات دوال SQL المعروفة إلى {status, error}؛ null إن لم تكن معروفة. */
export function knownDbError(error) {
  const message = String(error?.message ?? '');
  for (const [code, status] of Object.entries(KNOWN_DB_ERRORS)) {
    if (message.includes(code)) return { status, error: code };
  }
  if (error?.code === '23505') return { status: 409, error: 'PART_TAKEN' };
  return null;
}

export async function findGroup(pool, slug) {
  const { rows } = await pool.query(
    `select id, slug, title, kind, message, rounds, closed, created_at
       from public.groups where slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

/** ملخص الأجزاء: المحجوز/المكتمل لكل ختمة + الإجمالي. */
export async function groupSummary(pool, group) {
  const { rows } = await pool.query(
    `select round_no,
            count(*)::int as taken,
            (count(*) filter (where completed))::int as completed
       from public.bookings
      where group_id = $1
      group by round_no
      order by round_no`,
    [group.id]
  );
  const totalParts = group.rounds * PARTS;
  const taken = rows.reduce((n, r) => n + r.taken, 0);
  const completed = rows.reduce((n, r) => n + r.completed, 0);
  const byRound = new Map(rows.map((r) => [r.round_no, r]));
  let currentRound = group.rounds;
  for (let r = 1; r <= group.rounds; r += 1) {
    if ((byRound.get(r)?.taken ?? 0) < PARTS) {
      currentRound = r;
      break;
    }
  }
  const completedRounds = rows.filter((r) => r.round_no <= group.rounds && r.completed >= PARTS).length;
  return {
    rounds: rows,
    total_parts: totalParts,
    taken,
    completed,
    open: Math.max(0, totalParts - taken),
    completed_rounds: completedRounds,
    current_round: currentRound,
  };
}
