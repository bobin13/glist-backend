const authService = require('./auth.service');

async function login(req, res, next) {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let user;
  try {
    user = await authService.authenticate(email, password);
  } catch (error) {
    if (error.code === 'AUTH_PROVIDER_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Authentication provider is not configured' });
    }

    return next(error);
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  req.session.regenerate((error) => {
    if (error) {
      return next(error);
    }

    req.session.userId = user.id;
    req.session.save((saveError) => {
      if (saveError) {
        return next(saveError);
      }

      return res.json({ user: { id: user.id } });
    });
  });
}

module.exports = { login };