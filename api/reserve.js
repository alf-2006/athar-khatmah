import { ensureSchema, parseBody } from './_db.js';
import {
  MEMORIAL_SLUG,
  PARTS,
  cleanText,
  findGroup,
  isHash,
  isSlug,
  knownDbError,
  looksLikeContact,
  send,
} from './_util.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
  const body = parseBody(req);
  const slug = String(body?.group || MEMORIAL_SLUG).toLowerCase();
  const displayName = cleanText(body?.display_name, 40);
  const tokenHash = String(body?.token_hash ?? '');
  const deviceHash = body?.device_hash == null ? null : String(body.device_hash);
  const auto = body?.auto === true;
  const part = Number(body?.part_number);
  const round = body?.round_no == null ? 1 : Number(body.round_no);

  if (
    !isSlug(slug) ||
    !displayName ||
    !isHash(tokenHash) ||
    (deviceHash !== null && !isHash(deviceHash)) ||
    (!auto && (!Number.isInteger(part) || part < 1 || part > PARTS || !Number.isInteger(round) || round < 1))
  ) {
    return send(res, 400, { error: 'INVALID_INPUT' });
  }
  if (looksLikeContact(displayName)) {
    return send(res, 400, { error: 'NO_CONTACT_INFO' });
  }

  try {
    const pool = await ensureSchema();
    const group = await findGroup(pool, slug);
    if (!group) return send(res, 404, { error: 'GROUP_NOT_FOUND' });

    if (auto) {
      const { rows } = await pool.query(
        'select o_round, o_part, o_id from public.reserve_next_part($1, $2, $3, $4)',
        [group.id, displayName, tokenHash, deviceHash]
      );
      const row = rows[0];
      return send(res, 201, { id: row.o_id, round_no: row.o_round, part_number: row.o_part });
    }

    const { rows } = await pool.query(
      'select public.reserve_part_in($1, $2, $3, $4, $5, $6) as id',
      [group.id, round, part, displayName, tokenHash, deviceHash]
    );
    return send(res, 201, { id: rows[0].id, round_no: round, part_number: part });
  } catch (error) {
    const known = knownDbError(error);
    if (known) return send(res, known.status, { error: known.error });
    console.error('booking_create_failed', error);
    return send(res, 500, { error: 'BOOKING_FAILED' });
  }
}
