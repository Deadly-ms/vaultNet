const { pool } = require('./config/db');

const schemaSql = `
-- 1. Create Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,            -- 'bank' | 'broker' | 'wallet' | 'credit_card'
  current_balance NUMERIC(15, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  type VARCHAR(10) NOT NULL,             -- 'debit' | 'credit'
  category VARCHAR(100) DEFAULT 'Uncategorized',
  description TEXT,
  raw_text TEXT,
  source VARCHAR(20) DEFAULT 'manual',   -- 'manual' | 'pdf_upload' | 'csv_upload'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Budgets Table
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) UNIQUE NOT NULL,
  monthly_limit NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Holdings Table
CREATE TABLE IF NOT EXISTS holdings (
  id SERIAL PRIMARY KEY,
  account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  asset_type VARCHAR(20) NOT NULL,      -- 'stock' | 'mutual_fund' | 'etf'
  quantity NUMERIC(15, 4) NOT NULL,
  avg_buy_price NUMERIC(15, 4) NOT NULL,
  purchase_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Watchlist Table
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) UNIQUE NOT NULL,
  asset_type VARCHAR(20) NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create AI Insights Table
CREATE TABLE IF NOT EXISTS ai_insights (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,             -- 'spending' | 'portfolio' | 'stock_research'
  related_symbol VARCHAR(20),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Backtests Table
CREATE TABLE IF NOT EXISTS backtests (
  id SERIAL PRIMARY KEY,
  strategy_name VARCHAR(100) NOT NULL,
  params_json JSONB,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  results_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create Price History Table
CREATE TABLE IF NOT EXISTS price_history (
  time TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  asset_type VARCHAR(20) NOT NULL,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume BIGINT,
  nav NUMERIC
);

-- 9. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_date_category ON transactions(date, category);
CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions(type, date);
CREATE INDEX IF NOT EXISTS idx_holdings_account ON holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_time ON price_history(symbol, time DESC);

-- 10. Seed Default Budgets
INSERT INTO budgets (category, monthly_limit) VALUES
('Food', 15000.00),
('Rent', 30000.00),
('Utilities', 8000.00),
('Entertainment', 10000.00),
('Investment', 50000.00),
('Shopping', 12000.00),
('Uncategorized', 50000.00)
ON CONFLICT (category) DO NOTHING;
`;

const sampleAccountsSql = `
-- Seed default sample accounts only if accounts table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts LIMIT 1) THEN
    INSERT INTO accounts (name, type, current_balance, currency) VALUES
    ('HDFC Savings Bank', 'bank', 125000.00, 'INR'),
    ('Zerodha Demat Account', 'broker', 450000.00, 'INR'),
    ('SBI Credit Card', 'credit_card', -15000.00, 'INR'),
    ('Cash Wallet', 'wallet', 3000.00, 'INR');
  END IF;
END $$;
`;

async function initDb() {
  try {
    console.log('Verifying and initializing database schema...');
    await pool.query(schemaSql);
    await pool.query(sampleAccountsSql);

    // Attempt TimescaleDB hypertable setup if available
    try {
      await pool.query("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;");
      await pool.query("SELECT create_hypertable('price_history', 'time', if_not_exists => TRUE);");
      console.log('TimescaleDB hypertable extension enabled successfully.');
    } catch (timescaleErr) {
      console.log('Standard PostgreSQL database detected (TimescaleDB extension not present, using standard indexing).');
    }

    console.log('Database schema initialization completed successfully.');
  } catch (err) {
    console.error('Database migration/init error:', err.message);
  }
}

if (require.main === module) {
  initDb().then(() => {
    console.log('Manual migration finished.');
    process.exit(0);
  });
}

module.exports = { initDb };
