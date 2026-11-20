const { pool } = require('../../config/db');

async function findForUser(userId) {
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.created_at, m.role,
            owner.display_name AS owner_name,
            (SELECT COUNT(*)::int FROM public.list_members x WHERE x.list_id = l.id) AS member_count
     FROM public.list_members m
     JOIN public.grocery_lists l ON l.id = m.list_id
     LEFT JOIN public.list_members om ON om.list_id = l.id AND om.role = 'owner'
     LEFT JOIN public.users owner ON owner.id = om.user_id
     WHERE m.user_id = $1
     ORDER BY l.created_at`,
    [userId]
  );
  return rows;
}

async function findRole(listId, userId) {
  const { rows } = await pool.query(
    'SELECT role FROM public.list_members WHERE list_id = $1 AND user_id = $2',
    [listId, userId]
  );
  return rows[0]?.role || null;
}

async function create(name, ownerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [list] } = await client.query(
      'INSERT INTO public.grocery_lists (name, created_by) VALUES ($1, $2) RETURNING id, name, created_at',
      [name, ownerId]
    );
    await client.query(
      `INSERT INTO public.list_members (list_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [list.id, ownerId]
    );
    await client.query('COMMIT');
    return list;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function rename(listId, name) {
  const { rows } = await pool.query(
    `UPDATE public.grocery_lists SET name = $2, updated_at = NOW()
     WHERE id = $1 RETURNING id, name, created_at`,
    [listId, name]
  );
  return rows[0] || null;
}

// Items and memberships are removed by ON DELETE CASCADE.
async function remove(listId) {
  const { rowCount } = await pool.query('DELETE FROM public.grocery_lists WHERE id = $1', [listId]);
  return rowCount > 0;
}

async function findMembers(listId) {
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.email, u.display_name, m.role, m.joined_at
     FROM public.list_members m
     JOIN public.users u ON u.id = m.user_id
     WHERE m.list_id = $1
     ORDER BY (m.role = 'owner') DESC, m.joined_at`,
    [listId]
  );
  return rows;
}

// Returns null if the user is already a member.
async function addMember(listId, userId, role) {
  const { rows } = await pool.query(
    `INSERT INTO public.list_members (list_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (list_id, user_id) DO NOTHING
     RETURNING list_id`,
    [listId, userId, role]
  );
  return rows.length > 0;
}

// Owners can't be changed or removed this way; returns false when nothing matched.
async function updateMemberRole(listId, userId, role) {
  const { rowCount } = await pool.query(
    `UPDATE public.list_members SET role = $3
     WHERE list_id = $1 AND user_id = $2 AND role <> 'owner'`,
    [listId, userId, role]
  );
  return rowCount > 0;
}

async function removeMember(listId, userId) {
  const { rowCount } = await pool.query(
    `DELETE FROM public.list_members WHERE list_id = $1 AND user_id = $2 AND role <> 'owner'`,
    [listId, userId]
  );
  return rowCount > 0;
}

module.exports = {
  findForUser,
  findRole,
  create,
  rename,
  remove,
  findMembers,
  addMember,
  updateMemberRole,
  removeMember
};
