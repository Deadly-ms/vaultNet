import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Loader2 } from 'lucide-react';

const LoginPage = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin) {
      setError('Please enter your Master PIN.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await login(pin);
    setLoading(false);
    if (!res.success) {
      setError(res.error);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      padding: '20px'
    }}>
      <div className="glass-panel animated-fade" style={{
        maxWidth: '400px',
        width: '100%',
        padding: '40px 32px',
        textAlign: 'center'
      }}>
        {/* Shield Icon */}
        <div style={{
          background: 'var(--primary-glow)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '50%',
          width: '72px',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px auto',
          color: 'var(--primary)'
        }}>
          <ShieldCheck size={36} />
        </div>

        <h1 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Security Verification</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '32px' }}>
          Enter your Master PIN to access the wealth platform.
        </p>

        {error && (
          <div style={{
            background: 'var(--danger-glow)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '12px',
            borderRadius: 'var(--radius)',
            fontSize: '0.85rem',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ textAlign: 'left', marginBottom: '24px' }}>
            <label className="form-label">Master PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={8}
              className="form-input"
              style={{
                textAlign: 'center',
                fontSize: '1.5rem',
                letterSpacing: '0.3em',
                padding: '10px'
              }}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                Authorizing Session...
              </>
            ) : (
              'Verify & Unlock'
            )}
          </button>
        </form>

        <div style={{ marginTop: '32px', fontSize: '0.75rem', color: 'var(--text-dark)' }}>
          Self-Hosted Environment • Local Database Secure
        </div>
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

export default LoginPage;
