# VaultNet | Complete Platform Documentation & Architecture Guide

> **VaultNet** is a modern, full-stack Personal Wealth Management, Quantitative Analysis, and AI-Driven Financial Advisory Platform. It unifies transaction aggregation, automated statement ingestion, multi-asset portfolio tracking, quantitative backtesting, and an intelligent AI coach.

---

## 1. Project Purpose & Problem Statement

### 1.1 The Problem
Managing personal finances and investment portfolios is traditionally fragmented:
- **Banking & Expense Data** is locked in static PDF/CSV statements, requiring tedious manual spreadsheet entry.
- **Investment Portfolios** across multiple brokers, mutual funds, and crypto/wallets lack a unified, live valuation dashboard.
- **Quantitative Tools** (such as strategy backtesting, technical signals, and Monte Carlo projections) are typically reserved for institutional trading desks or complex Python scripts, out of reach for retail investors.
- **Financial Advisory** is either expensive or generic, lacking real-time context on an individual's actual net worth, spending leakages, and risk tolerance.

### 1.2 The VaultNet Solution
VaultNet bridges the gap between everyday personal finance tracking and institutional-grade quantitative intelligence:
1. **Intelligent Ingestion**: Uses Gemini AI alongside deterministic regex engines to automatically parse PDF and CSV bank statements into clean ledger transactions.
2. **Unified Wealth Ledger**: Aggregates cash reserves, bank accounts, credit cards, stocks, and mutual funds into a single real-time net-worth snapshot.
3. **Quant Sandbox**: Offers retail investors institutional tools—SMA/RSI backtesting on a TimescaleDB time-series hypertable, portfolio risk audits (Sharpe, Volatility, Max Drawdown), and Monte Carlo SIP/Lumpsum probabilistic forecasts.
4. **Context-Aware AI Coaching**: An embedded multi-persona financial strategist (Coach, Quant, Risk Manager) that queries live portfolio metrics through Gemini function calling.

---

## 2. Target Audience & Core Use Cases

| Persona / User | Primary Use Cases |
| :--- | :--- |
| **Everyday Savers & Budgeters** | • Upload monthly bank or credit card statements to auto-categorize spending.<br>• Set monthly category limits (Food, Rent, Shopping) and detect budget leakages.<br>• Track cash flow (Debits vs Credits) and savings rate. |
| **Long-Term Wealth Builders** | • Consolidate equity, mutual fund, and ETF holdings across brokers.<br>• Track unrealized gains/losses against live Yahoo Finance market quotes.<br>• Simulate 3-to-10 year SIP (Systematic Investment Plan) vs. Lumpsum wealth accumulation under Monte Carlo scenarios (P10, P50, P90). |
| **Quant Traders & Technical Analysts** | • Backtest SMA Crossover and RSI Mean Reversion strategies over custom date ranges.<br>• Screen watchlist assets for automated technical signals (Golden Cross, Death Cross, RSI Oversold/Overbought).<br>• Audit portfolio risk parameters (Annualized Volatility, Portfolio Sharpe Ratio, Max Drawdown, Sector Concentration). |
| **Financial Advisors & Analysts** | • Generate automated, opinionated portfolio health critiques.<br>• Monitor asset allocation distributions (Equities, Mutual Funds, ETFs, Cash).<br>• Audit historical strategy performance benchmarks against market returns. |

---

## 3. High-Level System Architecture

VaultNet operates as a decoupled, microservice-based architecture orchestrated via Docker Compose:

```
+-------------------------------------------------------------------------------+
|                               FRONTEND (SPA)                                  |
|               React 19 + Vite + Recharts + Lucide Icons + CSS Tokens           |
+---------------------------------------+---------------------------------------+
                                        | (HTTP / REST / JWT Bearer)
                                        v
+-------------------------------------------------------------------------------+
|                             API GATEWAY (Node.js)                             |
|        Express.js | JWT Auth | Multer Streamer | Redis Cache Layer            |
+-------------------+-----------------------------------+-----------------------+
                    |                                   |
         (SQL / Relational & Hypertable)      (Internal REST Microservice)
                    v                                   v
+---------------------------------------+   +-----------------------------------+
|        DATABASE & CACHE               |   |        QUANT & AI ENGINE          |
|  • TimescaleDB (PostgreSQL 15)        |   |  • Python Flask                   |
|    - Accounts, Transactions, Holdings |   |  • Google Gemini 1.5 Flash        |
|    - price_history (Hypertable)       |   |  • YFinance & Pandas / NumPy      |
|  • Redis Alpine                       |   |  • pdfplumber & Excel Parser      |
|    - AI Insights & News Feed Cache    |   |  • Monte Carlo & XIRR Simulators  |
+---------------------------------------+   +-----------------------------------+
```

### Network Topology & Port Mapping
- **Frontend**: Port `3000` (User interface)
- **API Gateway**: Port `5000` (Main API gateway & auth orchestrator)
- **Quant Engine**: Port `8000` (Internal computational & AI service)
- **TimescaleDB**: Port `5432` (Relational ledger & time-series prices)
- **Redis**: Port `6379` (In-memory caching layer)

---

## 4. Key Components & Directory Structure

```
fintech/
├── docker-compose.yml           # Multi-container orchestration
├── .env.example                 # Root environment template
├── db/
│   └── init.sql                 # TimescaleDB hypertable, tables, and compression policies
├── gateway/                     # Express.js API Gateway
│   ├── src/
│   │   ├── config/              # PostgreSQL pool & Redis client setup
│   │   ├── middleware/          # JWT auth middleware
│   │   ├── routes/              # Modular API endpoints (accounts, transactions, quant, etc.)
│   │   └── index.js             # Gateway server entry point
│   ├── package.json
│   └── Dockerfile
├── quant-engine/                # Python Analytical & AI Microservice
│   ├── app.py                   # Flask server, Gemini AI, YFinance, Backtester, Monte Carlo
│   ├── requirements.txt         # Dependencies (pandas, yfinance, google-generativeai, pdfplumber)
│   └── Dockerfile
└── frontend/                    # Modern React 19 Client
    ├── src/
    │   ├── components/          # Navbar, AiCoachChat, PortfolioSummary
    │   ├── context/             # AuthContext (JWT & PIN storage)
    │   ├── pages/               # Dashboard, Accounts, Transactions, Upload, Holdings, Watchlist, QuantConsole
    │   ├── index.css            # Dark mode glassmorphic design system
    │   ├── App.jsx              # Main routing & layout
    │   └── main.jsx
    ├── package.json
    └── vite.config.js
```

---

## 5. Module-by-Module Feature Breakdown

### 5.1 Authentication & Security (`gateway/src/routes/auth.js`)
- **Master PIN Authentication**: Simple and secure PIN-based authentication (`MASTER_PIN`), generating signed JSON Web Tokens (JWT).
- **Protected Endpoints**: All core API routes enforce `Bearer <token>` verification through `gateway/src/middleware/auth.js`.
- **Stateless Verification**: Seamless frontend session persistence using `localStorage`.

### 5.2 Accounts & Banking Ledger (`gateway/src/routes/accounts.js`)
- Supports diverse financial vehicles: `bank`, `broker`, `wallet`, and `credit_card`.
- Real-time balance consolidation and automatic currency defaults (INR `₹`, with multi-currency extensibility).

### 5.3 Automated Statement Ingestion (`quant-engine/app.py` -> `/parse-document`)
- **Multi-Format Support**: Ingests `.pdf`, `.csv`, `.xls`, and `.xlsx` statements.
- **Dual-Engine Processing**:
  1. **Primary (Gemini 1.5 Flash)**: Extracts dates (`YYYY-MM-DD`), amounts, transaction types (`debit`/`credit`), categories, and cleaned merchant names via structured JSON schemas (`TRANSACTION_SCHEMA`).
  2. **Fallback (Deterministic Regex)**: If the Gemini API key is not configured or fails, a robust regex engine processes dates, amounts, and credit/debit indicators locally.
- **Frontend Review Grid**: Users can review, adjust categories, edit amounts, delete false rows, and approve transactions before committing them to the database.
- **Automatic Account Balance Sync**: Inserting approved transactions dynamically updates the associated account balance.

### 5.4 Holdings & Portfolio Tracking (`gateway/src/routes/holdings.js`, `market.js`)
- Tracks **Stocks**, **Mutual Funds**, and **ETFs** associated with specific brokerage accounts.
- Fetches real-time market prices, day changes, and percentage shifts via the YFinance bridge.
- Computes total cost basis, live market valuation, and unrealized profit/loss.

### 5.5 Watchlist & Market Intelligence (`gateway/src/routes/watchlist.js`, `ai.js`)
- Allows tracking custom equity symbols (NSE/BSE e.g., `RELIANCE.NS`, `TCS.NS` or US tickers e.g., `AAPL`, `NVDA`).
- **AI News Summarizer**: Fetches Yahoo Finance / Google News RSS feeds, analyzes the latest articles using Gemini, and returns a concise, unhedged market sentiment brief (cached in Redis for 6 hours).

### 5.6 Quantitative Console (`quant-engine/app.py` & `frontend/src/pages/QuantConsole.jsx`)

#### A. Portfolio Risk Audit
- Calculates **Annualized Volatility**, **Sharpe Ratio** (assuming a 6% risk-free rate), and **Maximum Drawdown** across holdings.
- Visualizes **Sector Exposure** via Recharts pie charts to highlight over-concentration.

#### B. Technical Signals Screen
- Evaluates watchlist assets across:
  - **50-day Simple Moving Average (SMA 50)**
  - **200-day Simple Moving Average (SMA 200)**
  - **14-day Relative Strength Index (RSI 14)**
- Emits actionable signals: `Buy (Golden Cross)`, `Sell (Death Cross)`, `Buy (Oversold)`, `Sell (Overbought)`, or `Hold`.

#### C. Strategy Backtesting Sandbox
- Implements two classical quantitative strategies:
  1. **Dual Moving Average Crossover (SMA)**: Configurable short (e.g. 50) and long (e.g. 200) day windows.
  2. **RSI Mean Reversion**: Configurable oversold (e.g. 30) and overbought (e.g. 70) thresholds.
- **Self-Healing Data Cache**: Checks TimescaleDB for price history. If missing, it auto-downloads historical prices from YFinance, bulk-inserts them into the `price_history` hypertable, and caches future runs.
- **Benchmark Comparison**: Computes strategy cumulative return vs. buy-and-hold market return, strategy Sharpe ratio, and drawdown curve.
- **Audit History**: Stores all backtest parameters and output metrics in the `backtests` table for historical auditability.

#### D. Multi-Asset Comparison & Monte Carlo Projection
- Compares up to 5 assets simultaneously under **SIP** (weekly/monthly) or **Lumpsum** regimes.
- Computes money-weighted returns using **XIRR (Exact Internal Rate of Return)** with Newton-Raphson cash-flow solver.
- Runs a **150-path Monte Carlo Geometric Brownian Motion (GBM)** simulation to project future wealth over 1 to 10 years:
  - **P10 (Pessimistic / Bear Case)**
  - **P50 (Median / Expected Case)**
  - **P90 (Optimistic / Bull Case)**
- Automatically generates an opinionated, unhedged comparative critique via Gemini AI.

### 5.7 AI Wealth Coach (`quant-engine/app.py` -> `/ai/query`, `/ai/portfolio-insights`)
- **Floating Interactive Assistant**: Accessible from any page across the portal.
- **Three Persona Modes**:
  - `coach`: General Wealth Coach (budgeting, savings velocity, spending leakage).
  - `quant`: Quantitative Analyst (momentum, moving averages, Sharpe, alpha generation).
  - `risk`: Risk Manager (correlation, maximum drawdown, sector over-weighting).
- **Function Calling Tools**: Gemini can autonomously trigger:
  - `get_portfolio_summary`: Ingests live net worth, cash reserves, holdings valuation, and budgets.
  - `get_watchlist_signals`: Gathers current RSI and SMA signals for monitored stocks.
  - `run_backtest`: Runs on-the-fly backtests directly within the conversation.

---

## 6. Database Schema & TimescaleDB Optimization

### Tables Overview (`db/init.sql`)
1. **`accounts`**: Stores account metadata, type, current balance, and currency.
2. **`transactions`**: Double-entry financial records linked to accounts, with categories, amounts, dates, and origin source (`manual`, `pdf_upload`, `csv_upload`).
3. **`budgets`**: Monthly expenditure limits grouped by category.
4. **`holdings`**: Portfolio positions containing symbol, asset type, quantity, and average buy price.
5. **`watchlist`**: Monitored symbols for technical indicators and automated news feeds.
6. **`ai_insights`**: Persistent log of generated AI advice.
7. **`backtests`**: Relational JSONB audit log of strategy simulations and performance metrics.
8. **`price_history` (TimescaleDB Hypertable)**:
   - Partitioned time-series hypertable on the `time` column.
   - Segmented compression policy enabled for `symbol`.
   - Automated compression policy executed for data older than 7 days, reducing storage footprint by up to 90%.

---

## 7. API Reference Summary

### Authentication
- `POST /api/auth/login`: Accepts `{ pin: "..." }`, returns `{ token: "..." }`.
- `GET /api/auth/verify`: Validates current session token.

### Accounts & Ledger
- `GET /api/accounts`: List all registered accounts.
- `POST /api/accounts`: Create a new bank/broker/wallet account.
- `DELETE /api/accounts/:id`: Remove an account and cascade delete transactions.

### Transactions & Ingestion
- `GET /api/transactions`: Fetch paginated transactions with optional filters.
- `POST /api/transactions`: Create a single transaction.
- `POST /api/transactions/bulk`: Bulk insert parsed transactions.
- `POST /api/parser/upload`: Multipart upload of statement PDF/CSV; returns parsed transactions.

### Holdings & Markets
- `GET /api/holdings`: List holdings with live market quotes.
- `POST /api/holdings`: Add new investment position.
- `GET /api/market/quote?symbol=...`: Real-time stock/ETF quote.

### Quant Engine
- `GET /api/quant/risk`: Calculates volatility, Sharpe, max drawdown, and sector distribution.
- `GET /api/quant/signals`: Computes technical indicator signals across the watchlist.
- `POST /api/quant/backtest`: Executes strategy simulation against hypertable price series.
- `GET /api/quant/backtests/history`: Fetches past backtest audit records.
- `POST /api/quant/compare`: Runs multi-asset SIP/Lumpsum comparison with Monte Carlo projections.

### AI Intelligence
- `POST /api/ai/chat`: Interactive chat with portfolio context and role selection.
- `GET /api/ai/insights`: Generates or retrieves cached portfolio health insights.
- `GET /api/ai/news?symbol=...`: Returns cached Gemini summary of latest ticker news.

---

## 8. Tips & Roadmap for Future Feature Implementation

To take VaultNet to an enterprise or commercial fintech tier, consider the following technical roadmap and implementation tips:

### 8.1 Direct Broker & Bank Integrations
- **Implementation Tip**: Integrate with Open Banking APIs (like Plaid, Yodlee, or India's Account Aggregator framework / Setu) for automated statement retrieval without manual PDF uploads.
- **Trading APIs**: Connect with broker APIs (Zerodha Kite Connect, Alpaca, Interactive Brokers) to allow one-click execution of trades directly from the Quant Console backtest signals.

### 8.2 Real-Time WebSocket Ticker Streaming
- **Current State**: Tickers and quotes are fetched on-demand via REST from YFinance.
- **Implementation Tip**: Add a WebSocket server (e.g. Socket.io or native WebSockets in Express) connected to a streaming market feed (such as Finnhub, Polygon.io, or Twelve Data). Stream live price changes directly to the `HoldingsPage` and `WatchlistPage` without user refresh.

### 8.3 Advanced Quantitative Strategies
- **Expand Strategies**: Introduce:
  - **MACD (Moving Average Convergence Divergence)**
  - **Bollinger Bands Mean Reversion**
  - **Pairs Trading (Statistical Arbitrage)** using cointegration tests in `scipy.stats`.
  - **Markowitz Efficient Frontier & Black-Litterman Portfolio Optimization** to recommend mathematically optimal asset weightings based on risk tolerance.

### 8.4 Automated Periodic TimescaleDB Ingestion
- **Implementation Tip**: Set up a background task worker (using Celery, Redis Queue, or a Node.js cron worker) that runs daily at market close (e.g. 17:00 IST / 16:00 EST).
- **Task**: Automatically fetch and append the daily OHLCV bars for all assets in user holdings and watchlists to the `price_history` hypertable, keeping backtesting cache hot and instantaneous.

### 8.5 Multi-User Support & Role-Based Access Control (RBAC)
- **Current State**: Single master PIN authentication designed for single-tenant / local personal deployment.
- **Implementation Tip**:
  - Add a `users` table (`id`, `email`, `password_hash`, `created_at`).
  - Add `user_id INT REFERENCES users(id)` foreign keys to `accounts`, `budgets`, `watchlist`, and `holdings`.
  - Update `gateway/src/middleware/auth.js` to attach `req.user.id` to every database query for secure tenant isolation.

### 8.6 Tax-Loss Harvesting & Capital Gains Reporting
- **Implementation Tip**: Build a capital gains computation service that pairs transaction sell lots with purchase lots using **FIFO (First-In, First-Out)** accounting.
- Provide users with Short-Term Capital Gains (STCG) vs. Long-Term Capital Gains (LTCG) estimates for tax season, alongside automated recommendations for tax-loss harvesting.

### 8.7 Mobile App (React Native or Flutter)
- **Implementation Tip**: Since the API Gateway is completely decoupled and exposes clean JSON REST endpoints with JWT authorization, a React Native or Flutter mobile client can be built rapidly without altering any backend logic.

---

## 9. Local Development & Deployment Guide

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ & Python 3.10+ (if running bare-metal)

### Quickstart with Docker
```bash
# 1. Clone repository
git clone https://github.com/Deadly-ms/vaultNet.git
cd vaultNet

# 2. Configure environment
cp .env.example .env

# 3. Launch the full stack
docker-compose up --build
```
Access the application at `http://localhost:3000`.

### Bare-Metal Setup
```bash
# Terminal 1: Database & Cache
docker-compose up db cache

# Terminal 2: API Gateway
cd gateway
npm install
npm start

# Terminal 3: Quant Engine
cd quant-engine
pip install -r requirements.txt
python app.py

# Terminal 4: Frontend
cd frontend
npm install
npm run dev
```

---
*Documentation maintained for VaultNet | Modern Personal Wealth Management & Quant Platform.*
