const { Pool } = require("pg");
// const fs = require("node:fs");
// const path = require("node:path");
require("dotenv").config({ quiet: true });

// Old approach: read the CA cert from a .pem file on disk
// const ca = fs.readFileSync(path.resolve(__dirname, "../../certs/ca.pem"), "utf8");

// New approach (Vercel): CA cert stored in the PRIVATE_KEY env variable.
// Env vars often lose the PEM line breaks (stored as literal "\n" or squashed onto
// one line), so rebuild a valid PEM: header line, base64 body in 64-char lines, footer.
function normalizePem(pem) {
    if (!pem) return undefined;
    const match = pem.replace(/\\n/g, "\n").match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
    if (!match) return pem;
    const [, label, body] = match;
    const lines = body.replace(/\s+/g, "").match(/.{1,64}/g).join("\n");
    return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`;
}

const ca = normalizePem(process.env.PRIVATE_KEY);

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        ca,
        rejectUnauthorized: true
    }
});

async function connectToDatabase() {
    const client = await pool.connect();

    try {
        await client.query('SELECT 1');
        return true;
    } finally {
        client.release();
    }
}

module.exports = { pool, connectToDatabase };