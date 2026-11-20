const usersRepository = require('../users/users.repository');
const authService = require('../auth/auth.service');
const validate = require('../../lib/validate');

async function listUsers(req, res) {
  const users = await usersRepository.listAllWithStats();
  return res.json({ users });
}

async function updateUser(req, res) {
  const { userId } = req.params;
  if (!validate.isUuid(userId)) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isSelf = userId === req.user.id;
  const { display_name, email, is_admin, is_disabled, password } = req.body || {};
  const fields = {};

  if (display_name !== undefined) fields.display_name = validate.name(display_name, 'Name', 50);
  if (email !== undefined) fields.email = validate.email(email);
  if (is_admin !== undefined) fields.is_admin = validate.boolean(is_admin, 'is_admin');
  if (is_disabled !== undefined) fields.is_disabled = validate.boolean(is_disabled, 'is_disabled');
  if (password !== undefined) {
    fields.password_hash = await authService.hashPassword(validate.password(password));
  }

  // Guard against locking yourself (and possibly everyone) out of the admin panel.
  if (isSelf && fields.is_admin === false) {
    return res.status(400).json({ error: 'You can\'t remove your own admin access' });
  }
  if (isSelf && fields.is_disabled === true) {
    return res.status(400).json({ error: 'You can\'t disable your own account' });
  }

  let user;
  try {
    user = await usersRepository.update(userId, fields);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Another account already uses that email' });
    }
    throw error;
  }
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Sign the user out everywhere after a disable or password reset by an admin.
  if (!isSelf && (fields.is_disabled === true || fields.password_hash)) {
    await usersRepository.deleteSessions(userId);
  }

  return res.json({ user: usersRepository.toPublicUser(user) });
}

async function deleteUser(req, res) {
  const { userId } = req.params;
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'You can\'t delete your own account from the admin panel' });
  }

  const deleted = validate.isUuid(userId) && await usersRepository.deleteWithListHandover(userId);
  if (!deleted) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.status(204).end();
}

module.exports = { listUsers, updateUser, deleteUser };
