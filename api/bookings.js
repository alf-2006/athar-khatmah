import { ensureSchema } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const pool = await ensureSchema();
    const { rows } = await pool.query(
      'select id, part_number, display_name, completed, created_at from public.bookings order by part_number'
    );
    return res.status(200).json({ bookings: rows });
  } catch (error) {
    console.error('bookings_read_failed', error);
    return res.status(500).json({ error: 'BOOKINGS_UNAVAILABLE' });
  }
}
