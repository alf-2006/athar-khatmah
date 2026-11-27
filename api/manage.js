import { ensureSchema, parseBody } from './_db.js';
import { MAX_ROUNDS, PARTS, isSlug, send, sha256 } from './_util.js';

async function overview(pool, groupId) {
  const { rows } = await pool.query(
    `select g.rounds, g.closed,
            (select count(*)::int from public.bookings b where b.group_id = g.id) as taken,
            (select count(*)::int from public.bookings b where b.group_id = g.id and b.completed) as completed,
            (select count(*)::int from public.waitlist w where w.group_id = g.id) as waiting
       from public.groups g where g.id = $1`,
    [groupId]
  );
  const row = rows[0];
  return {
    rounds: row.rounds,
    closed: row.closed,
    total_parts: row.rounds * PARTS,
    taken: row.taken,
    completed: row.completed,
    waiting: row.waiting,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
  const body = parseBody(req);
  const slug = String(body?.group ?? '').toLowerCase();
  const ownerToken = String(body?.owner_token ?? '');
  const action = String(body?.action ?? 'overview');
  if (!isSlug(slug) || ownerToken.length < 16 || ownerToken.length > 200) {
    return send(res, 400, { error: 'INVALID_INPUT' });
  }

  try {
    const pool = await ensureSchema();
    const { rows } = await pool.query(
      'select id, rounds from public.groups where slug = $1 and owner_token_hash = $2',
      [slug, sha256(ownerToken)]
    );
    const group = rows[0];
    if (!group) return send(res, 403, { error: 'FORBIDDEN' });

    if (action === 'overview') {
      return send(res, 200, await overview(pool, group.id));
    }

    if (action === 'add_rounds') {
      const count = Number.parseInt(body?.count, 10);
      if (!Number.isInteger(count) || count < 1 || count > MAX_ROUNDS) {
        return send(res, 400, { error: 'INVALID_INPUT' });
      }
      if (group.rounds >= MAX_ROUNDS) return send(res, 409, { error: 'MAX_ROUNDS' });
      await pool.query(
        'update public.groups set rounds = least($2::int, rounds + $3::int) where id = $1',
        [group.id, MAX_ROUNDS, count]
      );
      // من كانوا ينتظرون صار لهم مكان الآن؛ نصفّر العداد ليُقاس الطلب على الختمات الجديدة.
      await pool.query('delete from public.waitlist where group_id = $1', [group.id]);
      return send(res, 200, await overview(pool, group.id));
    }

    if (action === 'set_closed') {
      await pool.query('update public.groups set closed = $2 where id = $1', [
        group.id,
        body?.closed === true,
      ]);
      return send(res, 200, await overview(pool, group.id));
    }

    if (action === 'release') {
      const round = Number(body?.round_no);
      const part = Number(body?.part_number);
      if (!Number.isInteger(round) || round < 1 || !Number.isInteger(part) || part < 1 || part > PARTS) {
        return send(res, 400, { error: 'INVALID_INPUT' });
      }
      const result = await pool.query(
        `delete from public.bookings
          where group_id = $1 and round_no = $2 and part_number = $3 and completed = false`,
        [group.id, round, part]
      );
      if (result.rowCount !== 1) return send(res, 409, { error: 'NOT_RELEASABLE' });
      return send(res, 200, await overview(pool, group.id));
    }

    return send(res, 400, { error: 'UNKNOWN_ACTION' });
  } catch (error) {
    console.error('group_manage_failed', error);
    return send(res, 500, { error: 'MANAGE_FAILED' });
  }
}
