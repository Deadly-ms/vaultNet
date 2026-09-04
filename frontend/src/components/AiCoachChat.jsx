import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, X, Send, Sparkles, Loader2 } from 'lucide-react';

const AiCoachChat = () => {
  const { fetchSecure } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: "Welcome to the VaultNet Chat. I have synced your accounts ledger and watchlist context. Ask me anything about asset weightings, budget overruns, or stock market insights."
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [role, setRole] = useState('coach'); // active role state: coach, quant, risk
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = { role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      // Compile history in format expected by the backend
      const history = messages.map(msg => ({
        role: msg.role,
        text: msg.text
      }));

      const res = await fetchSecure('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: userMessage.text,
          history: history,
          role: role
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'model', text: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', text: `Error: ${data.error || 'Failed to generate response.'}` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: 'Network communication failure. Make sure the quant engine is online.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            background: 'var(--primary-gradient)',
            border: 'none',
            color: 'white',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)',
            zIndex: 9999,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(59, 130, 246, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.4)';
          }}
        >
          <Sparkles size={24} />
        </button>
      )}

      {/* Chat Console Panel */}
      {isOpen && (
        <div 
          className="glass-panel"
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '400px',
            height: '600px',
            maxHeight: 'calc(100vh - 60px)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
            border: '1px solid var(--card-border)',
            borderRadius: '16px',
            animation: 'chatSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
          }}
        >
          {/* Header */}
          <div style={{
            background: 'rgba(15, 15, 20, 0.8)',
            borderBottom: '1px solid var(--card-border)',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ color: 'var(--primary)' }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', margin: 0, fontFamily: 'var(--font-mono)' }}>Wealth Coach</h3>
                <span style={{ 
                  fontSize: '0.7rem', 
                  color: role === 'quant' ? '#8b5cf6' : role === 'risk' ? '#f59e0b' : '#10b981', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  fontWeight: 600,
                  transition: 'var(--transition)'
                }}>
                  <span style={{ 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    background: role === 'quant' ? '#8b5cf6' : role === 'risk' ? '#f59e0b' : '#10b981' 
                  }} />
                  {role === 'quant' ? 'Quant Strategy Analyst' : role === 'risk' ? 'Portfolio Risk Auditor' : 'General Wealth Coach'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Functional Role Selectors */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.01)',
            borderBottom: '1px solid var(--card-border)',
            padding: '10px 20px',
            gap: '8px'
          }}>
            {[
              { id: 'coach', label: 'General', desc: 'Daily budgets & savings' },
              { id: 'quant', label: 'Quant', desc: 'SMA/RSI strategies backtests' },
              { id: 'risk', label: 'Risk', desc: 'Volatility & sector diversification' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRole(item.id)}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: '6px',
                  background: role === item.id ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid',
                  borderColor: role === item.id ? 'transparent' : 'var(--card-border)',
                  color: role === item.id ? 'white' : 'var(--text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
                title={item.desc}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Messages Container */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: 'rgba(5, 5, 5, 0.4)'
          }}>
            {messages.map((msg, index) => {
              const isModel = msg.role === 'model';
              return (
                <div
                  key={index}
                  style={{
                    alignSelf: isModel ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{
                    background: isModel ? 'rgba(255, 255, 255, 0.03)' : 'var(--primary-gradient)',
                    border: isModel ? '1px solid var(--card-border)' : 'none',
                    color: 'white',
                    padding: '10px 14px',
                    borderRadius: isModel ? '0 12px 12px 12px' : '12px 0 12px 12px',
                    fontSize: '0.88rem',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                    boxShadow: isModel ? 'none' : '0 4px 10px rgba(59, 130, 246, 0.15)'
                  }}>
                    {msg.text}
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-dark)',
                    alignSelf: isModel ? 'flex-start' : 'flex-end',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {isModel ? 'COACH' : 'YOU'}
                  </span>
                </div>
              );
            })}

            {sending && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '0 12px 12px 12px', border: '1px solid var(--card-border)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                Analyzing portfolio context...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Input */}
          <form onSubmit={handleSend} style={{
            padding: '16px',
            borderTop: '1px solid var(--card-border)',
            background: 'rgba(15, 15, 20, 0.8)',
            display: 'flex',
            gap: '10px'
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask coach, e.g. should I cut food budgets?"
              className="form-input"
              style={{ padding: '8px 12px', fontSize: '0.85rem', flex: 1 }}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="btn btn-primary"
              style={{ width: '40px', height: '36px', padding: 0 }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {/* Slide-in styles */}
      <style>{`
        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default AiCoachChat;
