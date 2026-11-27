import { ensureSchema, parseBody } from './_db.js';
import { findGroup, groupSummary, isHash, isSlug, send } from './_util.js';

/** «أريد المشاركة» بعد اكتمال الحجوزات: جهاز واحد = مرة واحدة. */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
  const body = parseBody(req);
  const slug = String(body?.group ?? '').toLowerCase();
  const tokenHash = String(body?.token_hash ?? '');
  if (!isSlug(slug) || !isHash(tokenHash)) {
    return send(res, 400, { error: 'INVALID_INPUT' });
  }
  try {
    const pool = await ensureSchema();
    const group = await findGroup(pool, slug);
    if (!group) return send(res, 404, { error: 'GROUP_NOT_FOUND' });
    if (group.closed) return send(res, 409, { error: 'GROUP_CLOSED' });
    const summary = await groupSummary(pool, group);
    if (summary.open > 0) return send(res, 409, { error: 'NOT_FULL' });
    await pool.query(
      `insert into public.waitlist (group_id, token_hash) values ($1, $2)
       on conflict (group_id, token_hash) do nothing`,
      [group.id, tokenHash]
    );
    return send(res, 200, { joined: true });
  } catch (error) {
    console.error('waitlist_failed', error);
    return send(res, 500, { error: 'WAITLIST_FAILED' });
  }
}
