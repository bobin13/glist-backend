const { pool } = require('../../config/db');

async function findAll() {
  await pool.query(
    `DELETE FROM public.grocery_items
     WHERE removed_at <= NOW() - INTERVAL '24 hours'`
  );
  const { rows } = await pool.query('SELECT * FROM public.grocery_items');
  return rows;
}

async function create(item) {
  const { rows } = await pool.query(
    `INSERT INTO public.grocery_items (list_id, name, quantity, unit, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [item.list_id, item.name, item.quantity, item.unit, item.created_by]
  );
  return rows[0];
}

async function markRemovedById(id) {
  const { rows } = await pool.query(
    `UPDATE public.grocery_items
     SET removed_at = COALESCE(removed_at, NOW())
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { findAll, create, markRemovedById };