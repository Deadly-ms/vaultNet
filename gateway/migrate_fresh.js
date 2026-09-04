const { Client } = require('pg');

const adminUrlString = 'postgresql://postgres:Root@localhost:5432/postgres';
const appUrlString = 'postgresql://postgres:Root@localhost:5432/fintech';

const sql = `
-- Create Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,            -- 'bank' | 'broker' | 'wallet' | 'credit_card'
  current_balance NUMERIC(15, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Transactions Table
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

-- Create Budgets Table
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) UNIQUE NOT NULL,
  monthly_limit NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Holdings Table
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

-- Create Watchlist Table
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) UNIQUE NOT NULL,
  asset_type VARCHAR(20) NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create AI Insights Table
CREATE TABLE IF NOT EXISTS ai_insights (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,             -- 'spending' | 'portfolio' | 'stock_research'
  related_symbol VARCHAR(20),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Backtests Table
CREATE TABLE IF NOT EXISTS backtests (
  id SERIAL PRIMARY KEY,
  strategy_name VARCHAR(100) NOT NULL,
  params_json JSONB,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  results_json JSONB,                   -- returns, drawdown, Sharpe, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Price History Time-Series Table
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

-- Create Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_date_category ON transactions(date, category);
CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions(type, date);
CREATE INDEX IF NOT EXISTS idx_holdings_account ON holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_time ON price_history(symbol, time DESC);

-- Seed Initial Data
INSERT INTO accounts (name, type, current_balance, currency) VALUES
('HDFC Savings Bank', 'bank', 125000.00, 'INR'),
('Zerodha Demat Account', 'broker', 450000.00, 'INR'),
('SBI Credit Card', 'credit_card', -15000.00, 'INR'),
('Cash Wallet', 'wallet', 3000.00, 'INR');

INSERT INTO budgets (category, monthly_limit) VALUES
('Food', 15000.00),
('Rent', 30000.00),
('Utilities', 8000.00),
('Entertainment', 10000.00),
('Investment', 50000.00),
('Shopping', 12000.00),
('Uncategorized', 50000.00);

-- Seed transactions
INSERT INTO transactions (account_id, date, amount, type, category, description, source) VALUES
(1, CURRENT_DATE - INTERVAL '10 days', 5000.00, 'debit', 'Utilities', 'Electricity Bill Payment', 'manual'),
(1, CURRENT_DATE - INTERVAL '8 days', 1200.00, 'debit', 'Food', 'Dinner at Restaurant', 'manual'),
(1, CURRENT_DATE - INTERVAL '5 days', 2500.00, 'debit', 'Shopping', 'New apparel online', 'manual'),
(3, CURRENT_DATE - INTERVAL '4 days', 850.00, 'debit', 'Food', 'Groceries delivery', 'manual'),
(1, CURRENT_DATE - INTERVAL '2 days', 95000.00, 'credit', 'Salary', 'Monthly salary credit', 'manual'),
(2, CURRENT_DATE - INTERVAL '1 day', 25000.00, 'debit', 'Investment', 'SIP Mutual Fund purchase', 'manual');

-- Seed initial holdings
INSERT INTO holdings (account_id, symbol, asset_type, quantity, avg_buy_price, purchase_date) VALUES
(2, 'RELIANCE.NS', 'stock', 10, 2450.00, CURRENT_DATE - INTERVAL '30 days'),
(2, 'TCS.NS', 'stock', 5, 3200.00, CURRENT_DATE - INTERVAL '25 days'),
(2, 'INFY.NS', 'stock', 15, 1500.00, CURRENT_DATE - INTERVAL '15 days');

-- Seed watchlist
INSERT INTO watchlist (symbol, asset_type) VALUES
('HDFCBANK.NS', 'stock'),
('ICICIBANK.NS', 'stock'),
('SBIN.NS', 'stock');

-- Sync account balances based on transaction history
UPDATE accounts a SET current_balance = current_balance + (
  SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0)
  FROM transactions WHERE account_id = a.id
);
`;

async function run() {
  // 1. Connect to default postgres DB and recreate 'fintech' database
  const adminClient = new Client({
    connectionString: adminUrlString,
    ssl: false
  });

  try {
    await adminClient.connect();
    console.log('Connected to default postgres database.');
    
    // Force terminate existing active connections to prevent database lock errors
    console.log('Terminating active database connection pools...');
    await adminClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'fintech'
        AND pid <> pg_backend_pid();
    `);

    console.log("Dropping database 'fintech' if exists...");
    await adminClient.query("DROP DATABASE IF EXISTS fintech");
    
    console.log("Creating database 'fintech' fresh...");
    await adminClient.query("CREATE DATABASE fintech");
    console.log("Database successfully recreated!");
  } catch (err) {
    console.error('Error recreating database:', err.message);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // 2. Connect to the new database and seed tables
  const client = new Client({
    connectionString: appUrlString,
    ssl: false
  });

  try {
    await client.connect();
    console.log("Connected to fresh 'fintech' database.");
    await client.query(sql);
    console.log('Database successfully seeded with fresh transaction ledger records!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
