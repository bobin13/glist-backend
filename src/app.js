const express = require('express');
const sessionMiddleware = require('./config/session');
const authRoutes = require('./features/auth/auth.routes');
const itemRoutes = require('./features/items/items.routes');

const app = express();

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.get('Origin');

  if (origin) {
    const isConfiguredOrigin = configuredOrigins.includes('*')
      || configuredOrigins.includes(origin);
    const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production'
      && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);

    if (isConfiguredOrigin || isLocalDevelopmentOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Request-Id');
    }
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());
app.use(sessionMiddleware);
app.use('/api/auth', authRoutes);

app.get('/time', (req, res) => {
  res.json({ currentTime: new Date().toISOString() });
});

app.use('/api/items', itemRoutes);


module.exports = app;