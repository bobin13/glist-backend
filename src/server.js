require('dotenv').config();

const app = require('./app');
const { connectToDatabase, pool } = require('./config/db');

const port = process.env.PORT || 3000;

async function startServer() {
  await connectToDatabase();

  return app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error('Unable to start server:', error.message);
    await pool.end();
    process.exitCode = 1;
  });
}

module.exports = { startServer };