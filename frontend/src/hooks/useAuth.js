'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI, clearAuthStorage } from '../lib/api';

const AuthContext = createContext(null);

function decodeJwt(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored || stored === 'undefined' || stored === 'null') {
        localStorage.removeItem('user');
        setUser(null);
      } else {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setUser(parsed);
        } else {
          localStorage.removeItem('user');
          setUser(null);
        }
      }
    } catch {
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (phone, password) => {
    const res = await authAPI.login({ phone, password });
    const resData = res?.data?.data || {};
    const token = resData.token;
    const refreshToken = resData.refreshToken;
    let userObj = resData.user;

    if (!userObj && token) {
      const decoded = decodeJwt(token);
      if (decoded) {
        userObj = {
          id: decoded.id,
          name: decoded.name || '',
          role: decoded.role || 'mother',
        };
      }
    }

    // Access token: sessionStorage (SPA in-memory lifetime); refresh token: localStorage.
    if (token) {
      sessionStorage.setItem('token', token);
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }

    if (userObj) {
      localStorage.setItem('user', JSON.stringify(userObj));
      setUser(userObj);
      return userObj;
    } else {
      localStorage.removeItem('user');
      setUser(null);
      return null;
    }
  };

  const logout = () => {
    clearAuthStorage();
    setUser(null);
    router.push('/login');
  };

  const register = async (data) => {
    const { data: res } = await authAPI.register(data);
    return res;
  };

  const verifyOTP = async (motherId, pinId, otp) => {
    const res = await authAPI.verifyOTP({ motherId, pinId, otp });
    const resData = res?.data?.data || {};
    const token = resData.token;
    const refreshToken = resData.refreshToken;
    let userObj = resData.user;

    if (!userObj && token) {
      const decoded = decodeJwt(token);
      if (decoded) {
        userObj = {
          id: decoded.id || motherId,
          name: decoded.name || '',
          role: decoded.role || 'mother',
          is_verified: true,
        };
      }
    }

    if (token) {
      sessionStorage.setItem('token', token);
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }

    if (userObj) {
      localStorage.setItem('user', JSON.stringify(userObj));
      setUser(userObj);
      return userObj;
    } else {
      localStorage.removeItem('user');
      setUser(null);
      return null;
    }
  };

  const resendOTP = async (phone) => {
    const { data } = await authAPI.resendOTP({ phone });
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, verifyOTP, resendOTP }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
