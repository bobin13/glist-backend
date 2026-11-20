const usersRepository = require('../features/users/users.repository');

// Loads the signed-in user (if any) onto req.user on every request.
// A deleted or disabled account is treated as signed out.
async function loadUser(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) return next();

  const user = await usersRepository.findById(userId);
  if (!user || user.is_disabled) {
    delete req.session.userId;
    return next();
  }

  req.user = user;
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Please sign in' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Please sign in' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admins only' });
  }
  return next();
}

module.exports = { loadUser, requireAuth, requireAdmin };
