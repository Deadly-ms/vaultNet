import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import UploadPage from './pages/UploadPage';
import HoldingsPage from './pages/HoldingsPage';
import WatchlistPage from './pages/WatchlistPage';
import AiCoachChat from './components/AiCoachChat';
import QuantConsole from './pages/QuantConsole';
import AccountsPage from './pages/AccountsPage';

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#09090b',
        color: '#a1a1aa',
        fontFamily: 'monospace',
        fontSize: '0.9rem'
      }}>
        Initializing VaultNet Portal...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'transactions':
        return <TransactionsPage />;
      case 'upload':
        return <UploadPage />;
      case 'holdings':
        return <HoldingsPage />;
      case 'watchlist':
        return <WatchlistPage />;
      case 'accounts':
        return <AccountsPage />;
      case 'quant':
        return <QuantConsole />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="app-container">
      <Navbar activePage={activePage} setActivePage={setActivePage} />
      <main className="main-content">
        {renderPage()}
      </main>
      <AiCoachChat />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
