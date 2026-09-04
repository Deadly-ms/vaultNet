import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, RefreshCw, BarChart2 } from 'lucide-react';

const WatchlistPage = () => {
  const { fetchSecure } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes] = useState({});
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Selected item news drawer states
  const [selectedItem, setSelectedItem] = useState(null);
  const [newsSummary, setNewsSummary] = useState('');
  const [newsHeadlines, setNewsHeadlines] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  // Form State
  const [symbol, setSymbol] = useState('');
  const [assetType, setAssetType] = useState('stock');

  const fetchNewsSummary = async (item) => {
    setSelectedItem(item);
    setNewsLoading(true);
    setNewsSummary('');
    setNewsHeadlines([]);
    
    try {
      const quoteName = quotes[item.symbol]?.name || '';
      const res = await fetchSecure(`/ai/news?symbol=${item.symbol}&name=${encodeURIComponent(quoteName)}&type=${item.asset_type}`);
      const data = await res.json();
      if (res.ok) {
        setNewsSummary(data.summary);
        setNewsHeadlines(data.headlines || []);
      } else {
        setNewsSummary(data.error || 'Failed to fetch news summary.');
      }
    } catch (err) {
      console.error('Error loading news details:', err);
      setNewsSummary('Failed to communicate with news summarization server.');
    } finally {
      setNewsLoading(false);
    }
  };

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const res = await fetchSecure('/watchlist');
      const watchlistData = await res.json();

      // Resolve quotes and fundamentals in parallel
      const quotesMap = {};
      await Promise.all(watchlistData.map(async (item) => {
        try {
          const qRes = await fetchSecure(`/market/price?symbol=${item.symbol}&type=${item.asset_type}`);
          const qData = await qRes.json();
          quotesMap[item.symbol] = qData;
        } catch (err) {
          console.error(`Error fetching quote for ${item.symbol}:`, err);
          quotesMap[item.symbol] = {
            price: 0.0,
            name: 'Symbol Quote Unavailable',
            currency: 'INR',
            pe: null,
            pb: null,
            dividend_yield: null
          };
        }
      }));

      setQuotes(quotesMap);
      setWatchlist(watchlistData);
    } catch (err) {
      console.error('Error fetching watchlist data:', err);
      setError('Failed to fetch watchlist symbols.');
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
    if (!symbol) {
      alert('Please enter a symbol.');
      return;
    }

    try {
      const response = await fetchSecure('/watchlist', {
        method: 'POST',
        body: JSON.stringify({
          symbol: symbol.toUpperCase().trim(),
          asset_type: assetType
        })
      });

      if (response.ok) {
        setSymbol('');
        fetchData();
      } else {
        const err = await response.json();
        alert('Error: ' + err.error);
      }
    } catch (err) {
      alert('Network error adding to watchlist.');
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetchSecure(`/watchlist/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchData();
      } else {
        alert('Failed to remove item from watchlist.');
      }
    } catch (err) {
      alert('Network error removing watchlist item.');
    }
  };

  const formatCurrency = (val, currencyCode) => {
    const symbolMap = { 'INR': '₹', 'USD': '$' };
    const prefix = symbolMap[currencyCode] || '₹';
    return `${prefix}${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Asset Watchlist</h1>
          <p style={{ color: 'var(--text-muted)' }}>Watchlist tickers for automated market price syncing and analyst reports.</p>
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

      {/* Manual Entry Form */}
      <div className="glass-panel" style={{ padding: '24px', maxWidth: '600px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} />
          Add Symbol to Watchlist
        </h3>

        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'end'
        }}>
          <div className="form-group" style={{ flex: 1.5, marginBottom: 0 }}>
            <label className="form-label">Ticker / AMFI Code</label>
            <input 
              type="text" 
              placeholder={assetType === 'mutual_fund' ? "e.g. 120716" : "e.g. RELIANCE.NS, TSLA"} 
              value={symbol} 
              onChange={(e) => setSymbol(e.target.value)}
              className="form-input"
              style={{ padding: '10px 14px' }}
            />
          </div>

          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Asset Type</label>
            <select 
              value={assetType} 
              onChange={(e) => setAssetType(e.target.value)} 
              className="form-select"
              style={{ padding: '10px 14px' }}
            >
              <option value="stock">Equity Stock</option>
              <option value="mutual_fund">Mutual Fund</option>
              <option value="etf">ETF</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ height: '46px' }}>
            Watch
          </button>
        </form>
      </div>

      {/* Watchlist Grid */}
      <div className="table-container glass-panel">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Syncing live valuations & valuations fundamentals...</div>
        ) : watchlist.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No watchlist entries. Watch some assets above to start monitoring.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Ticker Symbol</th>
                <th>Asset Name</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Live Quote</th>
                <th style={{ textAlign: 'right' }}>P/E Ratio</th>
                <th style={{ textAlign: 'right' }}>P/B Ratio</th>
                <th style={{ textAlign: 'right' }}>Div Yield (%)</th>
                <th style={{ textAlign: 'center' }}>Remove</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((item) => {
                const quote = quotes[item.symbol] || {};
                return (
                  <tr 
                    key={item.id} 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => fetchNewsSummary(item)}
                    title="Click to view AI News Briefing"
                  >
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{item.symbol}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{quote.name || item.symbol}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                        {item.asset_type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                      {quote.price ? formatCurrency(quote.price, quote.currency) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {quote.pe ? parseFloat(quote.pe).toFixed(1) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {quote.pb ? parseFloat(quote.pb).toFixed(1) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#10b981' }}>
                      {quote.dividend_yield ? `${parseFloat(quote.dividend_yield).toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
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

      {/* Watchlist News Summary Side Drawer */}
      {selectedItem && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '450px',
          background: 'rgba(15, 15, 20, 0.95)', backdropFilter: 'blur(16px)',
          borderLeft: '1px solid var(--card-border)', boxShadow: '-10px 0 30px rgba(0,0,0,0.6)',
          padding: '32px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '20px',
          animation: 'drawerSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', margin: 0 }}>{selectedItem.symbol} Briefing</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{quotes[selectedItem.symbol]?.name || 'Live Quote'}</span>
            </div>
            <button 
              onClick={() => setSelectedItem(null)} 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Close
            </button>
          </div>
          
          {/* Live quotes display inside drawer */}
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Latest Price</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)' }}>
              {quotes[selectedItem.symbol]?.price ? formatCurrency(quotes[selectedItem.symbol].price, quotes[selectedItem.symbol].currency) : '—'}
            </span>
          </div>
          
          {/* Scrollable Contents */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '10px', textTransform: 'uppercase' }}>AI News Summary</h4>
              {newsLoading ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dark)', padding: '12px' }}>
                  Coach is parsing Google News feeds and generating summary...
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '16px', background: 'var(--primary-glow)', border: '1px solid rgba(59, 130, 246, 0.15)', fontSize: '0.88rem', lineHeight: '1.45' }}>
                  {newsSummary}
                </div>
              )}
            </div>
            
            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '10px', textTransform: 'uppercase' }}>Recent Headlines</h4>
              {newsLoading ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dark)', padding: '12px' }}>Loading articles list...</div>
              ) : newsHeadlines.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dark)', padding: '12px' }}>No headlines matched this ticker search.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {newsHeadlines.map((art, idx) => (
                    <a 
                      key={idx} 
                      href={art.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{
                        display: 'block', padding: '12px', borderRadius: '8px', 
                        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)',
                        color: 'white', textDecoration: 'none', fontSize: '0.82rem', transition: 'var(--transition)'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: '4px', lineHeight: '1.3' }}>{art.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>{art.pubDate}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

    </div>
  );
};

export default WatchlistPage;
