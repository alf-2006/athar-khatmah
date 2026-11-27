import { ensureSchema, parseBody } from './_db.js';
import { MEMORIAL_SLUG, PARTS, findGroup, isHash, isSlug, send } from './_util.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
  const body = parseBody(req);
  const slug = String(body?.group || MEMORIAL_SLUG).toLowerCase();
  const part = Number(body?.part_number);
  const round = body?.round_no == null ? 1 : Number(body.round_no);
  const tokenHash = String(body?.token_hash ?? '');
  if (
    !isSlug(slug) ||
    !Number.isInteger(part) ||
    part < 1 ||
    part > PARTS ||
    !Number.isInteger(round) ||
    round < 1 ||
    !isHash(tokenHash)
  ) {
    return send(res, 400, { error: 'INVALID_INPUT' });
  }
  try {
    const pool = await ensureSchema();
    const group = await findGroup(pool, slug);
    if (!group) return send(res, 404, { error: 'GROUP_NOT_FOUND' });
    const { rows } = await pool.query(
      'select public.complete_part_in($1, $2, $3, $4) as completed',
      [group.id, round, part, tokenHash]
    );
    if (!rows[0]?.completed) {
      return send(res, 403, { error: 'TOKEN_INVALID_OR_ALREADY_COMPLETED' });
    }
    return send(res, 200, { completed: true });
  } catch (error) {
    console.error('booking_complete_failed', error);
    return send(res, 500, { error: 'COMPLETION_FAILED' });
  }
}
