const authService = require('./auth.service');
const usersRepository = require('../users/users.repository');
const validate = require('../../lib/validate');

// Basic brute-force protection: at most 10 failed logins per email + IP per 15 minutes.
// In-memory, so it resets on restart and isn't shared between serverless instances.
const FAILED_LOGIN_LIMIT = 10;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failedLogins = new Map();

function loginKey(req, email) {
  return `${req.ip}|${email.toLowerCase()}`;
}

function isRateLimited(key) {
  const entry = failedLogins.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstFailureAt > FAILED_LOGIN_WINDOW_MS) {
    failedLogins.delete(key);
    return false;
  }
  return entry.count >= FAILED_LOGIN_LIMIT;
}

function recordFailedLogin(key) {
  const entry = failedLogins.get(key);
  if (entry && Date.now() - entry.firstFailureAt <= FAILED_LOGIN_WINDOW_MS) {
    entry.count += 1;
  } else {
    failedLogins.set(key, { count: 1, firstFailureAt: Date.now() });
  }
}

// Starts a fresh session for `user` (new session ID prevents session fixation).
function signIn(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = user.id;
      return req.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

async function register(req, res) {
  const { email, password, display_name } = req.body || {};
  const user = await authService.register({
    email: validate.email(email),
    password: validate.password(password),
    displayName: validate.name(display_name, 'Name', 50)
  });

  await signIn(req, user);
  return res.status(201).json({ user: usersRepository.toPublicUser(user) });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const key = loginKey(req, email);
  if (isRateLimited(key)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }

  const user = await authService.authenticate(email.trim(), password);
  if (!user) {
    recordFailedLogin(key);
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  failedLogins.delete(key);
  await signIn(req, user);
  return res.json({ user: usersRepository.toPublicUser(user) });
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('glist.sid');
    return res.status(204).end();
  });
}

function me(req, res) {
  return res.json({ user: req.user ? usersRepository.toPublicUser(req.user) : null });
}

// Lets a signed-in user change their own name and/or password.
async function updateMe(req, res) {
  const { display_name, current_password, new_password } = req.body || {};
  const fields = {};

  if (display_name !== undefined) {
    fields.display_name = validate.name(display_name, 'Name', 50);
  }

  if (new_password !== undefined) {
    if (typeof current_password !== 'string'
      || !(await authService.verifyPassword(req.user.id, current_password))) {
      return res.status(400).json({ error: 'Your current password is incorrect' });
    }
    fields.password_hash = await authService.hashPassword(validate.password(new_password));
  }

  const user = await usersRepository.update(req.user.id, fields);
  return res.json({ user: usersRepository.toPublicUser(user) });
}

module.exports = { register, login, logout, me, updateMe };
