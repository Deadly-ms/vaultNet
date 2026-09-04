import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, Sliders, Trash2, X, Settings } from 'lucide-react';

const CATEGORIES = ['Food', 'Rent', 'Utilities', 'Entertainment', 'Investment', 'Shopping', 'Salary', 'Uncategorized'];

const TransactionsPage = () => {
  const { fetchSecure } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  
  // Loading & states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter States
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modals
  const [showAddTx, setShowAddTx] = useState(false);
  const [showBudgets, setShowBudgets] = useState(false);

  // Form States (Transaction)
  const [txAccount, setTxAccount] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState('debit');
  const [txCategory, setTxCategory] = useState('Uncategorized');
  const [txDesc, setTxDesc] = useState('');

  // Form States (Budget)
  const [bgCategory, setBgCategory] = useState('Food');
  const [bgLimit, setBgLimit] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Construct filter query parameters
      const params = new URLSearchParams();
      if (filterAccount) params.append('account_id', filterAccount);
      if (filterCategory) params.append('category', filterCategory);
      if (filterType) params.append('type', filterType);
      params.append('limit', '100');

      const [txRes, accRes, bgRes] = await Promise.all([
        fetchSecure(`/transactions?${params.toString()}`),
        fetchSecure('/accounts'),
        fetchSecure('/budgets')
      ]);

      const txData = await txRes.json();
      const accData = await accRes.json();
      const bgData = await bgRes.json();

      setTransactions(txData);
      setAccounts(accData);
      setBudgets(bgData);

      // Pre-select first account if creating a transaction
      if (accData.length > 0 && !txAccount) {
        setTxAccount(accData[0].id.toString());
      }
    } catch (err) {
      console.error('Error fetching ledger details:', err);
      setError('Failed to sync transactions database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterAccount, filterCategory, filterType]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!txAccount || !txDate || !txAmount || !txType) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      const response = await fetchSecure('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: parseInt(txAccount),
          date: txDate,
          amount: parseFloat(txAmount),
          type: txType,
          category: txCategory,
          description: txDesc,
          source: 'manual'
        })
      });

      if (response.ok) {
        setShowAddTx(false);
        // Reset state
        setTxAmount('');
        setTxDesc('');
        fetchData();
      } else {
        const errData = await response.json();
        alert('Error: ' + errData.error);
      }
    } catch (err) {
      alert('Network error adding transaction.');
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!confirm('Are you sure you want to delete this ledger entry? Respective account balance will be reverted.')) {
      return;
    }

    try {
      const response = await fetchSecure(`/transactions/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchData();
      } else {
        alert('Failed to delete transaction.');
      }
    } catch (err) {
      alert('Network error deleting transaction.');
    }
  };

  const handleUpsertBudget = async (e) => {
    e.preventDefault();
    if (!bgCategory || bgLimit === '') {
      alert('Please select category and specify limit.');
      return;
    }

    try {
      const response = await fetchSecure('/budgets', {
        method: 'POST',
        body: JSON.stringify({
          category: bgCategory,
          monthly_limit: parseFloat(bgLimit)
        })
      });

      if (response.ok) {
        setBgLimit('');
        fetchData();
      } else {
        alert('Failed to register budget.');
      }
    } catch (err) {
      alert('Network error adding budget.');
    }
  };

  const handleDeleteBudget = async (id) => {
    try {
      const response = await fetchSecure(`/budgets/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchData();
      } else {
        alert('Failed to delete budget limit.');
      }
    } catch (err) {
      alert('Network error removing budget.');
    }
  };

  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Transaction Ledger</h1>
          <p style={{ color: 'var(--text-muted)' }}>Audit cash flows, categorize transactions, and configure monthly limits.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowBudgets(true)} className="btn btn-secondary">
            <Settings size={16} />
            Manage Budgets
          </button>
          <button onClick={() => setShowAddTx(true)} className="btn btn-primary">
            <PlusCircle size={16} />
            Record Transaction
          </button>
        </div>
      </div>

      {/* Filter Options Header */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
          <Sliders size={16} />
          FILTERS:
        </div>

        {/* Account Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <select 
            value={filterAccount} 
            onChange={(e) => setFilterAccount(e.target.value)}
            className="form-select"
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <option value="">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} (₹{parseFloat(acc.current_balance).toLocaleString()})</option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="form-select"
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="form-select"
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <option value="">All Flow Types</option>
            <option value="debit">Outflows (Debits)</option>
            <option value="credit">Inflows (Credits)</option>
          </select>
        </div>
      </div>

      {/* Main Table Grid */}
      <div className="table-container glass-panel">
        {transactions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No transaction records matched the current criteria.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Category</th>
                <th>Description</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{tx.account_name}</td>
                  <td>
                    <span className="badge badge-neutral">{tx.category}</span>
                  </td>
                  <td>{tx.description || <span style={{ color: 'var(--text-dark)' }}>No description</span>}</td>
                  <td>
                    <span className={`badge ${tx.type === 'credit' ? 'badge-credit' : 'badge-debit'}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    fontWeight: 600, 
                    color: tx.type === 'credit' ? '#34d399' : '#f87171' 
                  }}>
                    {tx.type === 'credit' ? '+' : '-'} ₹{parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDeleteTransaction(tx.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-dark)', cursor: 'pointer', transition: 'var(--transition)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dark)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL: Record Transaction */}
      {showAddTx && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '32px', position: 'relative' }}>
            <button 
              onClick={() => setShowAddTx(false)}
              style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Add Ledger Record</h3>

            <form onSubmit={handleAddTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Debit/Credit Account</label>
                <select 
                  value={txAccount} 
                  onChange={(e) => setTxAccount(e.target.value)} 
                  className="form-select"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input 
                    type="date" 
                    value={txDate} 
                    onChange={(e) => setTxDate(e.target.value)} 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Flow Type</label>
                  <select 
                    value={txType} 
                    onChange={(e) => setTxType(e.target.value)} 
                    className="form-select"
                  >
                    <option value="debit">Debit (Expense)</option>
                    <option value="credit">Credit (Income)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Amount (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    value={txAmount} 
                    onChange={(e) => setTxAmount(e.target.value)} 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select 
                    value={txCategory} 
                    onChange={(e) => setTxCategory(e.target.value)} 
                    className="form-select"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Swiggy delivery, Salary credit..."
                  value={txDesc} 
                  onChange={(e) => setTxDesc(e.target.value)} 
                  className="form-input" 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                Add Ledger Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manage Budgets */}
      {showBudgets && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '32px', position: 'relative' }}>
            <button 
              onClick={() => setShowBudgets(false)}
              style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Monthly Budget Settings</h3>

            {/* Set Budget Form */}
            <form onSubmit={handleUpsertBudget} style={{
              display: 'flex', gap: '16px', alignItems: 'flex-end',
              borderBottom: '1px solid var(--card-border)', paddingBottom: '24px', marginBottom: '20px'
            }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Category</label>
                <select 
                  value={bgCategory} 
                  onChange={(e) => setBgCategory(e.target.value)} 
                  className="form-select"
                >
                  {CATEGORIES.filter(c => c !== 'Salary').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Monthly Limit (₹)</label>
                <input 
                  type="number" 
                  placeholder="Limit amount"
                  value={bgLimit} 
                  onChange={(e) => setBgLimit(e.target.value)} 
                  className="form-input" 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ height: '46px' }}>
                Set Limit
              </button>
            </form>

            {/* Existing Budgets List */}
            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ACTIVE BUDGET LIMITS</h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {budgets.length === 0 ? (
                <div style={{ padding: '20px', textStyle: 'center', color: 'var(--text-dark)' }}>No budgets set yet.</div>
              ) : (
                budgets.map(bg => (
                  <div key={bg.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: '8px'
                  }}>
                    <span>{bg.category}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontWeight: 600 }}>₹{parseFloat(bg.monthly_limit).toLocaleString()}</span>
                      <button 
                        onClick={() => handleDeleteBudget(bg.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dark)', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dark)'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TransactionsPage;
