const { pool } = require('../../config/db');

const PUBLIC_COLUMNS = 'id, email, display_name, is_admin, is_disabled, created_at, updated_at';

// Shape sent to the browser. Never includes password_hash.
function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    is_admin: user.is_admin,
    is_disabled: user.is_disabled,
    created_at: user.created_at
  };
}

async function findById(id) {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM public.users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findByEmailWithPassword(email) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM public.users WHERE lower(email) = lower($1)`,
    [email]
  );
  return rows[0] || null;
}

async function findPasswordHash(id) {
  const { rows } = await pool.query('SELECT password_hash FROM public.users WHERE id = $1', [id]);
  return rows[0]?.password_hash || null;
}

async function create({ email, passwordHash, displayName }) {
  const { rows } = await pool.query(
    `INSERT INTO public.users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_COLUMNS}`,
    [email, passwordHash, displayName]
  );
  return rows[0];
}

// `fields` keys are trusted column names chosen by callers, never user input.
async function update(id, fields) {
  const columns = Object.keys(fields);
  if (columns.length === 0) return findById(id);

  const assignments = columns.map((column, index) => `${column} = $${index + 2}`);
  const { rows } = await pool.query(
    `UPDATE public.users
     SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $1
     RETURNING ${PUBLIC_COLUMNS}`,
    [id, ...columns.map((column) => fields[column])]
  );
  return rows[0] || null;
}

async function listAllWithStats() {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS.split(', ').map((c) => `u.${c}`).join(', ')},
            COUNT(m.list_id) FILTER (WHERE m.role = 'owner')::int AS owned_list_count,
            COUNT(m.list_id) FILTER (WHERE m.role <> 'owner')::int AS shared_list_count
     FROM public.users u
     LEFT JOIN public.list_members m ON m.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at`
  );
  return rows.map((row) => ({
    ...toPublicUser(row),
    owned_list_count: row.owned_list_count,
    shared_list_count: row.shared_list_count
  }));
}

// Log a user out everywhere (used after disabling, password resets and deletion).
async function deleteSessions(userId, client = pool) {
  await client.query(`DELETE FROM public.session WHERE sess ->> 'userId' = $1`, [userId]);
}

// Deletes a user. Lists they own are handed to the longest-standing other member,
// or deleted (with their items) if nobody else is on them.
async function deleteWithListHandover(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: ownedLists } = await client.query(
      `SELECT list_id FROM public.list_members WHERE user_id = $1 AND role = 'owner'`,
      [userId]
    );

    for (const { list_id: listId } of ownedLists) {
      const { rows: [heir] } = await client.query(
        `SELECT user_id FROM public.list_members
         WHERE list_id = $1 AND user_id <> $2
         ORDER BY (role = 'editor') DESC, joined_at
         LIMIT 1`,
        [listId, userId]
      );

      if (heir) {
        await client.query(
          `UPDATE public.list_members SET role = 'owner' WHERE list_id = $1 AND user_id = $2`,
          [listId, heir.user_id]
        );
        await client.query(
          'UPDATE public.grocery_lists SET created_by = $2, updated_at = NOW() WHERE id = $1',
          [listId, heir.user_id]
        );
      } else {
        await client.query('DELETE FROM public.grocery_lists WHERE id = $1', [listId]);
      }
    }

    // Lists the user created but no longer owns (ownership is tracked in list_members).
    await client.query(
      `UPDATE public.grocery_lists l
       SET created_by = m.user_id, updated_at = NOW()
       FROM public.list_members m
       WHERE l.created_by = $1 AND m.list_id = l.id AND m.role = 'owner'`,
      [userId]
    );

    await deleteSessions(userId, client);
    const { rowCount } = await client.query('DELETE FROM public.users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    return rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  toPublicUser,
  findById,
  findByEmailWithPassword,
  findPasswordHash,
  create,
  update,
  listAllWithStats,
  deleteSessions,
  deleteWithListHandover
};
