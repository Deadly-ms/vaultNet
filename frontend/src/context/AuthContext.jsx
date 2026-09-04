import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Gateway URL - matches the Node.js Express Gateway port mapped on localhost
  const API_BASE = 'http://localhost:5001/api';

  useEffect(() => {
    const verifySessionToken = async () => {
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (data.valid) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('token');
          setToken(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Failed to verify token with gateway:', error);
      } finally {
        setLoading(false);
      }
    };

    verifySessionToken();
  }, [token]);

  const login = async (pin) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pin })
      });
      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Invalid PIN' };
      }
    } catch (error) {
      console.error('Login request failed:', error);
      return { success: false, error: 'Network error. Gateway is unreachable.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsAuthenticated(false);
  };

  // Wrapper for API calls attaching the Auth JWT automatically
  const fetchSecure = async (endpoint, options = {}) => {
    const headers = {
      ...options.headers,
    };
    
    // Attach authorization header if token is present
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Set JSON content-type default unless transmitting form data (e.g. multipart parser uploads)
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401 || response.status === 403) {
      logout();
      throw new Error('Unauthorized or expired session.');
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout, fetchSecure, token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
