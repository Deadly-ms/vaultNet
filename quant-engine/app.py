import os
import tempfile
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber
import pandas as pd
import requests
import yfinance as yf
import google.generativeai as genai
from google.generativeai.types import GenerationConfig
import xml.etree.ElementTree as ET



app = Flask(__name__)
CORS(app)

def load_env():
    # Scan current directory and parent directories for .env
    env_paths = [
        os.path.join(os.path.dirname(__file__), '.env'),
        os.path.join(os.path.dirname(__file__), '..', '.env'),
        os.path.join(os.getcwd(), '.env'),
        os.path.join(os.getcwd(), '..', '.env')
    ]
    for path in env_paths:
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            os.environ[k.strip()] = v.strip().strip('"').strip("'")
                print(f"Loaded environment configurations from: {path}")
                break
            except Exception as e:
                print(f"Error loading env from {path}: {str(e)}")

# Load config before initializing API clients
load_env()

# Initialize Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
api_key_configured = bool(GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here")

if api_key_configured:
    genai.configure(api_key=GEMINI_API_KEY)
    print("Gemini API configured successfully.")
else:
    print("WARNING: GEMINI_API_KEY is not set. Portfolio insights will fall back to local dynamic analysis rules.")

# Structured JSON Schema for Gemini Transaction Parser
TRANSACTION_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "transactions": {
            "type": "ARRAY",
            "description": "List of parsed transactions from the financial statement",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "date": {
                        "type": "STRING", 
                        "description": "Date of transaction in YYYY-MM-DD format. If only DD-MM or MM/DD is present, infer the current/applicable year."
                    },
                    "amount": {
                        "type": "NUMBER", 
                        "description": "Transaction amount as a positive float value (absolute amount)."
                    },
                    "type": {
                        "type": "STRING", 
                        "enum": ["debit", "credit"],
                        "description": "debit for money out (expenses, fees, withdrawals), credit for money in (salary, interest, deposits)."
                    },
                    "category": {
                        "type": "STRING",
                        "description": "One of: Food, Rent, Utilities, Entertainment, Investment, Shopping, Salary, or Uncategorized."
                    },
                    "description": {
                        "type": "STRING",
                        "description": "A cleaned description of the vendor/transaction, removing weird transaction IDs or codes."
                    },
                    "raw_text": {
                        "type": "STRING",
                        "description": "The original matching line from the statement text for logging."
                    }
                },
                "required": ["date", "amount", "type", "description"]
            }
        }
    },
    "required": ["transactions"]
}

def extract_text_from_pdf(pdf_path):
    text_content = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                text_content.append(text)
    return "\n".join(text_content)

def extract_text_from_csv(csv_path):
    try:
        df = pd.read_csv(csv_path)
        # Convert first 200 rows of DataFrame to string to prevent token limit issues
        return df.head(200).to_string()
    except Exception as e:
        return f"Error reading CSV: {str(e)}"

def extract_text_from_excel(excel_path):
    try:
        df = pd.read_excel(excel_path)
        return df.head(200).to_string()
    except Exception as e:
        return f"Error reading Excel: {str(e)}"

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "OK",
        "service": "quant-engine",
        "gemini_configured": api_key_configured
    })

@app.route('/parse-document', methods=['POST'])
def parse_document():
    global api_key_configured
    # Reload key if it was updated
    current_key = os.environ.get("GEMINI_API_KEY", "")
    api_key_configured = bool(current_key and current_key != "your_gemini_api_key_here")
    if api_key_configured:
        try:
            genai.configure(api_key=current_key)
        except Exception as e:
            print(f"Error configuring genai key: {str(e)}")
            api_key_configured = False

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    filename = file.filename.lower()
    suffix = os.path.splitext(filename)[1]

    # Save to a temporary file for reading
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        file.save(temp_file.name)
        temp_file_path = temp_file.name

    raw_text = ""
    try:
        # Extract raw text based on file format
        if suffix == '.pdf':
            raw_text = extract_text_from_pdf(temp_file_path)
        elif suffix == '.csv':
            raw_text = extract_text_from_csv(temp_file_path)
        elif suffix in ['.xls', '.xlsx']:
            raw_text = extract_text_from_excel(temp_file_path)
        else:
            os.unlink(temp_file_path)
            return jsonify({"error": f"Unsupported file format: {suffix}"}), 400
        
        os.unlink(temp_file_path)
    except Exception as e:
        print(f"Error extracting text from file: {str(e)}")
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        # Fall back to using mock list to bypass extraction errors
        raw_text = ""

    # 1. If Gemini is configured, try using LLM parsing
    if api_key_configured and raw_text.strip():
        try:
            prompt = f"""
            You are a precise financial assistant. Your task is to analyze the following bank/credit card/brokerage statement and extract all transactions.
            
            Analyze the text layout to find the transactions list. Extract the following fields for each transaction:
            - Date: Convert it to standard 'YYYY-MM-DD' format. Inferred from statement headers if the year is not printed next to each transaction.
            - Amount: Absolute positive numeric value.
            - Type: 'debit' (for expenses, withdrawals, charges) or 'credit' (for deposits, salary, refunds).
            - Category: Select the best fit from Food, Rent, Utilities, Entertainment, Investment, Shopping, Salary, or Uncategorized.
            - Description: Clean name of merchant or transaction description.
            - Raw Text: Original string/line of this transaction.

            Here is the statement text:
            ---
            {raw_text}
            ---
            """

            model = genai.GenerativeModel("gemini-1.5-flash")
            
            generation_config = GenerationConfig(
                response_mime_type="application/json",
                response_schema=TRANSACTION_SCHEMA,
                temperature=0.1
            )

            response = model.generate_content(prompt, generation_config=generation_config)
            parsed = json.loads(response.text)
            return jsonify(parsed)
        except Exception as e:
            print(f"Gemini document parsing failed, falling back to local engine: {str(e)}")

    # 2. Local Regex/Rules Parsing Fallback Engine
    try:
        import re
        transactions = []
        
        # Regex parameters to match common date lines and numbers (including optional year for short dates like 10/02)
        date_pattern = r'\b(\d{1,2}[/\-\.]\d{1,2}(?:[/\-\.]\d{2,4})?|\d{1,2}\s+[a-zA-Z]{3}(?:\s+\d{2,4})?|[a-zA-Z]{3}\s+\d{1,2}(?:\s+\d{2,4})?)\b'
        # Match standard amounts, currency quantities, or small decimal credit adjustments accurately
        amount_pattern = r'(?:\b\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)\b'
        
        if raw_text.strip():
            lines = raw_text.split('\n')
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                date_match = re.search(date_pattern, line)
                if not date_match:
                    continue
                    
                date_str = date_match.group(1)
                line_without_date = line.replace(date_str, '', 1)
                
                # Protect check numbers (e.g. CHECK 1234) from being matched as transaction amount
                line_clean_for_amounts = re.sub(r'\bCHECK\s+(\d+)\b', 'CHECK', line_without_date, flags=re.IGNORECASE)
                
                amounts = re.findall(amount_pattern, line_clean_for_amounts)
                valid_amounts = []
                for amt in amounts:
                    try:
                        val = float(amt.replace(',', ''))
                        if val > 0.01:
                            valid_amounts.append((amt, val))
                    except ValueError:
                        pass
                        
                if not valid_amounts:
                    continue
                    
                # Take first valid float as transaction amount
                tx_amt_str, tx_amt = valid_amounts[0]
                
                # Classify type
                tx_type = 'debit'
                if any(kw in line.upper() for kw in ['CREDIT', 'CR', 'DEP', 'DEPOSIT', 'SALARY', 'REFUND', 'INTEREST', 'RECEIVED']):
                    tx_type = 'credit'
                    
                # Classify category
                category = 'Uncategorized'
                line_upper = line.upper()
                if any(kw in line_upper for kw in ['FOOD', 'ZOMATO', 'SWIGGY', 'RESTAURANT', 'DINER', 'CAFE', 'EATS']):
                    category = 'Food'
                elif any(kw in line_upper for kw in ['RENT', 'APARTMENT', 'LEASE']):
                    category = 'Rent'
                elif any(kw in line_upper for kw in ['POWER', 'ELECTRIC', 'WATER', 'GAS', 'TELEPHONE', 'MOBILE', 'INTERNET', 'BROADBAND', 'BILL', 'RECHARGE']):
                    category = 'Utilities'
                elif any(kw in line_upper for kw in ['MOVIE', 'NETFLIX', 'SPOTIFY', 'SHOW', 'CONCERT', 'THEATRE', 'FUN', 'PLAY', 'GAME']):
                    category = 'Entertainment'
                elif any(kw in line_upper for kw in ['MUTUAL', 'FUND', 'SIP', 'ZERODHA', 'STOCKS', 'SHARES', 'SECURITIES', 'GROWW', 'NSE', 'BSE']):
                    category = 'Investment'
                elif any(kw in line_upper for kw in ['AMAZON', 'FLIPKART', 'SHOP', 'CLOTHES', 'APPAREL', 'MALL', 'GROCERY', 'SUPERMARKET', 'RETAIL']):
                    category = 'Shopping'
                elif any(kw in line_upper for kw in ['SALARY', 'WAGE', 'PAYCHECK', 'INCOME', 'BONUS']):
                    category = 'Salary'
                    
                # Build description using line_without_date (so we keep check numbers in description)
                desc = line_without_date.replace(tx_amt_str, '', 1)
                # Remove balance column amount from description if present
                if len(valid_amounts) > 1:
                    desc = desc.replace(valid_amounts[1][0], '', 1)
                    
                desc = re.sub(r'[\s,\-\|]+', ' ', desc).strip()
                if not desc:
                    desc = "Statement Transaction"
                    
                # Parse date safely (handle short dates like 10/02 or long dates)
                formatted_date = "2026-10-01"
                parts = re.split(r'[/\-\.]', date_str)
                if len(parts) == 2:
                    try:
                        val1 = int(parts[0])
                        val2 = int(parts[1])
                        # Assume MM/DD if first part <= 12
                        if val1 <= 12:
                            month = val1
                            day = val2
                        else:
                            month = val2
                            day = val1
                        formatted_date = f"2026-{month:02d}-{day:02d}"
                    except ValueError:
                        pass
                else:
                    for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d-%m-%y', '%Y-%m-%d', '%m/%d/%Y', '%m/%d/%y']:
                        try:
                            import datetime
                            dt = datetime.datetime.strptime(date_str, fmt)
                            formatted_date = dt.strftime('%Y-%m-%d')
                            break
                        except:
                            pass
                            
                transactions.append({
                    "date": formatted_date,
                    "amount": tx_amt,
                    "type": tx_type,
                    "category": category,
                    "description": desc[:60],
                    "raw_text": line
                })
        
        # If no entries parsed, return empty array
        if not transactions:
            print("No transactions parsed from document text.")
            return jsonify({"transactions": [], "message": "No transactions could be extracted from this document."})
            
        return jsonify({"transactions": transactions})
    except Exception as e:
        print(f"Local statement parsing engine crash: {str(e)}")
        return jsonify({"error": "Failed parsing document", "details": str(e)}), 500
# In-memory AMFI NAV cache
amfi_cache = {"text": "", "timestamp": 0.0}

def fetch_amfi_raw_text():
    now = time.time()
    # Cache AMFI file for 1 hour to prevent hitting AMFI web servers on every single call
    if not amfi_cache["text"] or (now - amfi_cache["timestamp"]) > 3600:
        try:
            url = "https://www.amfiindia.com/spages/NAVAll.txt"
            print("Fetching fresh NAV dataset from AMFI...")
            r = requests.get(url, timeout=12)
            if r.status_code == 200 and r.text.strip():
                amfi_cache["text"] = r.text
                amfi_cache["timestamp"] = now
                print("AMFI dataset cached successfully.")
        except Exception as err:
            print(f"Error fetching AMFI NAVs: {err}")
    return amfi_cache["text"]

def parse_amfi_nav(scheme_code):
    raw_text = fetch_amfi_raw_text()
    if not raw_text:
        return None
    lines = raw_text.split("\n")
    for line in lines:
        if not line.strip():
            continue
        parts = line.split(";")
        if len(parts) >= 5 and parts[0].strip() == str(scheme_code):
            try:
                nav_str = parts[4].strip()
                price = float(nav_str) if nav_str and nav_str != "N.A." else 0.0
                return {
                    "symbol": parts[0].strip(),
                    "name": parts[3].strip(),
                    "price": price,
                    "date": parts[5].strip(),
                    "currency": "INR"
                }
            except Exception as e:
                print(f"Error parsing line for scheme {scheme_code}: {e}")
    return None

@app.route('/market/quote', methods=['GET'])
def get_market_quote():
    symbol = request.args.get('symbol', '').strip()
    asset_type = request.args.get('type', 'stock').strip().lower()

    if not symbol:
        return jsonify({"error": "Symbol parameter is required."}), 400

    try:
        if asset_type in ['mutual_fund', 'mf']:
            mf_data = parse_amfi_nav(symbol)
            if not mf_data:
                sym_str = symbol.strip()
                return jsonify({
                    "symbol": sym_str,
                    "price": 0.0,
                    "name": f"Mutual Fund Scheme {sym_str}",
                    "currency": "INR",
                    "pe": None,
                    "pb": None,
                    "dividend_yield": None,
                    "updated_at": time.strftime("%Y-%m-%d")
                })
            
            return jsonify({
                "symbol": mf_data["symbol"],
                "price": mf_data["price"],
                "name": mf_data["name"],
                "currency": "INR",
                "pe": None,
                "pb": None,
                "dividend_yield": None,
                "updated_at": mf_data.get("date") or time.strftime("%Y-%m-%d")
            })
        else:
            ticker = yf.Ticker(symbol)
            price = 0.0
            currency = "INR" if symbol.endswith(".NS") or symbol.endswith(".BO") else "USD"
            name = symbol
            pe = None
            pb = None
            div_yield = None
            
            # Try fetching live price via yfinance history or fast_info
            try:
                hist = ticker.history(period="1d")
                if not hist.empty:
                    price = float(hist['Close'].iloc[-1])
                else:
                    price = float(ticker.fast_info.get('lastPrice', 0.0))
            except Exception as e:
                print(f"yfinance lookup error for {symbol}: {e}")

            if price > 0.0:
                try:
                    info = ticker.info
                    pe = info.get('trailingPE') or info.get('forwardPE')
                    pb = info.get('priceToBook')
                    div_yield = info.get('dividendYield')
                    if div_yield:
                        div_yield = float(div_yield) * 100
                    name = info.get('longName') or info.get('shortName') or symbol
                    currency = info.get('currency') or currency
                except Exception as e:
                    print(f"Non-fatal error loading ticker.info: {e}")

            return jsonify({
                "symbol": symbol,
                "price": price,
                "name": name,
                "currency": currency,
                "pe": pe,
                "pb": pb,
                "dividend_yield": div_yield,
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
            })

    except Exception as e:
        print(f"Error fetching market quote for {symbol}: {str(e)}")
        return jsonify({"error": "Failed fetching market quote", "details": str(e)}), 500

# Structured JSON Schema for Gemini Insights Parser
INSIGHTS_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "insights": {
            "type": "ARRAY",
            "description": "List of distinct portfolio insights, critical checks or warnings.",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title": {
                        "type": "STRING",
                        "description": "Short, punchy action-oriented title."
                    },
                    "content": {
                        "type": "STRING",
                        "description": "Opinionated and direct critique or suggestion. Do not hedge."
                    },
                    "type": {
                        "type": "STRING",
                        "enum": ["warning", "info", "success"],
                        "description": "warning for overbudget/imbalances, success for healthy stats, info for general metrics."
                    }
                },
                "required": ["title", "content", "type"]
            }
        }
    },
    "required": ["insights"]
}

@app.route('/ai/news-summary', methods=['GET'])
def get_news_summary():
    symbol = request.args.get('symbol', '').strip()
    name = request.args.get('name', '').strip()
    
    if not symbol:
        return jsonify({"error": "Symbol parameter is required."}), 400

    query = name if name else symbol
    
    # Simplify query for mutual funds or long asset names to improve match rate on Google News search
    if 'Direct' in query or 'Regular' in query or ' - ' in query:
        query = query.split(' - ')[0]
    # If query is still too generic (e.g. just a raw numeric AMFI code like '127042'), use a fallback term or search with the word mutual fund
    if query.isdigit():
        query = f"Mutual Fund {query}"

    print(f"Fetching Google News RSS for query: {query}")
    
    try:
        url = f"https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(url, headers=headers, timeout=10)
        
        articles = []
        if r.status_code == 200:
            root = ET.fromstring(r.text)
            for item in root.findall('.//item')[:4]:
                title = item.find('title').text if item.find('title') is not None else ""
                link = item.find('link').text if item.find('link') is not None else ""
                pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ""
                articles.append({
                    "title": title,
                    "link": link,
                    "pubDate": pub_date
                })

        if not articles:
            return jsonify({
                "summary": f"No recent news articles found for '{query}'. Make sure the ticker is valid.",
                "headlines": []
            })

        prompt = f"""
        You are a financial analyst summarizing recent news for {query}.
        Below are recent news headlines/articles. Provide a concise, copyright-safe, 2-to-3 sentence summary of what is happening. Do not copy the text directly, and do not include boilerplate or advice warnings. Be direct.
        
        Headlines:
        {json.dumps(articles, indent=2)}
        """

        summary = ""
        if api_key_configured:
            try:
                model = genai.GenerativeModel("gemini-1.5-flash")
                response = model.generate_content(prompt)
                summary = response.text.strip()
            except Exception as gemini_err:
                print(f"Gemini news summary generation error: {gemini_err}")

        if not summary:
            # Fallback local news briefing if Gemini API is not set up or throws error
            summary = f"Recent news briefing for {query}: " + " | ".join(art['title'] for art in articles)

        return jsonify({
            "summary": summary,
            "headlines": articles
        })

    except Exception as e:
        print(f"Error fetching/summarizing news for {symbol}: {str(e)}")
        return jsonify({"error": "Failed fetching news summary", "details": str(e)}), 500

@app.route('/ai/portfolio-insights', methods=['POST'])
def get_portfolio_insights():
    data = request.json or {}
    context = data.get('portfolio_context', {})
    
    if not context:
        return jsonify({"error": "portfolio_context payload is required."}), 400

    # 1. Try generating with Gemini if configured
    if api_key_configured:
        try:
            prompt = f"""
            You are an elite, unhedged personal portfolio advisor. Analyze the client's asset positions, cash balances, budgets, and monthly expenses.
            Write 3-4 bullet-point descriptive insights about their wealth and spending behaviors. Be direct and suggest specific changes. Do NOT output advisor warnings or disclosures.
            
            Client portfolio status:
            - Live net wealth: ₹{context.get('netWorth', 0):,.2f}
            - Cash Reserves: ₹{context.get('cashBalance', 0):,.2f}
            - Holdings Valuation: ₹{context.get('holdingsValuation', 0):,.2f}
            - Combined Portfolio Cost: ₹{context.get('portfolioCostBasis', 0):,.2f}
            - Monthly Income: ₹{context.get('monthlyCredit', 0):,.2f}
            - Monthly Expenses: ₹{context.get('monthlyDebit', 0):,.2f}
            - Category-wise Spending: {json.dumps(context.get('categorySpend', []))}
            - Budget limits: {json.dumps(context.get('budgets', []))}
            """

            model = genai.GenerativeModel("gemini-1.5-flash")
            
            generation_config = GenerationConfig(
                response_mime_type="application/json",
                response_schema=INSIGHTS_SCHEMA,
                temperature=0.3
            )

            response = model.generate_content(prompt, generation_config=generation_config)
            parsed = json.loads(response.text)
            return jsonify(parsed)
        except Exception as e:
            print(f"Gemini API Error, falling back to local rule engine: {str(e)}")

    # 2. Fallback to Local Rule-Based Analytics Engine
    try:
        cash_balance = float(context.get('cashBalance', 0))
        monthly_credit = float(context.get('monthlyCredit', 0))
        monthly_debit = float(context.get('monthlyDebit', 0))
        budgets = context.get('budgets', [])
        holdings = context.get('holdings', [])
        category_spend = context.get('categorySpend', [])

        # If completely fresh account with no activity, return empty list so UI displays clean empty state
        if cash_balance == 0 and monthly_credit == 0 and monthly_debit == 0 and not budgets and not holdings:
            return jsonify({"insights": []})
        
        savings_rate = 0.0
        if monthly_credit > 0:
            savings_rate = ((monthly_credit - monthly_debit) / monthly_credit) * 100
            
        insights = []
        
        # Insight 1: Savings velocity (only when income exists)
        if monthly_credit > 0:
            if savings_rate > 30:
                insights.append({
                    "title": "Excellent Savings Velocity",
                    "content": f"Your savings rate is strong at {savings_rate:.1f}%. You are successfully keeping a large portion of your income. Consider routing excess cash from your savings into index funds or diversified mutual funds via automated SIPs.",
                    "type": "success"
                })
            elif savings_rate > 0:
                insights.append({
                    "title": "Moderate Capital Retention",
                    "content": f"Your savings rate is {savings_rate:.1f}%. While positive, you can accelerate wealth compounding by trimming discretionary expenses to reach a 30%+ target.",
                    "type": "info"
                })
            else:
                insights.append({
                    "title": "Capital Outflow Alert",
                    "content": f"Your savings rate is negative ({savings_rate:.1f}%). Monthly debit outflows of ₹{monthly_debit:,.2f} exceed credits. Review your ledger items to stop wealth leakage.",
                    "type": "warning"
                })
        elif monthly_debit > 0:
            insights.append({
                "title": "Expense Tracking Active",
                "content": f"Current monthly outflows are ₹{monthly_debit:,.2f}. Log your income credits to track your monthly net savings rate.",
                "type": "info"
            })

        # Insight 2: Liquidity Buffer (only when cash or debit is non-zero)
        if monthly_debit > 0 and cash_balance > monthly_debit * 3:
            insights.append({
                "title": "Liquidity Inflation Drag",
                "content": f"Cash reserves of ₹{cash_balance:,.2f} exceed 3 months of typical expenses. This idle capital may experience inflation drag. Consider allocating a portion into low-volatility funds.",
                "type": "info"
            })
        elif monthly_debit > 0 and cash_balance < monthly_debit * 1:
            insights.append({
                "title": "Low Liquidity Buffer",
                "content": f"Your cash reserves of ₹{cash_balance:,.2f} are below 1 month of current expenses. Maintain at least 3 months of emergency buffer before expanding equity positions.",
                "type": "warning"
            })
        elif cash_balance > 0:
            insights.append({
                "title": "Healthy Liquidity Reserves",
                "content": f"Your cash reserves of ₹{cash_balance:,.2f} provide a solid financial cushion.",
                "type": "success"
            })

        # Insight 3: Budget tracking (only when budgets are defined)
        if budgets:
            over_budget_cats = []
            for cat_spend in category_spend:
                cat_name = cat_spend.get('category')
                total_spend = cat_spend.get('total', 0)
                limit = next((float(b.get('monthly_limit')) for b in budgets if b.get('category') == cat_name), None)
                if limit and total_spend > limit:
                    over_budget_cats.append(cat_name)
                    
            if over_budget_cats:
                insights.append({
                    "title": f"Budget Breached: {', '.join(over_budget_cats)}",
                    "content": f"Active transactions have breached monthly allocations for {', '.join(over_budget_cats)}. Review recent expenses to restrict further outflows.",
                    "type": "warning"
                })
            else:
                insights.append({
                    "title": "Ledger Budgets Intact",
                    "content": "All category expenses are currently operating within the monthly limits you defined.",
                    "type": "success"
                })

        return jsonify({"insights": insights})
    except Exception as e:
        print(f"Error in local insights engine: {str(e)}")
        return jsonify({"error": "Failed generating local insights", "details": str(e)}), 500

# ----------------------------------------------------
# AI TOOL DEFINITIONS & AUTOMATIC FUNCTION DISPATCH (Phase 5)
# ----------------------------------------------------

active_context = {}

def get_portfolio_summary_tool() -> dict:
    """
    Fetches the current portfolio status, cash reserves, holdings valuation, monthly income, and monthly expenses.
    Use this tool whenever the user asks about their net worth, cash balances, monthly expenses, or budget allocations.
    """
    global active_context
    return {
        "net_wealth": active_context.get("netWorth", 0.0),
        "cash_balance": active_context.get("cashBalance", 0.0),
        "holdings_valuation": active_context.get("holdingsValuation", 0.0),
        "monthly_expenses": active_context.get("monthlyDebit", 0.0),
        "monthly_income": active_context.get("monthlyCredit", 0.0),
        "budget_limits": active_context.get("budgets", [])
    }

def get_watchlist_signals_tool() -> list:
    """
    Calculates technical indicators (RSI, SMA50, SMA200) and buy/sell signals for the user's holdings and watchlist.
    Use this tool when the user asks about technical signals, RSI levels, crossovers, or how their watchlisted symbols look.
    """
    global active_context
    holdings = active_context.get("holdings", [])
    report = []
    
    # We compile live technical signals for symbols in holdings/watchlist
    for h in holdings:
        symbol = h.get("symbol")
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="1y", interval="1d")
            if df.empty:
                continue
            df = df.sort_index()
            close_series = df['Close']
            latest_price = float(close_series.iloc[-1])
            sma50 = float(close_series.rolling(window=50).mean().iloc[-1])
            sma200 = float(close_series.rolling(window=200).mean().iloc[-1]) if len(close_series) >= 200 else 0.0
            
            delta = close_series.diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            avg_gain = gain.rolling(window=14).mean()
            avg_loss = loss.rolling(window=14).mean()
            rs = avg_gain / avg_loss
            rsi_series = 100 - (100 / (1 + rs))
            latest_rsi = float(rsi_series.iloc[-1]) if not pd.isna(rsi_series.iloc[-1]) else 50.0
            
            trade_signal = "Hold"
            if latest_rsi < 30: trade_signal = "Buy (Oversold)"
            elif latest_rsi > 70: trade_signal = "Sell (Overbought)"
            elif sma50 > sma200 and sma200 > 0: trade_signal = "Buy (Golden Cross)"
            elif sma50 < sma200 and sma200 > 0: trade_signal = "Sell (Death Cross)"
            
            report.append({
                "symbol": symbol,
                "price": latest_price,
                "sma50": sma50,
                "sma200": sma200,
                "rsi": latest_rsi,
                "signal": trade_signal
            })
        except Exception:
            pass
    return report

def run_backtest_tool(symbol: str, strategy: str) -> dict:
    """
    Runs a quantitative backtest for a stock symbol (e.g. RELIANCE.NS) and strategy (sma or rsi) for the last 1 year.
    Returns return metrics: strategy return, buy & hold return, Sharpe, and Max Drawdown.
    
    Args:
        symbol: The stock ticker symbol, e.g. 'RELIANCE.NS'
        strategy: Either 'sma' or 'rsi'
    """
    try:
        symbol = symbol.upper().strip()
        strategy = strategy.lower().strip()
        end_date = time.strftime("%Y-%m-%d")
        start_date = (pd.to_datetime(end_date) - pd.Timedelta(days=365)).strftime("%Y-%m-%d")
        
        t = yf.Ticker(symbol)
        df = t.history(start=start_date, end=end_date, interval="1d")
        if df.empty:
            return {"error": f"No price history found for symbol {symbol}"}
        
        df = df.sort_index()
        close_series = df['Close']
        
        if strategy == 'sma':
            sma50 = close_series.rolling(window=50).mean()
            sma200 = close_series.rolling(window=200).mean()
            signal = (sma50 > sma200).astype(int)
        elif strategy == 'rsi':
            delta = close_series.diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            avg_gain = gain.rolling(window=14).mean()
            avg_loss = loss.rolling(window=14).mean()
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
            
            states = []
            current_state = 0
            for r_val in rsi:
                if pd.isna(r_val):
                    states.append(0)
                    continue
                if current_state == 0 and r_val < 30:
                    current_state = 1
                elif current_state == 1 and r_val > 70:
                    current_state = 0
                states.append(current_state)
            signal = pd.Series(states, index=df.index)
        else:
            return {"error": f"Unsupported strategy model: {strategy}"}
            
        market_returns = close_series.pct_change()
        strat_signal = signal.shift(1).fillna(0)
        strategy_returns = market_returns * strat_signal
        
        market_cum = (1 + market_returns.fillna(0)).cumprod() - 1
        strategy_cum = (1 + strategy_returns.fillna(0)).cumprod() - 1
        
        vol = float(strategy_returns.std() * (252 ** 0.5))
        final_cum_return = float(strategy_cum.iloc[-1])
        ann_return = ((1 + final_cum_return) ** (1.0 / 1.0)) - 1
        sharpe = (ann_return - 0.06) / vol if vol > 0 else 0.0
        
        portfolio_value = (1 + strategy_returns.fillna(0)).cumprod()
        peak = portfolio_value.cummax()
        drawdown = (portfolio_value - peak) / peak
        max_dd = float(drawdown.min())
        
        return {
            "symbol": symbol,
            "strategy": strategy,
            "strategy_return_pct": float(round(final_cum_return * 100, 2)),
            "market_return_pct": float(round(market_cum.iloc[-1] * 100, 2)),
            "volatility_pct": float(round(vol * 100, 2)),
            "sharpe_ratio": float(round(sharpe, 2)),
            "max_drawdown_pct": float(round(max_dd * 100, 2))
        }
    except Exception as e:
        return {"error": str(e)}

@app.route('/ai/query', methods=['POST'])
def query_ai_coach():
    global active_context
    data = request.json or {}
    user_prompt = data.get('prompt', '').strip()
    context = data.get('portfolio_context', {})
    history = data.get('history', [])
    role_state = data.get('role', 'coach').lower().strip()

    if not user_prompt:
        return jsonify({"error": "Prompt is required."}), 400

    # Save incoming request context globally so the tools can access it stateless
    active_context = context

    try:
        base_instruction = """
        You are VaultNet Wealth Coach, an unhedged personal quant and portfolio manager. You give direct suggestions and critique of the user's finances.
        Answer their questions about their portfolio or market trends based on their context. Be opinionated, suggest concrete actions, and don't hesitate to give strong financial analysis.
        Avoid standard advisor disclaimers.
        """

        if role_state == 'quant':
            role_focus = """
            Active Perspective: QUANT ANALYST.
            Your focus is on quantitative backtesting, market momentum indicators (RSI, moving average crossovers), alpha generation, and trading strategy returns.
            When answering, emphasize statistical performance, backtest indicators, and entry/exit signals. Refer to specific backtest results or signals if appropriate.
            """
        elif role_state == 'risk':
            role_focus = """
            Active Perspective: RISK MANAGER.
            Your focus is on asset class correlation, portfolio volatility coefficients, sector weights concentrations, maximum drawdown mitigation, and capital preservation.
            When answering, analyze risk metrics, check for diversification anomalies, and warn if the user has excessive exposure to single sectors or asset types.
            """
        else:
            role_focus = """
            Active Perspective: GENERAL WEALTH COACH.
            Your focus is on daily budgeting, expense habits, monthly savings rates, ledger cash balances, and general financial sanity.
            Suggest budget allocations and saving adjustments based on their monthly debit/credit.
            """

        system_instruction = f"""
        {base_instruction}
        {role_focus}

        Current client portfolio context (use this unless details have changed, or check via tools if required):
        - Live net wealth: ₹{context.get('netWorth', 0):,.2f}
        - Cash Reserves: ₹{context.get('cashBalance', 0):,.2f}
        - Holdings Valuation: ₹{context.get('holdingsValuation', 0):,.2f}
        - Portfolio Cost Basis: ₹{context.get('portfolioCostBasis', 0):,.2f}
        - Active Holdings: {json.dumps(context.get('holdings', []))}
        - Monthly Expenses: ₹{context.get('monthlyDebit', 0):,.2f}
        - Monthly Income: ₹{context.get('monthlyCredit', 0):,.2f}
        - Active Budgets: {json.dumps(context.get('budgets', []))}
        """

        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction.strip(),
            tools=[get_portfolio_summary_tool, get_watchlist_signals_tool, run_backtest_tool]
        )

        # Setup chat history context for conversational awareness
        chat = model.start_chat(enable_automatic_function_calling=True)

        # Re-inject past chat memory
        if history:
            formatted_history_context = "Review past chat history before answering:\n"
            for chat_entry in history:
                role = "User" if chat_entry.get("role") == "user" else "Coach"
                formatted_history_context += f"{role}: {chat_entry.get('text')}\n"
            # Send context memo first
            chat.send_message(formatted_history_context)

        # Send active user question
        response = chat.send_message(user_prompt)
        
        return jsonify({
            "response": response.text.strip()
        })

    except Exception as e:
        print(f"Error querying AI Coach agent: {str(e)}")
        return jsonify({"error": "Failed to communicate with AI Coach agent", "details": str(e)}), 500


# ----------------------------------------------------
# QUANT TOOLS & ANALYST ENGINES (Phase 4)
# ----------------------------------------------------

@app.route('/quant/download', methods=['GET'])
def quant_download_history():
    symbol = request.args.get('symbol', '').strip().upper()
    start_date = request.args.get('start', '').strip()
    end_date = request.args.get('end', '').strip()

    if not symbol or not start_date or not end_date:
        return jsonify({"error": "Symbol, start, and end parameters are required."}), 400

    try:
        print(f"Downloading historical daily dataset from yfinance for {symbol} ({start_date} to {end_date})...")
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start_date, end=end_date, interval="1d")

        if df.empty:
            return jsonify({"error": f"No historical prices found for symbol {symbol} in the requested range."}), 404

        history_list = []
        for timestamp, row in df.iterrows():
            history_list.append({
                "time": timestamp.strftime("%Y-%m-%d %H:%M:%S%z"),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": int(row["Volume"]),
                "nav": None
            })

        return jsonify(history_list)

    except Exception as e:
        print(f"Error downloading history for {symbol}: {str(e)}")
        return jsonify({"error": "Failed downloading history", "details": str(e)}), 500

@app.route('/quant/run-backtest', methods=['POST'])
def run_backtest_strategy():
    data = request.json or {}
    prices = data.get('prices', [])
    strategy = data.get('strategy', 'sma').strip().lower()
    params = data.get('params', {})
    risk_free_rate = float(data.get('risk_free_rate', 0.06))

    if not prices or len(prices) < 10:
        return jsonify({"error": "Insufficient historical prices to run backtest. Need at least 10 rows."}), 400

    try:
        df = pd.DataFrame(prices)
        df['time'] = pd.to_datetime(df['time'])
        df = df.sort_values('time').reset_index(drop=True)
        df['close'] = df['close'].astype(float)

        if strategy == 'sma':
            short_w = int(params.get('short', 50))
            long_w = int(params.get('long', 200))
            
            df['sma_short'] = df['close'].rolling(window=short_w).mean()
            df['sma_long'] = df['close'].rolling(window=long_w).mean()
            df['signal'] = (df['sma_short'] > df['sma_long']).astype(int)
        
        elif strategy == 'rsi':
            period = int(params.get('period', 14))
            oversold = float(params.get('oversold', 30))
            overbought = float(params.get('overbought', 70))
            
            delta = df['close'].diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            
            avg_gain = gain.rolling(window=period).mean()
            avg_loss = loss.rolling(window=period).mean()
            
            rs = avg_gain / avg_loss
            df['rsi'] = 100 - (100 / (1 + rs))
            
            states = []
            current_state = 0
            for r_val in df['rsi']:
                if pd.isna(r_val):
                    states.append(0)
                    continue
                if current_state == 0 and r_val < oversold:
                    current_state = 1
                elif current_state == 1 and r_val > overbought:
                    current_state = 0
                states.append(current_state)
            df['signal'] = states
        
        else:
            return jsonify({"error": f"Unsupported backtesting strategy: {strategy}"}), 400

        df['market_returns'] = df['close'].pct_change()
        df['strat_signal'] = df['signal'].shift(1).fillna(0)
        df['strategy_returns'] = df['market_returns'] * df['strat_signal']
        
        df['market_cum'] = (1 + df['market_returns'].fillna(0)).cumprod() - 1
        df['strategy_cum'] = (1 + df['strategy_returns'].fillna(0)).cumprod() - 1

        vol = float(df['strategy_returns'].std() * (252 ** 0.5))

        n_days = len(df)
        years = n_days / 252.0 if n_days > 0 else 1.0
        final_cum_return = float(df['strategy_cum'].iloc[-1]) if not df.empty else 0.0
        ann_return = ((1 + final_cum_return) ** (1.0 / years)) - 1 if final_cum_return > -1 else -1.0

        sharpe = (ann_return - risk_free_rate) / vol if vol > 0 else 0.0

        df['portfolio_value'] = (1 + df['strategy_returns'].fillna(0)).cumprod()
        df['peak'] = df['portfolio_value'].cummax()
        df['drawdown'] = (df['portfolio_value'] - df['peak']) / df['peak']
        max_dd = float(df['drawdown'].min())

        history = []
        for _, row in df.iterrows():
            history.append({
                "date": row["time"].strftime("%Y-%m-%d"),
                "market_cum": float(round(row["market_cum"] * 100, 2)),
                "strategy_cum": float(round(row["strategy_cum"] * 100, 2))
            })

        return jsonify({
            "strategy_return": float(round(final_cum_return * 100, 2)),
            "market_return": float(round(df['market_cum'].iloc[-1] * 100, 2)),
            "volatility": float(round(vol * 100, 2)),
            "sharpe": float(round(sharpe, 2)),
            "max_drawdown": float(round(max_dd * 100, 2)),
            "history": history
        })

    except Exception as e:
        print(f"Error executing backtest: {str(e)}")
        return jsonify({"error": "Backtest execution failure", "details": str(e)}), 500

@app.route('/quant/risk', methods=['POST'])
def get_portfolio_risk_metrics():
    data = request.json or {}
    holdings = data.get('holdings', [])
    risk_free_rate = float(data.get('risk_free_rate', 0.06))

    if not holdings:
        return jsonify({
            "volatility": 0.0,
            "sharpe": 0.0,
            "max_drawdown": 0.0,
            "sectors": []
        })

    try:
        end_date = time.strftime("%Y-%m-%d")
        start_date = (pd.to_datetime(end_date) - pd.Timedelta(days=365)).strftime("%Y-%m-%d")
        
        prices_dict = {}
        sectors_dict = {}
        cost_basis = 0.0
        
        for h in holdings:
            symbol = h["symbol"]
            qty = float(h["quantity"])
            cost_basis += qty * float(h["avg_price"])
            
            sector = "Other"
            if h["type"] == "stock":
                try:
                    ticker = yf.Ticker(symbol)
                    sector = ticker.info.get('sector', 'Other')
                except Exception:
                    pass
            elif h["type"] == "mutual_fund":
                sector = "Mutual Fund"
            else:
                sector = "ETF"
                
            sectors_dict[symbol] = {
                "sector": sector,
                "weight": qty * float(h["avg_price"])
            }

            try:
                t = yf.Ticker(symbol)
                hist = t.history(start=start_date, end=end_date, interval="1d")
                if not hist.empty:
                    prices_dict[symbol] = hist['Close']
            except Exception as e:
                print(f"Failed to fetch historical series for risk engine {symbol}: {e}")

        if not prices_dict:
            return jsonify({
                "volatility": 0.0,
                "sharpe": 0.0,
                "max_drawdown": 0.0,
                "sectors": []
            })

        prices_df = pd.DataFrame(prices_dict).ffill().bfill()
        
        portfolio_value_series = pd.Series(0.0, index=prices_df.index)
        for h in holdings:
            sym = h["symbol"]
            qty = float(h["quantity"])
            if sym in prices_df.columns:
                portfolio_value_series += prices_df[sym] * qty

        portfolio_returns = portfolio_value_series.pct_change().dropna()
        daily_vol = portfolio_returns.std()
        ann_vol = float(daily_vol * (252 ** 0.5))

        init_val = portfolio_value_series.iloc[0] if len(portfolio_value_series) > 0 else 0
        final_val = portfolio_value_series.iloc[-1] if len(portfolio_value_series) > 0 else 0
        portfolio_return = (final_val - init_val) / init_val if init_val > 0 else 0.0

        sharpe = (portfolio_return - risk_free_rate) / ann_vol if ann_vol > 0 else 0.0

        peak = portfolio_value_series.cummax()
        drawdown = (portfolio_value_series - peak) / peak
        max_dd = float(drawdown.min())

        sector_totals = {}
        for sym, details in sectors_dict.items():
            sec = details["sector"]
            wt = details["weight"]
            sector_totals[sec] = sector_totals.get(sec, 0.0) + wt

        sectors_list = []
        for sec, val in sector_totals.items():
            sectors_list.append({
                "name": sec,
                "value": float(round(val, 2))
            })

        return jsonify({
            "volatility": float(round(ann_vol * 100, 2)),
            "sharpe": float(round(sharpe, 2)),
            "max_drawdown": float(round(max_dd * 100, 2)),
            "sectors": sectors_list
        })

    except Exception as e:
        print(f"Error computing portfolio risk parameters: {str(e)}")
        return jsonify({"error": "Failed generating risk report", "details": str(e)}), 500

@app.route('/quant/signals', methods=['POST'])
def get_watchlist_signals():
    data = request.json or {}
    watchlist = data.get('watchlist', [])

    if not watchlist:
        return jsonify([])

    signals_report = []

    for item in watchlist:
        symbol = item["symbol"]
        asset_type = item["asset_type"]

        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="1y", interval="1d")

            if df.empty or len(df) < 50:
                signals_report.append({
                    "symbol": symbol,
                    "price": 0.0,
                    "sma50": 0.0,
                    "sma200": 0.0,
                    "rsi": 50.0,
                    "signal": "No Data"
                })
                continue

            df = df.sort_index()
            close_series = df['Close']
            latest_price = float(close_series.iloc[-1])

            sma50 = float(close_series.rolling(window=50).mean().iloc[-1])
            sma200 = float(close_series.rolling(window=200).mean().iloc[-1]) if len(close_series) >= 200 else 0.0

            delta = close_series.diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            avg_gain = gain.rolling(window=14).mean()
            avg_loss = loss.rolling(window=14).mean()
            rs = avg_gain / avg_loss
            rsi_series = 100 - (100 / (1 + rs))
            latest_rsi = float(rsi_series.iloc[-1]) if not pd.isna(rsi_series.iloc[-1]) else 50.0

            trade_signal = "Hold"
            if latest_rsi < 30:
                trade_signal = "Buy (Oversold)"
            elif latest_rsi > 70:
                trade_signal = "Sell (Overbought)"
            elif sma50 > sma200 and sma200 > 0:
                trade_signal = "Buy (Golden Cross)"
            elif sma50 < sma200 and sma200 > 0:
                trade_signal = "Sell (Death Cross)"

            signals_report.append({
                "symbol": symbol,
                "price": latest_price,
                "sma50": sma50,
                "sma200": sma200,
                "rsi": latest_rsi,
                "signal": trade_signal
            })

        except Exception as e:
            print(f"Error resolving indicators for watch item {symbol}: {e}")
            signals_report.append({
                "symbol": symbol,
                "price": 0.0,
                "sma50": 0.0,
                "sma200": 0.0,
                "rsi": 50.0,
                "signal": "Indicator Error"
            })

    return jsonify(signals_report)

# ----------------------------------------------------
# PORTFOLIO COMPARISON & SIP PREDICTION ENGINES
# ----------------------------------------------------

def npv(r, cash_flows):
    t0 = cash_flows[0][0]
    val = 0.0
    for dt, amt in cash_flows:
        t = (dt - t0).days / 365.0
        val += amt / ((1.0 + r) ** t)
    return val

def xirr(cash_flows):
    """Calculates internal rate of return for irregular periodic cash flows."""
    has_pos = any(cf[1] > 0 for cf in cash_flows)
    has_neg = any(cf[1] < 0 for cf in cash_flows)
    if not (has_pos and has_neg):
        return 0.0
        
    try:
        low = -0.99
        high = 3.0
        
        # Expand bounds if necessary
        for _ in range(10):
            if npv(high, cash_flows) > 0:
                high *= 2.0
            else:
                break
                
        # Perform Bisection solver (60 iterations for high precision)
        for _ in range(60):
            mid = (low + high) / 2.0
            val = npv(mid, cash_flows)
            if val > 0:
                low = mid
            else:
                high = mid
        return float(round((low + high) / 2.0 * 100, 2))
    except Exception as err:
        print(f"XIRR Solver exception: {err}")
        return 0.0

def generate_mock_history(symbol, start, end):
    """Fallback generator that builds a realistic random-walk price series for local simulation."""
    import pandas as pd
    import numpy as np
    import datetime
    
    try:
        start_dt = pd.to_datetime(start)
        end_dt = pd.to_datetime(end)
    except Exception:
        today = datetime.date.today()
        start_dt = pd.to_datetime(today - datetime.timedelta(days=365*3))
        end_dt = pd.to_datetime(today)
        
    date_range = pd.date_range(start=start_dt, end=end_dt, freq='B')
    if len(date_range) < 10:
        date_range = pd.date_range(end=end_dt, periods=30, freq='B')
        
    hash_val = sum(ord(c) for c in symbol)
    base_price = 100.0 + (hash_val % 900.0)
    
    # Custom deterministic momentum settings based on ticker characters
    drift = 0.08 + (hash_val % 10) * 0.015 # 8% to 23% annual return
    volatility = 0.12 + (hash_val % 12) * 0.015 # 12% to 30% annualized vol
    
    n_days = len(date_range)
    daily_drift = drift / 252.0
    daily_vol = volatility / np.sqrt(252)
    
    np.random.seed(hash_val % 1000)
    shocks = np.random.normal(daily_drift, daily_vol, n_days)
    price_factor = np.exp(shocks)
    prices = base_price * np.cumprod(price_factor)
    
    df = pd.DataFrame(index=date_range)
    df['Close'] = prices
    df['Open'] = prices * 0.995
    df['High'] = prices * 1.015
    df['Low'] = prices * 0.985
    df['Volume'] = 500000 + (hash_val % 10) * 100000
    
    return df

@app.route('/quant/compare', methods=['POST'])
def compare_assets():
    data = request.json or {}
    symbols = data.get('symbols', [])
    mode = data.get('mode', 'sip').lower()
    frequency = data.get('frequency', 'monthly').lower()
    amount = float(data.get('amount', 5000.0))
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    prediction_years = int(data.get('prediction_years', 3))
    risk_free_rate = 0.06

    if not symbols:
        return jsonify({"error": "Symbols list is required."}), 400

    import datetime
    import pandas as pd
    import numpy as np
    
    today = datetime.date.today()
    if not end_date:
        end_date = today.strftime("%Y-%m-%d")
    if not start_date:
        start_date = (today - datetime.timedelta(days=3*365)).strftime("%Y-%m-%d")

    historical_data = {}
    metrics = {}
    individual_predictions = {}
    stock_growth_series = {}

    for symbol in symbols:
        symbol = symbol.strip().upper()
        name = symbol
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(start=start_date, end=end_date, interval="1d")
            if df.empty or len(df) < 10:
                print(f"yfinance returned empty data for {symbol}. Generating mock history...")
                df = generate_mock_history(symbol, start_date, end_date)
            else:
                df = df.sort_index()
                
            try:
                name = ticker.info.get('longName') or ticker.info.get('shortName') or symbol
            except Exception:
                mock_db_names = {
                    "AAPL": "Apple Inc.", "MSFT": "Microsoft Corporation", 
                    "GOOGL": "Alphabet Inc.", "TSLA": "Tesla, Inc.",
                    "AMZN": "Amazon.com, Inc.", "RELIANCE.NS": "Reliance Industries Limited",
                    "TCS.NS": "Tata Consultancy Services Limited", "INFY.NS": "Infosys Limited",
                    "HDFCBANK.NS": "HDFC Bank Limited"
                }
                name = mock_db_names.get(symbol, f"{symbol} Equity")
        except Exception as e:
            print(f"Error loading {symbol} from yfinance: {e}. Generating mock history...")
            df = generate_mock_history(symbol, start_date, end_date)
            
        historical_data[symbol] = (df, name)

    # Perform growth simulation for each asset
    for symbol, (df, name) in historical_data.items():
        df = df.copy()
        
        # Identify purchase dates based on frequency
        purchase_dates = []
        if mode == 'lumpsum':
            purchase_dates = [df.index[0].date()]
        else: # sip
            df_dates = df.index.to_series()
            if frequency == 'weekly':
                year_week = df_dates.dt.strftime('%G-%V')
                purchase_indices = df.groupby(year_week).apply(lambda x: x.index[0])
                purchase_dates = [i.date() for i in purchase_indices]
            else: # monthly
                year_month = df_dates.dt.strftime('%Y-%m')
                purchase_indices = df.groupby(year_month).apply(lambda x: x.index[0])
                purchase_dates = [i.date() for i in purchase_indices]

        purchase_set = set(purchase_dates)
        
        total_invested = 0.0
        shares_owned = 0.0
        cash_flows = []
        
        df['Total_Invested'] = 0.0
        df['Shares_Owned'] = 0.0
        df['Portfolio_Value'] = 0.0
        
        current_shares = 0.0
        
        for date_idx, row in df.iterrows():
            curr_date = date_idx.date()
            close_p = float(row['Close'])
            
            if curr_date in purchase_set:
                if mode == 'lumpsum' and total_invested > 0:
                    pass
                else:
                    total_invested += amount
                    current_shares += amount / close_p
                    cash_flows.append((curr_date, -amount))
                    
            df.at[date_idx, 'Total_Invested'] = total_invested
            df.at[date_idx, 'Shares_Owned'] = current_shares
            df.at[date_idx, 'Portfolio_Value'] = current_shares * close_p

        final_row = df.iloc[-1]
        final_val = float(final_row['Portfolio_Value'])
        final_invested = float(final_row['Total_Invested'])
        
        # Cash flow final value
        cash_flows.append((df.index[-1].date(), final_val))
        
        irr_val = xirr(cash_flows)
        abs_return = ((final_val - final_invested) / final_invested * 100) if final_invested > 0 else 0.0
        
        # Volatility
        stock_daily_returns = df['Close'].pct_change().dropna()
        daily_vol = stock_daily_returns.std()
        ann_vol = float(daily_vol * np.sqrt(252) * 100) if not pd.isna(daily_vol) else 20.0
        
        # Max Drawdown
        peak = df['Portfolio_Value'].cummax()
        drawdown = (df['Portfolio_Value'] - peak) / peak
        max_dd = float(drawdown.min() * 100) if not pd.isna(drawdown.min()) else 0.0
        
        # Sharpe
        sharpe_val = ((irr_val / 100) - risk_free_rate) / (ann_vol / 100) if ann_vol > 0 else 0.0

        # Resample growth history to Monthly
        resampled_df = df.resample('ME').last()
        growth_history = []
        for d_t, r_row in resampled_df.iterrows():
            if pd.isna(r_row['Portfolio_Value']):
                continue
            growth_history.append({
                "date": d_t.strftime("%Y-%m-%d"),
                "invested": float(round(r_row['Total_Invested'], 2)),
                "value": float(round(r_row['Portfolio_Value'], 2))
            })
            
        last_date_str = df.index[-1].strftime("%Y-%m-%d")
        if not growth_history or growth_history[-1]["date"] != last_date_str:
            growth_history.append({
                "date": last_date_str,
                "invested": float(round(final_invested, 2)),
                "value": float(round(final_val, 2))
            })
            
        stock_growth_series[symbol] = growth_history

        # ----------------------------------------------------
        # Monte Carlo Future Projection Simulation
        # ----------------------------------------------------
        log_returns = np.log(df['Close'] / df['Close'].shift(1)).dropna()
        if not log_returns.empty:
            mu_daily = log_returns.mean()
            var_daily = log_returns.var()
            drift_daily = mu_daily + 0.5 * var_daily
            vol_daily = log_returns.std()
            
            drift_ann = drift_daily * 252
            vol_ann = vol_daily * np.sqrt(252)
        else:
            drift_ann = 0.12
            vol_ann = 0.20
            
        # Limits check
        drift_ann = np.clip(drift_ann, -0.15, 0.35)
        vol_ann = np.clip(vol_ann, 0.08, 0.45)
        
        n_paths = 150
        n_months = prediction_years * 12
        dt = 1.0 / 12.0
        
        sim_prices = np.zeros((n_months + 1, n_paths))
        sim_prices[0, :] = float(df['Close'].iloc[-1])
        
        sim_portfolio_values = np.zeros((n_months + 1, n_paths))
        sim_portfolio_values[0, :] = final_val
        
        sim_shares = np.zeros(n_paths)
        sim_shares[:] = current_shares
        
        invested_path = np.zeros(n_months + 1)
        invested_path[0] = final_invested
        
        np.random.seed(sum(ord(c) for c in symbol) % 1000)
        
        for m in range(1, n_months + 1):
            shocks = np.random.normal(0, 1, n_paths)
            drift_term = (drift_ann - 0.5 * (vol_ann ** 2)) * dt
            diffusion_term = vol_ann * shocks * np.sqrt(dt)
            sim_prices[m, :] = sim_prices[m - 1, :] * np.exp(drift_term + diffusion_term)
            
            if mode == 'sip':
                invested_path[m] = invested_path[m - 1] + amount
                for p in range(n_paths):
                    sim_shares[p] += amount / sim_prices[m, p]
                    sim_portfolio_values[m, p] = sim_shares[p] * sim_prices[m, p]
            else: # lumpsum
                invested_path[m] = invested_path[m - 1]
                for p in range(n_paths):
                    sim_portfolio_values[m, p] = sim_shares[p] * sim_prices[m, p]

        p10_path = np.percentile(sim_portfolio_values, 10, axis=1)
        p50_path = np.percentile(sim_portfolio_values, 50, axis=1)
        p90_path = np.percentile(sim_portfolio_values, 90, axis=1)
        
        last_date = df.index[-1]
        future_dates = []
        for m in range(n_months + 1):
            future_date = last_date + pd.DateOffset(months=m)
            future_dates.append(future_date.strftime("%Y-%m-%d"))
            
        prediction_history = []
        for m in range(n_months + 1):
            prediction_history.append({
                "date": future_dates[m],
                "invested": float(round(invested_path[m], 2)),
                "p10": float(round(p10_path[m], 2)),
                "p50": float(round(p50_path[m], 2)),
                "p90": float(round(p90_path[m], 2))
            })
            
        individual_predictions[symbol] = prediction_history

        metrics[symbol] = {
            "name": name,
            "total_invested": float(round(final_invested, 2)),
            "final_value": float(round(final_val, 2)),
            "total_gain": float(round(final_val - final_invested, 2)),
            "absolute_return": float(round(abs_return, 2)),
            "irr": float(round(irr_val, 2)),
            "volatility": float(round(ann_vol, 2)),
            "sharpe": float(round(sharpe_val, 2)),
            "max_drawdown": float(round(max_dd, 2)),
            "expected_future_value": float(round(p50_path[-1], 2)),
            "pessimistic_future_value": float(round(p10_path[-1], 2)),
            "optimistic_future_value": float(round(p90_path[-1], 2)),
            "projected_gain_pct": float(round(((p50_path[-1] - invested_path[-1]) / invested_path[-1] * 100), 2)) if invested_path[-1] > 0 else 0.0
        }

    # Merge growth series for unified historical chart data
    all_dates = sorted(list(set(pt["date"] for sym in stock_growth_series for pt in stock_growth_series[sym])))
    historical_charts = []
    for dt in all_dates:
        chart_point = {"date": dt}
        invested_amt = 0.0
        for sym in stock_growth_series:
            matching_pt = next((pt for pt in stock_growth_series[sym] if pt["date"] == dt), None)
            if matching_pt:
                chart_point[sym] = matching_pt["value"]
                invested_amt = matching_pt["invested"]
        chart_point["invested"] = invested_amt
        historical_charts.append(chart_point)

    # Merge expected P50 trajectories of all stocks for predictions
    pred_dates = sorted(list(set(pt["date"] for sym in individual_predictions for pt in individual_predictions[sym])))
    prediction_charts = []
    for dt in pred_dates:
        chart_point = {"date": dt}
        invested_amt = 0.0
        for sym in individual_predictions:
            matching_pt = next((pt for pt in individual_predictions[sym] if pt["date"] == dt), None)
            if matching_pt:
                chart_point[f"{sym}_p50"] = matching_pt["p50"]
                invested_amt = matching_pt["invested"]
        chart_point["invested"] = invested_amt
        prediction_charts.append(chart_point)

    ai_critique = ""
    if api_key_configured:
        try:
            metrics_summary = {sym: {
                "name": metrics[sym]["name"],
                "total_invested": metrics[sym]["total_invested"],
                "final_value": metrics[sym]["final_value"],
                "absolute_return": metrics[sym]["absolute_return"],
                "annualized_irr": metrics[sym]["irr"],
                "volatility": metrics[sym]["volatility"],
                "sharpe": metrics[sym]["sharpe"],
                "max_drawdown": metrics[sym]["max_drawdown"]
            } for sym in metrics}
            
            predictions_summary = {sym: {
                "expected_future_value": metrics[sym]["expected_future_value"],
                "pessimistic_future_value": metrics[sym]["pessimistic_future_value"],
                "optimistic_future_value": metrics[sym]["optimistic_future_value"],
                "projected_gain_pct": metrics[sym]["projected_gain_pct"]
            } for sym in metrics}

            prompt = f"""
            You are VaultNet Wealth Coach, an unhedged personal quant and investment strategist.
            Analyze and critique this stock comparison for a long-term {mode} ({frequency if mode == 'sip' else 'lumpsum'}) investment of {amount:,.2f} from {start_date} to {end_date}.
            
            Stock Metrics:
            {json.dumps(metrics_summary, indent=2)}
            
            Future Prediction (Expected median vs pessimistic vs optimistic in {prediction_years} years):
            {json.dumps(predictions_summary, indent=2)}
            
            Write an opinionated, unhedged 2-paragraph critique of these options. Highlight the risk-reward profiles (Sharpe vs Volatility) and which asset is more suitable for consistent wealth compounding. Suggest a clear path forward.
            Do NOT include advisor warnings, disclosures, or boilerplate phrases. Be direct.
            """

            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            ai_critique = response.text.strip()
        except Exception as e:
            print(f"Gemini comparison critique failed, falling back: {e}")

    if not ai_critique:
        best_cagr_sym = max(metrics.keys(), key=lambda s: metrics[s]["irr"])
        best_sharpe_sym = max(metrics.keys(), key=lambda s: metrics[s]["sharpe"])
        lowest_vol_sym = min(metrics.keys(), key=lambda s: metrics[s]["volatility"])
        
        p1 = f"Historical analysis indicates that {metrics[best_cagr_sym]['name']} ({best_cagr_sym}) was the top-performing vehicle in this cohort, delivering a money-weighted annualized return (IRR) of {metrics[best_cagr_sym]['irr']}%. From a risk-adjusted perspective, {metrics[best_sharpe_sym]['name']} ({best_sharpe_sym}) leads the group with a Sharpe ratio of {metrics[best_sharpe_sym]['sharpe']}, reflecting the most efficient return-generation per unit of risk. For capital preservation, {metrics[lowest_vol_sym]['name']} ({lowest_vol_sym}) showed the lowest volatility ({metrics[lowest_vol_sym]['volatility']}%), offering a smoother journey but with lower compounding speed."
        p2 = f"Under the Monte Carlo projection for the next {prediction_years} years, the expected final values indicate that {best_cagr_sym} is likely to remain the momentum leader, reaching an expected portfolio value of {metrics[best_cagr_sym]['expected_future_value']:,.2f}. However, in a market downturn (10th percentile outcome), {lowest_vol_sym} presents a more robust floor. For long-term automated {mode.upper()} strategies, we recommend allocating a core position to {best_sharpe_sym} due to its superior risk efficiency, supplemented by {best_cagr_sym} for growth velocity."
        ai_critique = f"{p1}\n\n{p2}"

    return jsonify({
        "mode": mode,
        "frequency": frequency,
        "amount": amount,
        "start_date": start_date,
        "end_date": end_date,
        "prediction_years": prediction_years,
        "symbols": list(metrics.keys()),
        "metrics": metrics,
        "historical_charts": historical_charts,
        "prediction_charts": prediction_charts,
        "individual_predictions": individual_predictions,
        "ai_critique": ai_critique
    })

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))
    if port == 5001:
        # Port 5001 is used by the gateway, so default local run of quant-engine back to 8000
        port = 8000
    app.run(host='0.0.0.0', port=port, debug=False)

