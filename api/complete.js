import { ensureSchema, parseBody } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const body = parseBody(req);
  const part = Number(body?.part_number);
  const tokenHash = String(body?.token_hash ?? '');
  if (!Number.isInteger(part) || part < 1 || part > 30 || !/^[a-f0-9]{64}$/.test(tokenHash)) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }
  try {
    const pool = await ensureSchema();
    const { rows } = await pool.query(
      'select public.complete_part($1, $2) as completed',
      [part, tokenHash]
    );
    if (!rows[0]?.completed) return res.status(403).json({ error: 'TOKEN_INVALID_OR_ALREADY_COMPLETED' });
    return res.status(200).json({ completed: true });
  } catch (error) {
    console.error('booking_complete_failed', error);
    return res.status(500).json({ error: 'COMPLETION_FAILED' });
  }
}
