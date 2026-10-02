const session = require('express-session');

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be configured in production');
  }

  throw new Error('Configure a persistent session store before production use');
}

module.exports = session({
  name: 'glist.sid',
  secret: process.env.SESSION_SECRET || 'local-development-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
});