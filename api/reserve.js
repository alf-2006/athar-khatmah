import { ensureSchema, parseBody } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const body = parseBody(req);
  const part = Number(body?.part_number);
  const displayName = String(body?.display_name ?? '').trim().slice(0, 40);
  const tokenHash = String(body?.token_hash ?? '');
  if (!Number.isInteger(part) || part < 1 || part > 30 || !displayName || !/^[a-f0-9]{64}$/.test(tokenHash)) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }
  try {
    const pool = await ensureSchema();
    const { rows } = await pool.query(
      'select public.reserve_part($1, $2, $3) as id',
      [part, displayName, tokenHash]
    );
    return res.status(201).json({ id: rows[0].id });
  } catch (error) {
    if (error.message?.includes('PART_TAKEN') || error.code === '23505') {
      return res.status(409).json({ error: 'PART_TAKEN' });
    }
    if (error.message?.includes('INVALID_')) return res.status(400).json({ error: error.message });
    console.error('booking_create_failed', error);
    return res.status(500).json({ error: 'BOOKING_FAILED' });
  }
}
