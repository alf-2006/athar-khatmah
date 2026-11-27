export const configured = import.meta.env.VITE_API_ENABLED !== 'false';
export const MEMORIAL_SLUG = 'athar';

/* ---------- تخزين محلي آمن (يعمل حتى لو التخزين معطّل) ---------- */
const memory = new Map();

function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

function lsDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    memory.delete(key);
  }
}

export const store = { get: lsGet, set: lsSet, del: lsDel };

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomToken() {
  return crypto.randomUUID() + crypto.randomUUID();
}

/* ---------- معرّف الجهاز: يُستخدم لسقف الحجوزات ولعدّ قائمة الانتظار مرة واحدة ---------- */
export async function getDeviceHash() {
  let id = lsGet('athar-device');
  if (!id) {
    id = randomToken();
    lsSet('athar-device', id);
  }
  return sha256(`device:${id}`);
}

/* ---------- حجوزاتي على هذا الجهاز ---------- */
const bookingsKey = (slug) => (slug === MEMORIAL_SLUG ? 'athar-my-bookings' : `athar-bk:${slug}`);

function normalizeBooking(item) {
  if (!item || !item.token) return null;
  const part = Number(item.part_number);
  if (!Number.isInteger(part) || part < 1 || part > 30) return null;
  const round = Number.isInteger(item.round_no) && item.round_no >= 1 ? item.round_no : 1;
  return {
    id: typeof item.id === 'string' ? item.id : undefined,
    round_no: round,
    part_number: part,
    display_name: String(item.display_name || '').slice(0, 40),
    token: String(item.token)
  };
}

export function loadMyBookings(slug) {
  try {
    const raw = lsGet(bookingsKey(slug));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizeBooking).filter(Boolean);
    }
    if (slug === MEMORIAL_SLUG) {
      const single = normalizeBooking(JSON.parse(lsGet('athar-my-booking') || 'null'));
      if (single) {
        saveMyBookings(slug, [single]);
        return [single];
      }
    }
  } catch {}
  return [];
}

export function saveMyBookings(slug, items) {
  lsSet(bookingsKey(slug), JSON.stringify(items));
}

/* ---------- صاحب المجلس ---------- */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,200}$/;

export function getOwnerToken(slug) {
  const token = lsGet(`athar-owner:${slug}`);
  return token && TOKEN_RE.test(token) ? token : null;
}

export function setOwnerToken(slug, token) {
  lsSet(`athar-owner:${slug}`, token);
}

export function clearOwnerToken(slug) {
  lsDel(`athar-owner:${slug}`);
}

/** يلتقط رابط الإدارة #owner=... ويحفظه ثم يمسحه من شريط العنوان. */
export function captureOwnerFragment(slug) {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      const token = new URLSearchParams(hash).get('owner');
      if (token && TOKEN_RE.test(token)) {
        setOwnerToken(slug, token);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  } catch {}
  return getOwnerToken(slug);
}

/* ---------- «أريد المشاركة» ---------- */
export function getWaiting(slug) {
  try {
    return JSON.parse(lsGet(`athar-waiting:${slug}`) || 'null');
  } catch {
    return null;
  }
}

export function setWaiting(slug, rounds) {
  lsSet(`athar-waiting:${slug}`, JSON.stringify({ rounds }));
}

/* ---------- الاتصال بالـ API ---------- */
export async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    return { ok: false, status: 0, data: {}, error: 'NETWORK' };
  }
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data, error: data?.error || (response.ok ? '' : 'UNKNOWN') };
}

const ERROR_TEXT = {
  PART_TAKEN: 'سبقك مشارك آخر إلى هذا الجزء للتو. اختر جزءا آخر متاحا.',
  GROUP_FULL: 'اكتملت الحجوزات حالياً، لا توجد أجزاء متاحة الآن.',
  GROUP_CLOSED: 'أغلق صاحب المجلس باب الحجز حالياً.',
  LIMIT_REACHED: 'لديك عدة أجزاء قيد القراءة على هذا الجهاز. أتمم بعضها أولا ثم احجز غيرها.',
  NO_CONTACT_INFO: 'لا تكتب أرقام هواتف أو روابط. يكفي الاسم الأول أو الكنية.',
  RATE_LIMITED: 'أنشأت عددا كبيرا من المجالس خلال وقت قصير. حاول لاحقا.',
  INVALID_INPUT: 'راجع البيانات المكتوبة ثم حاول مجددا.',
  INVALID_ROUND: 'هذه الختمة غير مفتوحة بعد.',
  GROUP_NOT_FOUND: 'لم نعثر على هذا المجلس.',
  FORBIDDEN: 'رابط الإدارة غير صالح لهذا المجلس.',
  MAX_ROUNDS: 'وصل المجلس إلى الحد الأقصى: ١٠٠ ختمة.',
  NETWORK: 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.'
};

export function errorText(code, fallback = 'تعذر إتمام العملية الآن. حاول مرة أخرى.') {
  return ERROR_TEXT[code] || fallback;
}

export function publicUrl(slug) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return slug === MEMORIAL_SLUG ? `${origin}/` : `${origin}/k/${slug}`;
}

export function ownerUrl(slug, token) {
  return `${publicUrl(slug)}#owner=${token}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}
