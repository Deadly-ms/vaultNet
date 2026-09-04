-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

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

-- Convert price_history into TimescaleDB Hypertable
SELECT create_hypertable('price_history', 'time', if_not_exists => TRUE);

-- Create Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_date_category ON transactions(date, category);
CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions(type, date);
CREATE INDEX IF NOT EXISTS idx_holdings_account ON holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_time ON price_history(symbol, time DESC);

-- Enable TimescaleDB compression policies on price history hypertable
ALTER TABLE price_history SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol'
);
SELECT add_compression_policy('price_history', INTERVAL '7 days', if_not_exists => TRUE);
