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

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fintech';
const isProduction = process.env.NODE_ENV === 'production';

let poolConfig = {};

try {
  const dbUrl = new URL(connectionString);
  const isLocal = dbUrl.hostname === 'localhost' || dbUrl.hostname === '127.0.0.1' || dbUrl.hostname === 'db';
  const isNeon = dbUrl.hostname.includes('neon.tech');
  const requiresSsl = !isLocal || isProduction || dbUrl.searchParams.get('sslmode') === 'require';

  if (isNeon) {
    const endpointId = dbUrl.hostname.split('.')[0];
    poolConfig = {
      user: dbUrl.username,
      password: decodeURIComponent(dbUrl.password),
      host: '50.16.189.237',
      port: dbUrl.port || 5432,
      database: dbUrl.pathname.slice(1),
      ssl: { rejectUnauthorized: false },
      options: `endpoint=${endpointId}`
    };
  } else {
    poolConfig = {
      connectionString,
      ssl: requiresSsl ? { rejectUnauthorized: false } : false
    };
  }
} catch (e) {
  poolConfig = {
    connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false
  };
}

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database successfully.');
});

pool.on('error', (err) => {
  console.error('PostgreSQL client error (idle):', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
