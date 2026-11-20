const { pool } = require('../../config/db');

// Every item comes back with the names of who added / crossed it off.
const ITEM_COLUMNS = `
  i.id, i.list_id, i.name, i.quantity, i.unit, i.created_at, i.removed_at,
  i.created_by, COALESCE(creator.display_name, creator.email) AS added_by_name,
  i.removed_by, COALESCE(remover.display_name, remover.email) AS removed_by_name`;
const ITEM_JOINS = `
  LEFT JOIN public.users creator ON creator.id = i.created_by
  LEFT JOIN public.users remover ON remover.id = i.removed_by`;

async function findByList(listId) {
  // Crossed-off items are kept for 24 hours, then purged.
  await pool.query(
    `DELETE FROM public.grocery_items
     WHERE list_id = $1 AND removed_at <= NOW() - INTERVAL '24 hours'`,
    [listId]
  );
  const { rows } = await pool.query(
    `SELECT ${ITEM_COLUMNS} FROM public.grocery_items i ${ITEM_JOINS}
     WHERE i.list_id = $1
     ORDER BY i.created_at`,
    [listId]
  );
  return rows;
}

async function create({ listId, name, quantity, unit, createdBy }) {
  const { rows } = await pool.query(
    `WITH i AS (
       INSERT INTO public.grocery_items (list_id, name, quantity, unit, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *
     )
     SELECT ${ITEM_COLUMNS} FROM i ${ITEM_JOINS}`,
    [listId, name, quantity, unit, createdBy]
  );
  return rows[0];
}

// Only matches items on the given list, so a member of one list can't touch another's.
async function markRemoved(listId, itemId, removedBy) {
  const { rows } = await pool.query(
    `WITH i AS (
       UPDATE public.grocery_items
       SET removed_at = COALESCE(removed_at, NOW()),
           removed_by = CASE WHEN removed_at IS NULL THEN $3 ELSE removed_by END,
           updated_at = NOW()
       WHERE id = $2 AND list_id = $1
       RETURNING *
     )
     SELECT ${ITEM_COLUMNS} FROM i ${ITEM_JOINS}`,
    [listId, itemId, removedBy]
  );
  return rows[0] || null;
}

module.exports = { findByList, create, markRemoved };
