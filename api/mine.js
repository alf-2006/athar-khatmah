import { ensureSchema, parseBody } from './_db.js';
import { MEMORIAL_SLUG, PARTS, findGroup, isHash, isSlug, send } from './_util.js';

/** حالة حجوزاتي (حتى ٢٠): reading | done؛ الغائب = أُلغي/حُرّر من المالك. */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
  const body = parseBody(req);
  const slug = String(body?.group || MEMORIAL_SLUG).toLowerCase();
  const items = Array.isArray(body?.items) ? body.items.slice(0, 20) : [];
  const valid = items.every(
    (it) =>
      Number.isInteger(it?.round_no) &&
      it.round_no >= 1 &&
      Number.isInteger(it?.part_number) &&
      it.part_number >= 1 &&
      it.part_number <= PARTS &&
      isHash(it?.token_hash)
  );
  if (!isSlug(slug) || !valid) return send(res, 400, { error: 'INVALID_INPUT' });
  if (items.length === 0) return send(res, 200, { items: [] });

  try {
    const pool = await ensureSchema();
    const group = await findGroup(pool, slug);
    if (!group) return send(res, 404, { error: 'GROUP_NOT_FOUND' });
    const { rows } = await pool.query(
      `select b.round_no, b.part_number, b.completed
         from public.bookings b
         join unnest($2::int[], $3::int[], $4::text[]) as q(r, p, h)
           on b.round_no = q.r and b.part_number = q.p and b.token_hash = q.h
        where b.group_id = $1`,
      [
        group.id,
        items.map((it) => it.round_no),
        items.map((it) => it.part_number),
        items.map((it) => it.token_hash),
      ]
    );
    return send(res, 200, {
      items: rows.map((r) => ({
        round_no: r.round_no,
        part_number: r.part_number,
        status: r.completed ? 'done' : 'reading',
      })),
    });
  } catch (error) {
    console.error('mine_failed', error);
    return send(res, 500, { error: 'MINE_FAILED' });
  }
}
