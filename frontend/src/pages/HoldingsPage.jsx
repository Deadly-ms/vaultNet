import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import PortfolioSummary from '../components/PortfolioSummary';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend 
} from 'recharts';
import { Plus, Trash2, HelpCircle, RefreshCw } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

const HoldingsPage = () => {
  const { fetchSecure } = useAuth();
  
  // Data States
  const [holdings, setHoldings] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [livePrices, setLivePrices] = useState({});
  
  // Loading & UI States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [symbol, setSymbol] = useState('');
  const [assetType, setAssetType] = useState('stock');
  const [quantity, setQuantity] = useState('');
  const [avgBuyPrice, setAvgBuyPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [accountId, setAccountId] = useState('');

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      // Fetch base holdings, accounts, and overview statistics
      const [holdingsRes, accountsRes, statsRes] = await Promise.all([
        fetchSecure('/holdings'),
        fetchSecure('/accounts'),
        fetchSecure('/stats/overview')
      ]);

      const holdingsData = await holdingsRes.json();
      const accountsData = await accountsRes.json();
      const statsData = await statsRes.json();

      setAccounts(accountsData);
      setCashBalance(statsData.cashBalance || 0);

      // Pre-select first account if not set
      if (accountsData.length > 0 && !accountId) {
        setAccountId(accountsData[0].id.toString());
      }

      // Fetch live prices for holdings in parallel
      const priceMap = {};
      const uniqueSymbols = Array.from(new Set(holdingsData.map(h => `${h.symbol}:${h.asset_type}`)));

      await Promise.all(uniqueSymbols.map(async (key) => {
        const [sym, type] = key.split(':');
        try {
          const res = await fetchSecure(`/market/price?symbol=${sym}&type=${type}`);
          const quote = await res.json();
          priceMap[key] = quote.price || 0.0;
        } catch (err) {
          console.error(`Error resolving price for ${sym}:`, err);
          priceMap[key] = 0.0;
        }
      }));

      setLivePrices(priceMap);
      setHoldings(holdingsData);
    } catch (err) {
      console.error('Error fetching holdings info:', err);
      setError('Failed to fetch holdings list or live pricing feeds.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accountId || !symbol || !quantity || !avgBuyPrice) {
      alert('Please fill in Symbol, Quantity, and Avg Buy Price.');
      return;
    }

    try {
      const response = await fetchSecure('/holdings', {
        method: 'POST',
        body: JSON.stringify({
          account_id: parseInt(accountId),
          symbol: symbol.toUpperCase().trim(),
          asset_type: assetType,
          quantity: parseFloat(quantity),
          avg_buy_price: parseFloat(avgBuyPrice),
          purchase_date: purchaseDate || null
        })
      });

      if (response.ok) {
        setSymbol('');
        setQuantity('');
        setAvgBuyPrice('');
        setPurchaseDate('');
        fetchData();
      } else {
        const err = await response.json();
        alert('Error: ' + err.error);
      }
    } catch (err) {
      alert('Network error adding holding.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this asset holding?')) {
      return;
    }

    try {
      const response = await fetchSecure(`/holdings/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchData();
      } else {
        alert('Failed to delete holding.');
      }
    } catch (err) {
      alert('Network error deleting holding.');
    }
  };

  // Calculations
  let totalCostBasis = 0.0;
  let totalValuation = 0.0;

  const holdingsWithPrices = holdings.map(h => {
    const key = `${h.symbol}:${h.asset_type}`;
    const livePrice = livePrices[key] || parseFloat(h.avg_buy_price); // Fallback to cost
    const cost = parseFloat(h.quantity) * parseFloat(h.avg_buy_price);
    const value = parseFloat(h.quantity) * livePrice;
    
    totalCostBasis += cost;
    totalValuation += value;

    return {
      ...h,
      livePrice,
      cost,
      value,
      pnl: value - cost,
      pnlPercent: cost > 0 ? ((value - cost) / cost) * 100 : 0
    };
  });

  // Ratios for Pie Chart
  const stocksVal = holdingsWithPrices.filter(h => h.asset_type === 'stock').reduce((s, h) => s + h.value, 0);
  const mfVal = holdingsWithPrices.filter(h => h.asset_type === 'mutual_fund').reduce((s, h) => s + h.value, 0);
  const etfVal = holdingsWithPrices.filter(h => h.asset_type === 'etf').reduce((s, h) => s + h.value, 0);

  const allocationData = [
    { name: 'Cash Accounts', value: cashBalance },
    { name: 'Equity Stocks', value: stocksVal },
    { name: 'Mutual Funds', value: mfVal },
    { name: 'ETFs', value: etfVal }
  ].filter(item => item.value > 0);

  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Asset Portfolio</h1>
          <p style={{ color: 'var(--text-muted)' }}>Monitor asset allocations, quantities, and cost positions.</p>
        </div>

        <button 
          onClick={() => fetchData(true)} 
          disabled={refreshing} 
          className="btn btn-secondary"
          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing Market...' : 'Refresh Quotes'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Summary metrics header cards */}
      <PortfolioSummary 
        totalValuation={totalValuation} 
        totalCostBasis={totalCostBasis} 
        cashBalance={cashBalance} 
      />

      {/* Forms and Allocation Split Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Manual Record Position Form */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} />
            Record Asset Purchase
          </h3>

          <form onSubmit={handleSubmit} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div className="form-group">
              <label className="form-label">Brokerage Account</label>
              <select 
                value={accountId} 
                onChange={(e) => setAccountId(e.target.value)} 
                className="form-select"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Asset Type</label>
              <select 
                value={assetType} 
                onChange={(e) => setAssetType(e.target.value)} 
                className="form-select"
              >
                <option value="stock">Equity Stock</option>
                <option value="mutual_fund">Mutual Fund</option>
                <option value="etf">ETF (Exchange Traded Fund)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Symbol / Code 
                {assetType === 'mutual_fund' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginLeft: '6px' }}>
                    (6-digit AMFI Code)
                  </span>
                )}
              </label>
              <input 
                type="text" 
                placeholder={assetType === 'mutual_fund' ? "e.g. 120716" : "e.g. RELIANCE.NS, VOO"} 
                value={symbol} 
                onChange={(e) => setSymbol(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input 
                type="date" 
                value={purchaseDate} 
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Quantity</label>
              <input 
                type="number" 
                step="0.0001"
                placeholder="0.00" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Avg Buy Price (₹)</label>
              <input 
                type="number" 
                step="0.01"
                placeholder="0.00" 
                value={avgBuyPrice} 
                onChange={(e) => setAvgBuyPrice(e.target.value)}
                className="form-input"
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ gridColumn: 'span 2', width: '100%', height: '46px', marginTop: '8px' }}
            >
              Record Asset Purchase
            </button>
          </form>

          {/* Help assistance text */}
          {assetType === 'mutual_fund' && (
            <div style={{
              display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', marginTop: '16px'
            }}>
              <HelpCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                We lookup Indian Mutual Funds by their AMFI identifier. You can look up your 6-digit scheme code by searching for your fund name on public mutual fund pages or the AMFI India website.
              </div>
            </div>
          )}
        </div>

        {/* Asset Allocation Chart */}
        <div className="glass-panel" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Asset Allocation</h3>
          <div style={{ width: '100%', height: '220px', flex: 1 }}>
            {allocationData.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-dark)' }}>
                No active assets or account balances.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: 'var(--card-border)', color: 'var(--text)' }}
                    formatter={(value) => [`₹${value.toLocaleString()}`, '']}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Holdings Grid */}
      <div className="table-container glass-panel">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Syncing live stock prices & NAV details...</div>
        ) : holdingsWithPrices.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No recorded asset positions. Add your holdings above to track.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Type</th>
                <th>Brokerage</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Avg Price</th>
                <th style={{ textAlign: 'right' }}>Live Price</th>
                <th style={{ textAlign: 'right' }}>Cost Value</th>
                <th style={{ textAlign: 'right' }}>Market Value</th>
                <th style={{ textAlign: 'right' }}>P&L</th>
                <th style={{ textAlign: 'center' }}>Remove</th>
              </tr>
            </thead>
            <tbody>
              {holdingsWithPrices.map((h) => {
                const isMF = h.asset_type === 'mutual_fund';
                const hasProfit = h.pnl >= 0;
                return (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }} title={h.symbol}>
                      {h.symbol}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                        {h.asset_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{h.account_name}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {parseFloat(h.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      ₹{parseFloat(h.avg_buy_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                      ₹{h.livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      ₹{h.cost.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      ₹{h.value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ 
                      textAlign: 'right', 
                      fontWeight: 600, 
                      fontFamily: 'var(--font-mono)',
                      color: hasProfit ? '#34d399' : '#f87171' 
                    }}>
                      {hasProfit ? '+' : ''}₹{h.pnl.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      <div style={{ fontSize: '0.7rem', fontWeight: 500 }}>
                        {hasProfit ? '+' : ''}{h.pnlPercent.toFixed(1)}%
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => handleDelete(h.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dark)', cursor: 'pointer', transition: 'var(--transition)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dark)'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
};

export default HoldingsPage;
