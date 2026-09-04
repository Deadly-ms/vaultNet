import React from 'react';
import { Briefcase, ArrowUpRight, ArrowDownRight, Compass, Shield } from 'lucide-react';

const PortfolioSummary = ({ totalValuation = 0, totalCostBasis = 0, cashBalance = 0 }) => {
  const pnl = totalValuation - totalCostBasis;
  const pnlPercent = totalCostBasis > 0 ? (pnl / totalCostBasis) * 100 : 0;
  const totalWealth = cashBalance + totalValuation;
  
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const isProfit = pnl >= 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '20px',
      marginBottom: '24px'
    }}>
      {/* Portfolio Value */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '8px', padding: '12px' }}>
          <Briefcase size={20} />
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PORTFOLIO VALUE</span>
          <h4 style={{ fontSize: '1.4rem', marginTop: '2px' }}>{formatCurrency(totalValuation)}</h4>
        </div>
      </div>

      {/* Total Cost Basis */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', borderRadius: '8px', padding: '12px' }}>
          <Shield size={20} />
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>TOTAL COST BASIS</span>
          <h4 style={{ fontSize: '1.4rem', marginTop: '2px' }}>{formatCurrency(totalCostBasis)}</h4>
        </div>
      </div>

      {/* Net Profit & Loss */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          background: isProfit ? 'var(--success-glow)' : 'var(--danger-glow)',
          color: isProfit ? 'var(--success)' : 'var(--danger)',
          borderRadius: '8px',
          padding: '12px'
        }}>
          {isProfit ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>UNREALIZED P&L</span>
          <h4 style={{ 
            fontSize: '1.4rem', 
            marginTop: '2px', 
            color: isProfit ? '#34d399' : '#f87171' 
          }}>
            {isProfit ? '+' : ''}{formatCurrency(pnl)}
            <span style={{ fontSize: '0.8rem', marginLeft: '6px', fontWeight: 500 }}>
              ({pnlPercent.toFixed(2)}%)
            </span>
          </h4>
        </div>
      </div>

      {/* Combined Net Worth */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px', padding: '12px' }}>
          <Compass size={20} />
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>NET WEALTH (CASH + ASSETS)</span>
          <h4 style={{ fontSize: '1.4rem', marginTop: '2px', color: '#34d399' }}>{formatCurrency(totalWealth)}</h4>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSummary;
