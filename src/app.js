const express = require('express');
const sessionMiddleware = require('./config/session');
const authRoutes = require('./features/auth/auth.routes');

const app = express();

app.use(express.json());
app.use(sessionMiddleware);
app.use('/api/auth', authRoutes);

app.get('/time', (req, res) => {
  res.json({ currentTime: new Date().toISOString() });
});

module.exports = app;