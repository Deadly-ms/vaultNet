import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line
} from 'recharts';
import { Wallet, Compass, Landmark, TrendingUp, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#71717a'];

const DashboardPage = () => {
  const { fetchSecure } = useAuth();
  const [stats, setStats] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [refreshingInsights, setRefreshingInsights] = useState(false);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [statsRes, budgetsRes] = await Promise.all([
        fetchSecure('/stats/overview'),
        fetchSecure('/budgets/summary')
      ]);

      const statsData = await statsRes.json();
      const budgetsData = await budgetsRes.json();

      setStats(statsData);
      setBudgets(budgetsData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to fetch dashboard metrics. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshingInsights(true);
      else setInsightsLoading(true);
      
      const res = await fetchSecure(`/ai/insights${forceRefresh ? '?refresh=true' : ''}`);
      const data = await res.json();
      setInsights(data.insights || []);
    } catch (err) {
      console.error('Error fetching AI insights:', err);
    } finally {
      setInsightsLoading(false);
      setRefreshingInsights(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchInsights();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        Loading dashboard metrics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius)' }}>
        <p style={{ color: '#f87171' }}>{error}</p>
        <button onClick={fetchData} className="btn btn-secondary" style={{ marginTop: '12px' }}>Retry Connection</button>
      </div>
    );
  }

  const { 
    netWorth = 0, 
    cashBalance = 0, 
    holdingsValuation = 0,
    categorySpend = [], 
    monthlyDebit = 0, 
    monthlyCredit = 0, 
    dailyTrend = [],
    netWorthTrend = []
  } = stats || {};

  // Calculate savings rate
  const savingsRate = monthlyCredit > 0 ? ((monthlyCredit - monthlyDebit) / monthlyCredit) * 100 : 0;

  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Personal Ledger</h1>
        <p style={{ color: 'var(--text-muted)' }}>Real-time overview of net worth, active budgets, and recent expense categories.</p>
      </div>

      {/* AI Insights Section */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--primary)" />
              AI Wealth critique
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
              Direct suggestions and financial analysis compiled from your active ledger.
            </p>
          </div>
          <button 
            onClick={() => fetchInsights(true)} 
            disabled={insightsLoading || refreshingInsights}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}
          >
            <RefreshCw size={14} className={refreshingInsights ? 'animate-spin' : ''} style={{ animation: refreshingInsights ? 'spin 1s linear infinite' : 'none' }} />
            {refreshingInsights ? 'Analyzing...' : 'Re-Analyze Portfolio'}
          </button>
        </div>

        {insightsLoading ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '10px 0' }}>
            Wealth Coach is scanning sector weightings and budget items...
          </div>
        ) : insights.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dark)', padding: '10px 0' }}>
            No insights available. Record more asset values and set budgets to prompt the critic.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {insights.map((insight, idx) => {
              const borderColors = {
                warning: 'rgba(239, 68, 68, 0.2)',
                success: 'rgba(16, 185, 129, 0.2)',
                info: 'rgba(59, 130, 246, 0.2)'
              };
              const bgColors = {
                warning: 'rgba(239, 68, 68, 0.03)',
                success: 'rgba(16, 185, 129, 0.03)',
                info: 'rgba(59, 130, 246, 0.03)'
              };
              const textColors = {
                warning: '#f87171',
                success: '#34d399',
                info: '#60a5fa'
              };

              return (
                <div 
                  key={idx} 
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    border: `1px solid ${borderColors[insight.type] || 'var(--card-border)'}`,
                    background: bgColors[insight.type] || 'rgba(255,255,255,0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <h4 style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 600, 
                    color: textColors[insight.type] || 'var(--text)' 
                  }}>
                    {insight.title}
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {insight.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px'
      }}>
        {/* Net Worth */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', borderRadius: '12px', padding: '16px' }}>
            <Wallet size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>LIVE NET WEALTH</span>
            <h3 style={{ fontSize: '1.6rem', marginTop: '4px', color: '#34d399' }}>{formatCurrency(netWorth)}</h3>
          </div>
        </div>

        {/* Cash Reserves */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '12px', padding: '16px' }}>
            <Landmark size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>CASH RESERVES</span>
            <h3 style={{ fontSize: '1.6rem', marginTop: '4px' }}>{formatCurrency(cashBalance)}</h3>
          </div>
        </div>

        {/* Invested Holdings */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '12px', padding: '16px' }}>
            <Compass size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>HOLDINGS VALUATION</span>
            <h3 style={{ fontSize: '1.6rem', marginTop: '4px', color: '#a78bfa' }}>{formatCurrency(holdingsValuation)}</h3>
          </div>
        </div>

        {/* Savings Rate */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '12px', padding: '16px' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SAVINGS RATE</span>
            <h3 style={{ fontSize: '1.6rem', marginTop: '4px', color: savingsRate >= 0 ? '#f59e0b' : '#ef4444' }}>
              {savingsRate.toFixed(1)}%
            </h3>
          </div>
        </div>
      </div>

      {/* Row 2: Net Worth History Trend (Full Width) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '24px' }}>Net Wealth Trend (30 Days)</h3>
        <div style={{ width: '100%', height: '320px' }}>
          {netWorthTrend.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-dark)' }}>
              No historical trend values yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="date" stroke="var(--text-dark)" style={{ fontSize: '0.75rem' }} />
                <YAxis stroke="var(--text-dark)" style={{ fontSize: '0.75rem' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: 'var(--card-border)', color: 'var(--text)' }}
                  formatter={(value) => [`₹${value.toLocaleString()}`, '']}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '0.75rem', marginTop: '12px' }} />
                <Area type="monotone" dataKey="cash" stackId="1" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCash)" name="Cash Reserves" />
                <Area type="monotone" dataKey="assets" stackId="1" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorAssets)" name="Assets (Holdings)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Main Charts Area */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
      }}>
        {/* Daily Cash Flow Area Chart */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '24px' }}>Inflow & Outflow (30 Days)</h3>
          <div style={{ width: '100%', height: '280px' }}>
            {dailyTrend.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-dark)' }}>
                No recent transaction logs.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCredit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDebit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-dark)" style={{ fontSize: '0.75rem' }} />
                  <YAxis stroke="var(--text-dark)" style={{ fontSize: '0.75rem' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: 'var(--card-border)', color: 'var(--text)' }}
                    formatter={(value) => [`₹${value}`, '']}
                  />
                  <Area type="monotone" dataKey="credit" stroke="#10b981" fillOpacity={1} fill="url(#colorCredit)" name="Inflows" />
                  <Area type="monotone" dataKey="debit" stroke="#ef4444" fillOpacity={1} fill="url(#colorDebit)" name="Outflows" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expense Category Pie Chart */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '24px' }}>Category Breakdown</h3>
          <div style={{ width: '100%', height: '200px', flex: 1 }}>
            {categorySpend.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-dark)' }}>
                No debit transactions categorized this month.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySpend}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={66}
                    paddingAngle={4}
                    dataKey="total"
                    nameKey="category"
                  >
                    {categorySpend.map((entry, index) => (
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
                    wrapperStyle={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Budgets Progress List */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Budget Allocations (Monthly)</h3>
        
        {budgets.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No monthly budgets defined. Go to Ledger to start tracking categories.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {budgets.map((b) => {
              const spent = parseFloat(b.current_spend);
              const limit = parseFloat(b.monthly_limit);
              const percentage = Math.min((spent / limit) * 100, 100);
              const isOver = spent > limit;

              return (
                <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {b.category}
                      {isOver && <AlertTriangle size={14} color="#ef4444" />}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <strong>{formatCurrency(spent)}</strong> of {formatCurrency(limit)}
                    </span>
                  </div>

                  {/* Progress bar container */}
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {/* Active progress */}
                    <div style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: isOver 
                        ? 'var(--danger)' 
                        : percentage > 85 
                          ? 'var(--warning)' 
                          : 'var(--primary-gradient)',
                      borderRadius: '4px',
                      transition: 'width 0.5s ease-out'
                    }} />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: isOver ? 'var(--danger)' : 'var(--text-dark)' }}>
                    <span>{percentage.toFixed(0)}% Utilized</span>
                    {isOver && <span>Overlimit by {formatCurrency(spent - limit)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default DashboardPage;
