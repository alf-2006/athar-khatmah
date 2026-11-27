import { ensureSchema, parseBody } from './_db.js';
import {
  KINDS,
  cleanText,
  clientIpHash,
  looksLikeContact,
  newOwnerToken,
  newSlug,
  send,
  sha256,
} from './_util.js';

const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 20;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
  const body = parseBody(req);
  const title = cleanText(body?.title, 60);
  const message = cleanText(body?.message, 200) || null;
  const kind = String(body?.kind ?? '');

  if (title.length < 2 || !KINDS.includes(kind)) {
    return send(res, 400, { error: 'INVALID_INPUT' });
  }
  if (looksLikeContact(title) || (message && looksLikeContact(message))) {
    return send(res, 400, { error: 'NO_CONTACT_INFO' });
  }

  try {
    const pool = await ensureSchema();
    const ipHash = clientIpHash(req);

    const { rows: usage } = await pool.query(
      `select (count(*) filter (where created_at > now() - interval '1 hour'))::int as hourly,
              count(*)::int as daily
         from public.groups
        where creator_ip_hash = $1 and created_at > now() - interval '1 day'`,
      [ipHash]
    );
    if (usage[0].hourly >= HOURLY_LIMIT || usage[0].daily >= DAILY_LIMIT) {
      return send(res, 429, { error: 'RATE_LIMITED' });
    }

    const ownerToken = newOwnerToken();
    const ownerHash = sha256(ownerToken);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const slug = newSlug();
      try {
        await pool.query(
          `insert into public.groups (slug, title, kind, message, owner_token_hash, creator_ip_hash)
           values ($1, $2, $3, $4, $5, $6)`,
          [slug, title, kind, message, ownerHash, ipHash]
        );
        return send(res, 201, { slug, owner_token: ownerToken });
      } catch (error) {
        if (error?.code !== '23505') throw error; // تعارض slug فقط → أعد المحاولة
      }
    }
    return send(res, 503, { error: 'SLUG_UNAVAILABLE' });
  } catch (error) {
    console.error('group_create_failed', error);
    return send(res, 500, { error: 'GROUP_CREATE_FAILED' });
  }
}
