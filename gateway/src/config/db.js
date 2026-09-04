const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment config: check current CWD first, then resolve absolute subdirectories
const result = dotenv.config({ override: true });
if (result.error || !process.env.DATABASE_URL) {
  // Try loading from gateway directory explicitly
  const localGatewayEnv = path.resolve(__dirname, '../../.env');
  dotenv.config({ path: localGatewayEnv, override: true });
}

console.log('Resolved Database URL:', process.env.DATABASE_URL ? 'LOADED successfully' : 'NOT FOUND (Defaulting to localhost)');

const dbUrl = new URL(process.env.DATABASE_URL);
const endpointId = dbUrl.hostname.split('.')[0];
const pool = new Pool({
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  host: dbUrl.hostname.includes('neon.tech') ? '50.16.189.237' : dbUrl.hostname,
  port: dbUrl.port || 5432,
  database: dbUrl.pathname.slice(1),
  ssl: dbUrl.hostname.includes('neon.tech') ? {
    rejectUnauthorized: false
  } : false,
  options: dbUrl.hostname.includes('neon.tech') ? `endpoint=${endpointId}` : undefined
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL/TimescaleDB successfully.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
