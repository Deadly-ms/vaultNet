import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Activity, 
  ShieldAlert, 
  Compass, 
  Play, 
  Clock, 
  CheckCircle, 
  Radio, 
  AlertTriangle,
  Plus,
  Sparkles,
  Layers
} from 'lucide-react';

const COLORS = ['#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#71717a'];

const QuantConsole = () => {
  const { fetchSecure } = useAuth();
  const [activeTab, setActiveTab] = useState('risk');
  
  // Risk Audit States
  const [riskData, setRiskData] = useState(null);
  const [riskLoading, setRiskLoading] = useState(true);

  // Signals States
  const [signals, setSignals] = useState([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

  // Backtester Sandbox States
  const [symbol, setSymbol] = useState('RELIANCE.NS');
  const [strategy, setStrategy] = useState('sma');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Strategy Params
  const [shortWindow, setShortWindow] = useState('50');
  const [longWindow, setLongWindow] = useState('200');
  const [rsiPeriod, setRsiPeriod] = useState('14');
  const [rsiOversold, setRsiOversold] = useState('30');
  const [rsiOverbought, setRsiOverbought] = useState('70');

  // Backtester Output
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtesting, setBacktesting] = useState(false);
  const [backtestHistory, setBacktestHistory] = useState([]);
  const [backtestError, setBacktestError] = useState('');

  // Stock Comparison States
  const [compareSymbols, setCompareSymbols] = useState('RELIANCE.NS, INFY.NS');
  const [compareMode, setCompareMode] = useState('sip');
  const [compareFrequency, setCompareFrequency] = useState('monthly');
  const [compareAmount, setCompareAmount] = useState('5000');
  const [compareYears, setCompareYears] = useState('3');
  const [compareResult, setCompareResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [compareChartTab, setCompareChartTab] = useState('history');
  const [selectedPredictionStock, setSelectedPredictionStock] = useState('');

  const PRESETS = [
    { name: 'Indian Tech Stars', symbols: 'INFY.NS, TCS.NS, WIPRO.NS' },
    { name: 'Indian Bluechips', symbols: 'RELIANCE.NS, HDFCBANK.NS, ICICIBANK.NS' },
    { name: 'US Tech Giants', symbols: 'AAPL, MSFT, GOOGL' },
    { name: 'Growth Leaders', symbols: 'TSLA, AMZN, NVDA' }
  ];

  // Fetch Risk Report
  const loadRiskReport = async () => {
    try {
      setRiskLoading(true);
      const res = await fetchSecure('/quant/risk');
      const data = await res.json();
      setRiskData(data);
    } catch (err) {
      console.error('Error fetching risk metrics:', err);
    } finally {
      setRiskLoading(false);
    }
  };

  // Fetch Signals
  const loadTechnicalSignals = async () => {
    try {
      setSignalsLoading(true);
      const res = await fetchSecure('/quant/signals');
      const data = await res.json();
      setSignals(data);
    } catch (err) {
      console.error('Error fetching tech signals:', err);
    } finally {
      setSignalsLoading(false);
    }
  };

  // Fetch Saved Backtests
  const loadBacktestHistory = async () => {
    try {
      const res = await fetchSecure('/quant/backtests/history');
      const data = await res.json();
      setBacktestHistory(data);
    } catch (err) {
      console.error('Error fetching backtest logs:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'risk') loadRiskReport();
    if (activeTab === 'signals') loadTechnicalSignals();
    if (activeTab === 'backtest') loadBacktestHistory();
    if (activeTab === 'compare' && !compareResult) {
      runComparisonAPI(compareSymbols);
    }
  }, [activeTab]);

  const handleRunComparison = async (e) => {
    if (e) e.preventDefault();
    await runComparisonAPI(compareSymbols);
  };

  const handleRunComparisonDirect = async (symbolsStr) => {
    await runComparisonAPI(symbolsStr);
  };

  const runComparisonAPI = async (symbolsStr) => {
    if (!symbolsStr.trim()) {
      setCompareError('Please enter at least one ticker symbol.');
      return;
    }
    
    setComparing(true);
    setCompareResult(null);
    setCompareError('');
    
    const symbolsArray = symbolsStr
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);
      
    if (symbolsArray.length === 0) {
      setCompareError('Please enter valid ticker symbols.');
      setComparing(false);
      return;
    }
    
    const today = new Date();
    const start = new Date();
    start.setFullYear(today.getFullYear() - parseInt(compareYears));
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];

    try {
      const res = await fetchSecure('/quant/compare', {
        method: 'POST',
        body: JSON.stringify({
          symbols: symbolsArray,
          mode: compareMode,
          frequency: compareFrequency,
          amount: parseFloat(compareAmount) || 5000.0,
          start_date: startDateStr,
          end_date: endDateStr,
          prediction_years: parseInt(compareYears)
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setCompareResult(data);
        if (data.symbols && data.symbols.length > 0) {
          setSelectedPredictionStock(data.symbols[0]);
        }
      } else {
        setCompareError(data.error || 'Failed to fetch comparison data.');
      }
    } catch (err) {
      console.error(err);
      setCompareError('Network error executing stock comparison. Make sure backend services are online.');
    } finally {
      setComparing(false);
    }
  };

  const handleRunBacktest = async (e) => {
    e.preventDefault();
    if (!symbol || !startDate || !endDate) {
      alert('Symbol and date range are required.');
      return;
    }

    setBacktesting(true);
    setBacktestResult(null);
    setBacktestError('');

    const params = strategy === 'sma' 
      ? { short: parseInt(shortWindow), long: parseInt(longWindow) }
      : { period: parseInt(rsiPeriod), oversold: parseFloat(rsiOversold), overbought: parseFloat(rsiOverbought) };

    try {
      const res = await fetchSecure('/quant/backtest', {
        method: 'POST',
        body: JSON.stringify({
          symbol: symbol.toUpperCase().trim(),
          strategy,
          params,
          start_date: startDate,
          end_date: endDate
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Backtests endpoint returns created audit row, which contains results_json
        const parsedResults = typeof data.results_json === 'string' 
          ? JSON.parse(data.results_json) 
          : data.results_json;
        setBacktestResult({
          ...parsedResults,
          symbol: symbol.toUpperCase().trim(),
          strategy: strategy
        });
        loadBacktestHistory();
      } else {
        setBacktestError(data.error || 'Failed executing backtest.');
      }
    } catch (err) {
      setBacktestError('Network error executing backtest. Is the Python service offline?');
    } finally {
      setBacktesting(false);
    }
  };

  const formatPercentage = (val) => {
    return `${val >= 0 ? '+' : ''}${parseFloat(val).toFixed(2)}%`;
  };

  const getSignalBadgeClass = (sig) => {
    if (sig.includes('Buy')) return 'badge-credit';
    if (sig.includes('Sell')) return 'badge-debit';
    return 'badge-neutral';
  };

  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title Header */}
      <div>
        <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Quant Console</h1>
        <p style={{ color: 'var(--text-muted)' }}>Perform asset risk audits, backtest algorithmic strategies, and scan indicators.</p>
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--card-border)',
        gap: '24px',
        marginBottom: '8px'
      }}>
        {['risk', 'backtest', 'signals', 'compare'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 4px',
              background: 'transparent',
              border: 'none',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '0.95rem',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'var(--transition)'
            }}
          >
            {tab === 'risk' ? 'Risk Audit' : tab === 'backtest' ? 'Backtester Sandbox' : tab === 'signals' ? 'Technical Signals' : 'Stock & SIP Comparison'}
            {activeTab === tab && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
                background: 'var(--primary-gradient)'
              }} />
            )}
          </button>
        ))}
      </div>

      {/* WORKSPACE 1: Portfolio Risk Audit */}
      {activeTab === 'risk' && (
        <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {riskLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Analyzing portfolio volatility models...</div>
          ) : (
            <>
              {/* KPIs Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                {/* Volatility */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ background: 'var(--danger-glow)', color: 'var(--danger)', borderRadius: '12px', padding: '16px' }}>
                    <Activity size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ANNUALIZED VOLATILITY</span>
                    <h3 style={{ fontSize: '1.6rem', marginTop: '4px', color: '#f87171' }}>{riskData.volatility}%</h3>
                  </div>
                </div>

                {/* Sharpe Ratio */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '12px', padding: '16px' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SHARPE RATIO (1Y)</span>
                    <h3 style={{ fontSize: '1.6rem', marginTop: '4px', color: '#60a5fa' }}>{riskData.sharpe}</h3>
                  </div>
                </div>

                {/* Max Drawdown */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ background: 'var(--warning-glow)', color: 'var(--warning)', borderRadius: '12px', padding: '16px' }}>
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MAX HISTORICAL DRAWDOWN</span>
                    <h3 style={{ fontSize: '1.6rem', marginTop: '4px', color: '#f59e0b' }}>{riskData.max_drawdown}%</h3>
                  </div>
                </div>
              </div>

              {/* Sector allocations and explanation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', alignItems: 'start' }}>
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Portfolio Risk Breakdown</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '16px' }}>
                    Risk indicators are evaluated using daily close price covariance logs over the last 1 year. 
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                      <strong>Annualized Volatility ({riskData.volatility}%):</strong> Represents the variance of your portfolio value. Lower numbers suggest consistent returns, whereas levels above 20% represent high-growth stock exposure.
                    </div>
                    <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                      <strong>Sharpe Ratio ({riskData.sharpe}):</strong> Measures risk-adjusted returns (assuming a 6% risk-free rate). A Sharpe ratio above 1.0 is considered good, and above 2.0 is considered institutional-grade.
                    </div>
                    <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                      <strong>Max Drawdown ({riskData.max_drawdown}%):</strong> Shows the maximum peak-to-trough decline of your holdings over the last 12 months. Highlights your worst-case market scenario.
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Sector Concentration</h3>
                  <div style={{ width: '100%', height: '240px' }}>
                    {riskData.sectors.length === 0 ? (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-dark)' }}>No sector metrics.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={riskData.sectors}
                            cx="50%"
                            cy="45%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {riskData.sectors.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderColor: 'var(--card-border)', color: 'var(--text)' }}
                            formatter={(value) => [`₹${value.toLocaleString()}`, 'Cost Basis']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* WORKSPACE 2: Backtesting Sandbox */}
      {activeTab === 'backtest' && (
        <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top Form and Sandbox */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '24px', alignItems: 'start' }}>
            {/* Strategy settings form */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={18} color="var(--primary)" />
                Backtester Settings
              </h3>

              <form onSubmit={handleRunBacktest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Ticker Symbol</label>
                  <input 
                    type="text" 
                    value={symbol} 
                    onChange={(e) => setSymbol(e.target.value)} 
                    className="form-input" 
                    placeholder="e.g. TCS.NS, TSLA"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Strategy Model</label>
                  <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="form-select">
                    <option value="sma">Moving Average Crossover (SMA)</option>
                    <option value="rsi">Mean Reversion (RSI)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" style={{ fontSize: '0.8rem' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input" style={{ fontSize: '0.8rem' }} />
                  </div>
                </div>

                {/* Strategy specific parameters */}
                {strategy === 'sma' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid var(--card-border)', paddingTop: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Short Window</label>
                      <input type="number" value={shortWindow} onChange={(e) => setShortWindow(e.target.value)} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Long Window</label>
                      <input type="number" value={longWindow} onChange={(e) => setLongWindow(e.target.value)} className="form-input" />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--card-border)', paddingTop: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">RSI Period</label>
                      <input type="number" value={rsiPeriod} onChange={(e) => setRsiPeriod(e.target.value)} className="form-input" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Oversold (Buy)</label>
                        <input type="number" value={rsiOversold} onChange={(e) => setRsiOversold(e.target.value)} className="form-input" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Overbought (Sell)</label>
                        <input type="number" value={rsiOverbought} onChange={(e) => setRsiOverbought(e.target.value)} className="form-input" />
                      </div>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={backtesting} className="btn btn-primary" style={{ width: '100%', height: '46px', marginTop: '8px' }}>
                  {backtesting ? 'Running Backtester...' : 'Execute Backtest'}
                </button>
              </form>
            </div>

            {/* Backtest Results and Chart display */}
            <div className="glass-panel" style={{ padding: '24px', minHeight: '430px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Backtest Sandbox Graph</h3>
              
              {backtestError && (
                <div style={{ padding: '16px', background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem' }}>
                  {backtestError}
                </div>
              )}

              {!backtestResult && !backtesting && !backtestError && (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dark)', fontSize: '0.9rem' }}>
                  Configure parameters on the left and run to chart backtest results.
                </div>
              )}

              {backtesting && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ border: '3px solid rgba(59, 130, 246, 0.1)', borderTop: '3px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
                  Running quant strategy backtests... Seeding historical data hypertable.
                </div>
              )}

              {backtestResult && !backtesting && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                  {/* Strategy stats banner */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>STRATEGY RETURN</span>
                      <h4 style={{ fontSize: '1.25rem', color: backtestResult.strategy_return >= 0 ? '#34d399' : '#f87171', marginTop: '4px' }}>
                        {formatPercentage(backtestResult.strategy_return)}
                      </h4>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BUY & HOLD RETURN</span>
                      <h4 style={{ fontSize: '1.25rem', color: backtestResult.market_return >= 0 ? '#34d399' : '#f87171', marginTop: '4px' }}>
                        {formatPercentage(backtestResult.market_return)}
                      </h4>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SHARPE RATIO</span>
                      <h4 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginTop: '4px' }}>{backtestResult.sharpe}</h4>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MAX DRAWDOWN</span>
                      <h4 style={{ fontSize: '1.25rem', color: '#f59e0b', marginTop: '4px' }}>-{Math.abs(backtestResult.max_drawdown)}%</h4>
                    </div>
                  </div>

                  {/* Sandbox Returns chart */}
                  <div style={{ width: '100%', height: '260px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={backtestResult.history} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                        <XAxis dataKey="date" stroke="var(--text-dark)" style={{ fontSize: '0.7rem' }} />
                        <YAxis stroke="var(--text-dark)" style={{ fontSize: '0.7rem' }} formatter={(val) => `${val}%`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', borderColor: 'var(--card-border)', color: 'var(--text)' }}
                          formatter={(value) => [`${value}%`, '']}
                        />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: '0.75rem' }} />
                        <Line type="monotone" dataKey="strategy_cum" stroke="var(--primary)" strokeWidth={2} name={`${backtestResult.symbol} Strategy (${backtestResult.strategy.toUpperCase()})`} dot={false} />
                        <Line type="monotone" dataKey="market_cum" stroke="var(--text-dark)" strokeWidth={1.5} name="Buy & Hold Market" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audit History Logs table */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} />
              Saved Backtests Audit Log
            </h3>
            
            <div className="table-container">
              {backtestHistory.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dark)' }}>No saved strategy backtests audits in ledger.</div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Executed At</th>
                      <th>Strategy</th>
                      <th>Symbol</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th style={{ textAlign: 'right' }}>Strategy Return</th>
                      <th style={{ textAlign: 'right' }}>Buy & Hold</th>
                      <th style={{ textAlign: 'right' }}>Sharpe</th>
                      <th style={{ textAlign: 'right' }}>Max DD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtestHistory.map((item) => {
                      const res = typeof item.results_json === 'string' ? JSON.parse(item.results_json) : item.results_json;
                      return (
                        <tr key={item.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                            {new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{item.strategy_name}</span>
                          </td>
                          <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{res.symbol || 'TCS.NS'}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{item.start_date.split('T')[0]}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{item.end_date.split('T')[0]}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: res.strategy_return >= 0 ? '#34d399' : '#f87171', fontFamily: 'var(--font-mono)' }}>
                            {formatPercentage(res.strategy_return)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {formatPercentage(res.market_return)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                            {res.sharpe}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>
                            -{Math.abs(res.max_drawdown)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WORKSPACE 3: Technical Indicators and Signal scans */}
      {activeTab === 'signals' && (
        <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={18} color="#10b981" />
              Automated Technical Scanner
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
              Real-time indicators calculated over daily historical intervals for items in your watchlist.
            </p>

            <div className="table-container">
              {signalsLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Calculating indicators: SMAs, RSI, Golden Cross patterns...</div>
              ) : signals.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Your watchlist is empty. Add symbols in the Watchlist tab to see indicators scans.
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th style={{ textAlign: 'right' }}>Live Price</th>
                      <th style={{ textAlign: 'right' }}>SMA (50 Days)</th>
                      <th style={{ textAlign: 'right' }}>SMA (200 Days)</th>
                      <th style={{ textAlign: 'right' }}>RSI (14 Days)</th>
                      <th style={{ textAlign: 'center' }}>Scanned Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((sig, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{sig.symbol}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                          ₹{parseFloat(sig.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          ₹{sig.sma50 ? parseFloat(sig.sma50).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {sig.sma200 > 0 ? `₹${parseFloat(sig.sma200).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontFamily: 'var(--font-mono)', 
                          fontWeight: 600,
                          color: sig.rsi < 30 ? '#34d399' : sig.rsi > 70 ? '#f87171' : 'var(--text)' 
                        }}>
                          {parseFloat(sig.rsi).toFixed(1)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${getSignalBadgeClass(sig.signal)}`}>
                            {sig.signal}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WORKSPACE 4: Stock & SIP Comparison */}
      {activeTab === 'compare' && (
        <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Comparison Settings Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--primary)" />
              Asset Comparison Console
            </h3>
            
            <form onSubmit={handleRunComparison} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Presets Row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '4px' }}>Presets:</span>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setCompareSymbols(preset.symbols);
                      setTimeout(() => {
                        handleRunComparisonDirect(preset.symbols);
                      }, 0);
                    }}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '16px',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.color = 'var(--text)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--card-border)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ticker Symbols (comma separated)</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>e.g. TSLA, Apple, Reliance</span>
                  </label>
                  <input
                    type="text"
                    value={compareSymbols}
                    onChange={(e) => setCompareSymbols(e.target.value)}
                    className="form-input"
                    placeholder="e.g. AAPL, MSFT, TSLA"
                    style={{ height: '42px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Investment Mode</label>
                  <select
                    value={compareMode}
                    onChange={(e) => setCompareMode(e.target.value)}
                    className="form-select"
                    style={{ height: '42px' }}
                  >
                    <option value="sip">SIP (Periodic)</option>
                    <option value="lumpsum">Lumpsum (One-time)</option>
                  </select>
                </div>

                {compareMode === 'sip' ? (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">SIP Frequency</label>
                    <select
                      value={compareFrequency}
                      onChange={(e) => setCompareFrequency(e.target.value)}
                      className="form-select"
                      style={{ height: '42px' }}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">SIP Frequency</label>
                    <select disabled className="form-select" style={{ height: '42px', opacity: 0.5 }}>
                      <option>N/A (Lumpsum)</option>
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    {compareMode === 'sip' ? 'Periodic Amount' : 'Initial Amount'}
                  </label>
                  <input
                    type="number"
                    value={compareAmount}
                    onChange={(e) => setCompareAmount(e.target.value)}
                    className="form-input"
                    placeholder="Amount"
                    style={{ height: '42px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Investment Period</label>
                  <select
                    value={compareYears}
                    onChange={(e) => setCompareYears(e.target.value)}
                    className="form-select"
                    style={{ height: '42px' }}
                  >
                    <option value="1">1 Year</option>
                    <option value="3">3 Years</option>
                    <option value="5">5 Years</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={comparing}
                className="btn btn-primary"
                style={{ alignSelf: 'flex-end', height: '44px', padding: '0 24px', width: '200px' }}
              >
                {comparing ? 'Analyzing Assets...' : 'Run Comparison'}
              </button>
            </form>
          </div>

          {/* Error Message banner */}
          {compareError && (
            <div style={{ padding: '16px', background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem' }}>
              {compareError}
            </div>
          )}

          {/* Loading state */}
          {comparing && (
            <div className="glass-panel" style={{ padding: '80px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
              <div style={{ border: '3px solid rgba(59, 130, 246, 0.1)', borderTop: '3px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
              <div>Running heavy Monte Carlo simulations & compiling historical performance logs...</div>
            </div>
          )}

          {/* Results Grid & Critique */}
          {compareResult && !comparing && (
            <>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '-8px' }}>Simulation Results</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {compareResult.symbols.map((sym, index) => {
                  const m = compareResult.metrics[sym];
                  const cardColor = COLORS[index % COLORS.length];
                  return (
                    <div key={sym} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: `4px solid ${cardColor}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontSize: '1.4rem', color: cardColor, fontFamily: 'var(--font-mono)' }}>{sym}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.name}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="badge badge-neutral" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                            Sharpe: {m.sharpe}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-dark)', display: 'block', textTransform: 'uppercase' }}>Current Value</span>
                          <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                            ₹{m.final_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-dark)', display: 'block', textTransform: 'uppercase' }}>Total Invested</span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            ₹{m.total_invested.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-dark)', display: 'block', fontSize: '0.65rem' }}>ANNUALIZED RETURN (XIRR)</span>
                          <span style={{ fontWeight: 600, color: m.irr >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '1.05rem' }}>
                            {m.irr >= 0 ? '+' : ''}{m.irr}%
                          </span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-dark)', display: 'block', fontSize: '0.65rem' }}>ABS GAIN / RETURN</span>
                          <span style={{ fontWeight: 600, color: m.absolute_return >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            ₹{m.total_gain.toLocaleString()} ({m.absolute_return >= 0 ? '+' : ''}{m.absolute_return}%)
                          </span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-dark)', display: 'block', fontSize: '0.65rem' }}>VOLATILITY (1Y)</span>
                          <span style={{ fontWeight: 500 }}>{m.volatility}%</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-dark)', display: 'block', fontSize: '0.65rem' }}>MAX DRAWDOWN</span>
                          <span style={{ fontWeight: 500, color: '#f59e0b' }}>-{Math.abs(m.max_drawdown)}%</span>
                        </div>
                      </div>

                      <div style={{ marginTop: '4px', paddingTop: '12px', borderTop: '1px dashed var(--card-border)', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', padding: '10px' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-dark)', fontWeight: 600, letterSpacing: '0.05em' }}>
                          FUTURE PROJECTION ({compareYears}Y EXPECTED)
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: '1.15rem' }}>
                            ₹{m.expected_future_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          <span className="badge badge-credit" style={{ fontSize: '0.7rem' }}>
                            {m.projected_gain_pct >= 0 ? '+' : ''}{m.projected_gain_pct}% Projected
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '4px' }}>
                          <span>Pessimistic (P10): ₹{m.pessimistic_future_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          <span>Optimistic (P90): ₹{m.optimistic_future_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Charts & AI Verdict Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', alignItems: 'start' }}>
                <div className="glass-panel" style={{ padding: '24px', minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.1rem' }}>Growth & Projection Charts</h3>
                    
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '2px', border: '1px solid var(--card-border)' }}>
                      {[
                        { id: 'history', label: 'Historical Growth' },
                        { id: 'p50', label: 'Expected Future (P50)' },
                        { id: 'mc', label: 'Monte Carlo Pathways' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setCompareChartTab(t.id)}
                          style={{
                            padding: '6px 12px',
                            background: compareChartTab === t.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                            color: compareChartTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: 1, minHeight: '280px', display: 'flex', flexDirection: 'column' }}>
                    {compareChartTab === 'history' && (
                      <div style={{ width: '100%', height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={compareResult.historical_charts} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                            <XAxis dataKey="date" stroke="var(--text-dark)" style={{ fontSize: '0.7rem' }} />
                            <YAxis stroke="var(--text-dark)" style={{ fontSize: '0.7rem' }} formatter={(val) => `₹${val.toLocaleString()}`} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#18181b', borderColor: 'var(--card-border)', color: 'var(--text)' }}
                              formatter={(value, name) => [`₹${value.toLocaleString()}`, name]}
                            />
                            <Legend iconSize={8} wrapperStyle={{ fontSize: '0.75rem', marginTop: '10px' }} />
                            {compareResult.symbols.map((sym, index) => (
                              <Line 
                                key={sym} 
                                type="monotone" 
                                dataKey={sym} 
                                stroke={COLORS[index % COLORS.length]} 
                                strokeWidth={2.5} 
                                name={`${sym} Value`} 
                                dot={false} 
                              />
                            ))}
                            <Line 
                              type="monotone" 
                              dataKey="invested" 
                              stroke="var(--text-dark)" 
                              strokeWidth={1.5} 
                              strokeDasharray="4 4" 
                              name="Total Invested" 
                              dot={false} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {compareChartTab === 'p50' && (
                      <div style={{ width: '100%', height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={compareResult.prediction_charts} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                            <XAxis dataKey="date" stroke="var(--text-dark)" style={{ fontSize: '0.7rem' }} />
                            <YAxis stroke="var(--text-dark)" style={{ fontSize: '0.7rem' }} formatter={(val) => `₹${val.toLocaleString()}`} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#18181b', borderColor: 'var(--card-border)', color: 'var(--text)' }}
                              formatter={(value, name) => [`₹${value.toLocaleString()}`, name.replace('_p50', ' (Expected)')]}
                            />
                            <Legend iconSize={8} wrapperStyle={{ fontSize: '0.75rem', marginTop: '10px' }} />
                            {compareResult.symbols.map((sym, index) => (
                              <Line 
                                key={sym} 
                                type="monotone" 
                                dataKey={`${sym}_p50`} 
                                stroke={COLORS[index % COLORS.length]} 
                                strokeWidth={2.5} 
                                name={`${sym} Expected (P50)`} 
                                dot={false} 
                              />
                            ))}
                            <Line 
                              type="monotone" 
                              dataKey="invested" 
                              stroke="var(--text-dark)" 
                              strokeWidth={1.5} 
                              strokeDasharray="4 4" 
                              name="Invested Growth" 
                              dot={false} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {compareChartTab === 'mc' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Confidence Intervals for:</span>
                          <select 
                            value={selectedPredictionStock} 
                            onChange={(e) => setSelectedPredictionStock(e.target.value)}
                            className="form-select"
                            style={{ width: '160px', height: '32px', padding: '0 8px', fontSize: '0.8rem', margin: 0 }}
                          >
                            {compareResult.symbols.map(sym => (
                              <option key={sym} value={sym}>{sym}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div style={{ width: '100%', height: '260px' }}>
                          {selectedPredictionStock && compareResult.individual_predictions[selectedPredictionStock] && (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={compareResult.individual_predictions[selectedPredictionStock]} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                                <XAxis dataKey="date" stroke="var(--text-dark)" style={{ fontSize: '0.7rem' }} />
                                <YAxis stroke="var(--text-dark)" style={{ fontSize: '0.7rem' }} formatter={(val) => `₹${val.toLocaleString()}`} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#18181b', borderColor: 'var(--card-border)', color: 'var(--text)' }}
                                  formatter={(value, name) => [`₹${value.toLocaleString()}`, name]}
                                />
                                <Legend iconSize={8} wrapperStyle={{ fontSize: '0.75rem', marginTop: '10px' }} />
                                <Line type="monotone" dataKey="p90" stroke="#34d399" strokeWidth={2} name="Optimistic Case (P90)" dot={false} />
                                <Line type="monotone" dataKey="p50" stroke="#60a5fa" strokeWidth={2} name="Expected Case (P50)" dot={false} />
                                <Line type="monotone" dataKey="p10" stroke="#f87171" strokeWidth={2} name="Pessimistic Case (P10)" dot={false} />
                                <Line type="monotone" dataKey="invested" stroke="var(--text-dark)" strokeWidth={1.5} strokeDasharray="4 4" name="Invested Capital" dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} color="#8b5cf6" />
                    Coach Comparative Verdict
                  </h3>
                  
                  <div style={{
                    flex: 1,
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    color: 'var(--text-muted)',
                    whiteSpace: 'pre-line',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    {compareResult.ai_critique}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--primary-glow)', borderRadius: '8px', padding: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <AlertTriangle size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <div>
                      Monte Carlo simulations are computed using daily historical log covariance parameters. Standard deviation estimates are cap-adjusted to prevent explosive scaling. Past performance is not indicative of future returns.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
};

export default QuantConsole;
