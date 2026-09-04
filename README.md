# VaultNet | Wealth Management & Quant Platform

> Modern Personal Wealth Management, Quantitative Analysis & Financial Assistance Platform

VaultNet is a modern personal wealth management platform featuring portfolio tracking, statement ingestion, quant sandbox, and AI wealth coaching.

## Architecture

- **Frontend**: React 19 + Vite + Recharts + Lucide Icons
- **API Gateway**: Node.js / Express, PostgreSQL (`pg`), Redis cache, JWT authentication
- **Quant Engine**: Python, Flask, Pandas, NumPy, YFinance, Scikit-learn, Google Generative AI
- **Database & Cache**: PostgreSQL (ledger, holdings, accounts) & Redis (caching)
- **Deployment**: Docker Compose support

## Getting Started

### 1. Environment Configuration
Copy the example environment files:
```bash
cp .env.example .env
cp gateway/.env.example gateway/.env
```

### 2. Running with Docker Compose
```bash
docker-compose up --build
```

### 3. Running Locally
- **Gateway**:
  ```bash
  cd gateway
  npm install
  npm start
  ```
- **Quant Engine**:
  ```bash
  cd quant-engine
  pip install -r requirements.txt
  python app.py
  ```
- **Frontend**:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```
