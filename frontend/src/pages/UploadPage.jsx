import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Upload, Loader2, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';

const CATEGORIES = ['Food', 'Rent', 'Utilities', 'Entertainment', 'Investment', 'Shopping', 'Salary', 'Uncategorized'];

const UploadPage = () => {
  const { fetchSecure } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  
  // File Upload states
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  
  // Parsed results confirmation grid
  const [parsedTxs, setParsedTxs] = useState([]);
  const [successCount, setSuccessCount] = useState(null);

  useEffect(() => {
    const fetchAccountsList = async () => {
      try {
        const res = await fetchSecure('/accounts');
        const data = await res.json();
        setAccounts(data);
        if (data.length > 0) {
          setSelectedAccount(data[0].id.toString());
        }
      } catch (err) {
        console.error('Error fetching accounts:', err);
      }
    };
    fetchAccountsList();
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setError('');
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    setError('');
    const selected = e.target.files[0];
    if (selected) {
      validateAndSetFile(selected);
    }
  };

  const validateAndSetFile = (f) => {
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf', 'csv', 'xls', 'xlsx'].includes(ext)) {
      setError('Unsupported file type. Please upload a PDF, CSV, or Excel file.');
      return;
    }
    setFile(f);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select or drop a file first.');
      return;
    }
    if (!selectedAccount) {
      setError('Please select the destination account.');
      return;
    }

    setParsing(true);
    setError('');
    setWarningMsg('');
    setSuccessCount(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetchSecure('/parser/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        if (data.transactions && Array.isArray(data.transactions)) {
          // Normalize and attach account ID and temporary keys
          const normalized = data.transactions.map((tx, idx) => ({
            id: `temp-${idx}-${Date.now()}`,
            account_id: parseInt(selectedAccount),
            date: tx.date || new Date().toISOString().split('T')[0],
            amount: parseFloat(tx.amount) || 0,
            type: tx.type === 'credit' ? 'credit' : 'debit',
            category: tx.category || 'Uncategorized',
            description: tx.description || 'Statement Transaction',
            raw_text: tx.raw_text || ''
          }));
          setParsedTxs(normalized);
        } else {
          setError('Document parsed successfully, but no transactions were identified.');
        }
      } else {
        if (data.error && data.suggestion) {
          setWarningMsg(data.error + " " + data.suggestion);
        } else {
          setError(data.error || 'Failed to parse statement.');
        }
      }
    } catch (err) {
      console.error('Error uploading statement:', err);
      setError('Network communication failed during statement parsing.');
    } finally {
      setParsing(false);
    }
  };

  // Grid Cell updates
  const handleUpdateGridCell = (id, field, value) => {
    setParsedTxs(prev => prev.map(tx => {
      if (tx.id === id) {
        let updatedVal = value;
        if (field === 'amount') {
          updatedVal = parseFloat(value) || 0;
        }
        return { ...tx, [field]: updatedVal };
      }
      return tx;
    }));
  };

  // Add empty row
  const handleAddGridRow = () => {
    const newRow = {
      id: `manual-grid-${Date.now()}`,
      account_id: parseInt(selectedAccount),
      date: new Date().toISOString().split('T')[0],
      amount: 0.00,
      type: 'debit',
      category: 'Uncategorized',
      description: 'New manual transaction',
      raw_text: 'Manually inserted'
    };
    setParsedTxs(prev => [...prev, newRow]);
  };

  // Delete row
  const handleDeleteGridRow = (id) => {
    setParsedTxs(prev => prev.filter(tx => tx.id !== id));
  };

  // Confirm Grid & Save to Ledger
  const handleSaveLedger = async () => {
    if (parsedTxs.length === 0) {
      alert('No transactions to save.');
      return;
    }

    try {
      setParsing(true);
      setError('');

      const response = await fetchSecure('/transactions/bulk', {
        method: 'POST',
        body: JSON.stringify({ transactions: parsedTxs })
      });

      if (response.ok) {
        const savedData = await response.json();
        setSuccessCount(savedData.length);
        setParsedTxs([]);
        setFile(null);
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to save parsed transactions to ledger.');
      }
    } catch (err) {
      setError('Network error saving transactions to ledger.');
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Document Processing Pipeline</h1>
        <p style={{ color: 'var(--text-muted)' }}>Upload bank or card statements. The AI scans and structures entries for review.</p>
      </div>

      {/* Warning/Suggestions block */}
      {warningMsg && (
        <div style={{
          background: 'var(--warning-glow)',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          padding: '16px 20px',
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} />
          <div>
            <strong>Missing Configuration:</strong> {warningMsg}
          </div>
        </div>
      )}

      {/* Success Block */}
      {successCount !== null && (
        <div style={{
          background: 'var(--success-glow)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          padding: '16px 20px',
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <CheckCircle size={20} />
          <div>
            <strong>Success:</strong> Saved {successCount} transactions into the database ledger, automatically updating account balances.
          </div>
        </div>
      )}

      {/* Error Block */}
      {error && (
        <div style={{
          background: 'var(--danger-glow)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          padding: '16px 20px',
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} />
          <div>{error}</div>
        </div>
      )}

      {/* Primary Layout Grid */}
      {parsedTxs.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', maxWidth: '680px', width: '100%', margin: '0 auto' }}>
          <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Account Selector */}
            <div className="form-group">
              <label className="form-label">Destination Account</label>
              <select 
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="form-select"
              >
                {accounts.length === 0 ? (
                  <option value="">No Accounts Available - Create one first</option>
                ) : (
                  accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (Type: {acc.type})</option>
                  ))
                )}
              </select>
            </div>

            {/* Drop Zone */}
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                border: '2px dashed var(--card-border)',
                borderRadius: 'var(--radius)',
                padding: '48px 24px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.01)',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--card-border)'}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input 
                id="file-input"
                type="file" 
                onChange={handleFileChange}
                accept=".pdf,.csv,.xls,.xlsx"
                style={{ display: 'none' }}
              />
              
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--primary)', marginBottom: '16px' }}>
                <Upload size={40} />
              </div>
              
              <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                {file ? file.name : 'Select or Drop Statement File'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Supports bank statements in PDF, CSV, XLS, or XLSX format.
              </p>
              {file && (
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={parsing || !file}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              {parsing ? (
                <>
                  <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  Gemini scanning statement layout...
                </>
              ) : (
                'Extract Transactions'
              )}
            </button>

          </form>
        </div>
      ) : (
        /* Document Parsed: Confirmation Grid Panel */
        <div className="glass-panel animated-fade" style={{ padding: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem' }}>Confirm Parsed Transactions</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Verify date formats, expense categories, and credit/debit toggles.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleAddGridRow} className="btn btn-secondary">
                <Plus size={16} />
                Add Row
              </button>
              <button onClick={() => setParsedTxs([])} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSaveLedger} className="btn btn-primary">
                Confirm & Save to Ledger ({parsedTxs.length})
              </button>
            </div>
          </div>

          {/* Grid confirmation table */}
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '140px' }}>Date</th>
                  <th>Description</th>
                  <th style={{ width: '120px' }}>Flow Type</th>
                  <th style={{ width: '160px' }}>Category</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {parsedTxs.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <input 
                        type="date"
                        value={tx.date}
                        onChange={(e) => handleUpdateGridCell(tx.id, 'date', e.target.value)}
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      />
                    </td>
                    <td>
                      <input 
                        type="text"
                        value={tx.description}
                        onChange={(e) => handleUpdateGridCell(tx.id, 'description', e.target.value)}
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      />
                    </td>
                    <td>
                      <select
                        value={tx.type}
                        onChange={(e) => handleUpdateGridCell(tx.id, 'type', e.target.value)}
                        className="form-select"
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      >
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={tx.category}
                        onChange={(e) => handleUpdateGridCell(tx.id, 'category', e.target.value)}
                        className="form-select"
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input 
                        type="number"
                        step="0.01"
                        value={tx.amount}
                        onChange={(e) => handleUpdateGridCell(tx.id, 'amount', e.target.value)}
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: '0.85rem', textAlign: 'right', fontWeight: 600 }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => handleDeleteGridRow(tx.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dark)', cursor: 'pointer' }}
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
          </div>

          <div style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-dark)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Confirming these transactions will commit entries and adjust balances of the selected account.</span>
            <span>Total rows: {parsedTxs.length}</span>
          </div>

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

export default UploadPage;
