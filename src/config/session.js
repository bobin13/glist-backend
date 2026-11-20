const session = require('express-session');
// Vercel: sessions are stored in Postgres so they survive across serverless instances.
// To go back to the in-memory store (single long-running server, local dev only),
// remove these two lines and the `store:` option below.
const PgSession = require('connect-pg-simple')(session);
const { pool } = require('./db');

const isProduction = process.env.NODE_ENV === 'production';

// Original guard (before Vercel). It blocked production because the default
// in-memory store loses sessions on restart. With the Postgres store above it is
// no longer needed. Restore it if you remove the Postgres store.
// if (isProduction) {
//   if (!process.env.SESSION_SECRET) {
//     throw new Error('SESSION_SECRET must be configured in production');
//   }
//
//   throw new Error('Configure a persistent session store before production use');
// }

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be configured in production');
}

module.exports = session({
  store: new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  name: 'glist.sid',
  secret: process.env.SESSION_SECRET || 'local-development-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // Works because the browser only ever talks to the backend same-site:
    // localhost:8000 -> localhost:3000 locally, and via the Netlify /api proxy in production.
    sameSite: 'lax',
    // Was `secure: false`. Vercel serves over HTTPS, so send the cookie only over HTTPS in production.
    secure: isProduction,
    // Stay signed in for 30 days.
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
});
