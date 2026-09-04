import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  UploadCloud, 
  Briefcase, 
  Eye, 
  LogOut,
  TrendingUp,
  BarChart2,
  Wallet
} from 'lucide-react';

const Navbar = ({ activePage, setActivePage }) => {
  const { logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Ledger', icon: ArrowLeftRight },
    { id: 'upload', label: 'Upload Statement', icon: UploadCloud },
    { id: 'holdings', label: 'Holdings', icon: Briefcase },
    { id: 'watchlist', label: 'Watchlist', icon: Eye },
    { id: 'accounts', label: 'Manage Accounts', icon: Wallet },
    { id: 'quant', label: 'Quant Sandbox', icon: BarChart2 }
  ];

  return (
    <nav className="glass-panel" style={{
      width: '260px',
      minHeight: 'calc(100vh - 40px)',
      margin: '20px 0 20px 20px',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px',
      position: 'sticky',
      top: '20px'
    }}>
      {/* Brand Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '40px',
        padding: '0 8px'
      }}>
        <div style={{
          background: 'var(--primary-gradient)',
          borderRadius: '8px',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
        }}>
          <TrendingUp size={20} color="white" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0, fontFamily: 'var(--font-mono)' }}>VAULTNET</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em' }}>WEALTH PLATFORM</span>
        </div>
      </div>

      {/* Nav Menu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                border: 'none',
                background: isActive ? 'var(--primary-gradient)' : 'transparent',
                color: isActive ? 'white' : 'var(--text-muted)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.95rem',
                fontWeight: isActive ? 600 : 500,
                transition: 'var(--transition)',
                boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Logout button at bottom */}
      <button
        onClick={logout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          border: '1px solid var(--card-border)',
          background: 'rgba(239, 68, 68, 0.05)',
          color: '#f87171',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          width: '100%',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.95rem',
          fontWeight: 500,
          transition: 'var(--transition)',
          marginTop: 'auto'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
        }}
      >
        <LogOut size={18} />
        Exit System
      </button>
    </nav>
  );
};

export default Navbar;
