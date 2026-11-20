const express = require('express');
const sessionMiddleware = require('./config/session');
const { loadUser } = require('./middleware/auth');
const authRoutes = require('./features/auth/auth.routes');
const listRoutes = require('./features/lists/lists.routes');
const adminRoutes = require('./features/admin/admin.routes');

const app = express();

// Vercel: requests arrive through Vercel's HTTPS proxy. Trusting it lets Express
// see the request as HTTPS so `secure` session cookies are set.
// Harmless elsewhere, but you can remove it if not deployed behind a proxy.
app.set('trust proxy', 1);

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Browsers may call this API directly only from these origins. In production the
// Netlify site proxies /api/* to this backend (see the frontend's netlify.toml), so
// requests are same-origin and the session cookie is first-party.
// (Browsers send the Origin without a trailing slash.)
const configuredOrigins = ['https://glist-home.netlify.app'];

app.use((req, res, next) => {
  const origin = req.get('Origin');

  if (origin) {
    const isConfiguredOrigin = configuredOrigins.includes(origin);
    const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production'
      && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);

    if (isConfiguredOrigin || isLocalDevelopmentOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Request-Id');
    }
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json({ limit: '20kb' }));
app.use(sessionMiddleware);
app.use(loadUser);

app.get('/time', (req, res) => {
  res.json({ currentTime: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Express 5 forwards errors thrown in async handlers here.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  const status = error.status || error.statusCode || 500;
  if (status >= 500) {
    console.error(`${req.method} ${req.originalUrl} failed:`, error);
  }
  res.status(status).json({ error: status >= 500 ? 'Something went wrong' : error.message });
});

module.exports = app;
