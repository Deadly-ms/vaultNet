import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Landmark, 
  Briefcase, 
  CreditCard, 
  Wallet,
  X,
  Plus
} from 'lucide-react';

const AccountsPage = () => {
  const { fetchSecure } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState('0.00');
  const [currency, setCurrency] = useState('INR');
  
  // Edit modal states
  const [editingAccount, setEditingAccount] = useState(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('bank');
  const [editBalance, setEditBalance] = useState('0.00');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchSecure('/accounts');
      if (!res.ok) throw new Error('Failed to fetch accounts.');
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      setError(err.message || 'Error loading accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    try {
      const res = await fetchSecure('/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          current_balance: parseFloat(balance) || 0.00,
          currency
        })
      });

      if (!res.ok) throw new Error('Failed to create account.');
      
      setName('');
      setType('bank');
      setBalance('0.00');
      setIsAddOpen(false);
      fetchAccounts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    if (!editingAccount || !editName.trim()) return;

    try {
      const res = await fetchSecure(`/accounts/${editingAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          type: editType,
          current_balance: parseFloat(editBalance) || 0.00
        })
      });

      if (!res.ok) throw new Error('Failed to update account.');
      
      setEditingAccount(null);
      fetchAccounts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAccount = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This will also delete all transactions linked to this account.`)) {
      return;
    }

    try {
      const res = await fetchSecure(`/accounts/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete account.');
      fetchAccounts();
    } catch (err) {
      alert(err.message);
    }
  };

  const getAccountIcon = (acctType) => {
    switch (acctType) {
      case 'bank': return <Landmark size={20} color="var(--primary)" />;
      case 'broker': return <Briefcase size={20} color="#fbbf24" />;
      case 'credit_card': return <CreditCard size={20} color="#f87171" />;
      case 'wallet': return <Wallet size={20} color="#34d399" />;
      default: return <Landmark size={20} color="var(--text)" />;
    }
  };

  const formatBalance = (val, acctType) => {
    const num = parseFloat(val) || 0;
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(Math.abs(num));

    if (num < 0 || acctType === 'credit_card') {
      return <span style={{ color: '#f87171' }}>-{formatted}</span>;
    }
    return <span style={{ color: '#34d399' }}>{formatted}</span>;
  };

  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Manage Accounts</h1>
          <p style={{ color: 'var(--text-muted)' }}>Configure your liquid bank balances, brokerage nodes, wallets, and credit cards.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} /> Add Account
        </button>
      </div>

      {error && <div className="glass-panel" style={{ padding: '16px', color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}>{error}</div>}

      {/* Grid List */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>Loading ledger accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No accounts configured. Click "Add Account" to configure your starting positions.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {accounts.map((acc) => (
            <div 
              key={acc.id}
              className="glass-panel hover-scale"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative'
              }}
            >
              {/* Account details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid var(--card-border)'
                }}>
                  {getAccountIcon(acc.type)}
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{acc.name}</h3>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    textTransform: 'uppercase', 
                    color: 'var(--text-muted)', 
                    fontWeight: 600,
                    letterSpacing: '0.05em'
                  }}>
                    {acc.type.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Balance */}
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
                  Current Balance
                </span>
                <span style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {formatBalance(acc.current_balance, acc.type)}
                </span>
              </div>

              {/* Actions footer */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '12px',
                borderTop: '1px solid var(--card-border)',
                paddingTop: '16px',
                marginTop: '8px'
              }}>
                <button 
                  onClick={() => {
                    setEditingAccount(acc);
                    setEditName(acc.name);
                    setEditType(acc.type);
                    setEditBalance(acc.current_balance);
                  }}
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Edit3 size={12} /> Edit
                </button>
                <button 
                  onClick={() => handleDeleteAccount(acc.id, acc.name)}
                  className="btn btn-secondary" 
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '0.75rem', 
                    color: '#f87171', 
                    borderColor: 'rgba(239,68,68,0.1)',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px' 
                  }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Drawer Modal */}
      {isAddOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel animated-fade" style={{ width: '450px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Configure New Account</h3>
              <button onClick={() => setIsAddOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="input-label">Account Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. HDFC Salary Account"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Account Type</label>
                  <select 
                    className="form-input"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="bank">Bank (Savings/Current)</option>
                    <option value="broker">Brokerage (Stocks/MFs)</option>
                    <option value="credit_card">Credit Card (Debt)</option>
                    <option value="wallet">Cash Wallet</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Currency</label>
                  <select 
                    className="form-input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Starting Balance</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-input"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Drawer Modal */}
      {editingAccount && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel animated-fade" style={{ width: '450px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Edit Account</h3>
              <button onClick={() => setEditingAccount(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="input-label">Account Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required 
                />
              </div>

              <div>
                <label className="input-label">Account Type</label>
                <select 
                  className="form-input"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                >
                  <option value="bank">Bank (Savings/Current)</option>
                  <option value="broker">Brokerage (Stocks/MFs)</option>
                  <option value="credit_card">Credit Card (Debt)</option>
                  <option value="wallet">Cash Wallet</option>
                </select>
              </div>

              <div>
                <label className="input-label">Current Balance</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-input"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <button type="button" onClick={() => setEditingAccount(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AccountsPage;
