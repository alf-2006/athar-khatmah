import { ensureSchema } from './_db.js';
import { MEMORIAL_SLUG, findGroup, groupSummary, isSlug, send } from './_util.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
  const query = req.query || {};
  const slug = String(query.group || MEMORIAL_SLUG).toLowerCase();
  if (!isSlug(slug)) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 400, { error: 'INVALID_INPUT' });
  }
  // طلبات التحديث بعد فعل المستخدم تحمل t= وتتجاوز الكاش؛ الاستطلاع الدوري يُخدَّم من CDN لثوانٍ.
  res.setHeader(
    'Cache-Control',
    query.t ? 'no-store' : 'public, s-maxage=4, stale-while-revalidate=4'
  );
  try {
    const pool = await ensureSchema();
    const group = await findGroup(pool, slug);
    if (!group) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 404, { error: 'GROUP_NOT_FOUND' });
    }
    const summary = await groupSummary(pool, group);
    const asked = Number.parseInt(query.round, 10);
    const round = Number.isInteger(asked)
      ? Math.min(Math.max(asked, 1), group.rounds)
      : summary.current_round;
    const { rows } = await pool.query(
      `select id, round_no, part_number, display_name, completed, created_at
         from public.bookings
        where group_id = $1 and round_no = $2
        order by part_number`,
      [group.id, round]
    );
    return send(res, 200, {
      group: {
        slug: group.slug,
        title: group.title,
        kind: group.kind,
        message: group.message,
        rounds: group.rounds,
        closed: group.closed,
      },
      round,
      summary,
      bookings: rows,
    });
  } catch (error) {
    console.error('bookings_read_failed', error);
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 500, { error: 'BOOKINGS_UNAVAILABLE' });
  }
}
