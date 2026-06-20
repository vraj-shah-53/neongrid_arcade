import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { playSound } from '../utils/audio';
import { Mail, Lock, User, ShieldAlert, Eye, EyeOff } from 'lucide-react';

export default function AuthScreens() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('rememberedEmail') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return !!localStorage.getItem('rememberedEmail');
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    playSound('click');

    try {
      if (isRegister) {
        const res = await register(name, email, password);
        if (!res.success) {
          setError(res.error);
        } else {
          if (rememberMe) {
            localStorage.setItem('rememberedEmail', email);
          } else {
            localStorage.removeItem('rememberedEmail');
          }
        }
      } else {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error);
        } else {
          if (rememberMe) {
            localStorage.setItem('rememberedEmail', email);
          } else {
            localStorage.removeItem('rememberedEmail');
          }
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    playSound('click');
    setIsRegister(!isRegister);
    setError('');
    setName('');
    setEmail(localStorage.getItem('rememberedEmail') || '');
    setPassword('');
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h2>{isRegister ? 'JOIN THE NEON ARCADE' : 'AUTHENTICATE SYSTEM'}</h2>
        <p>{isRegister ? 'Create an account to play online multiplayer' : 'Log in to challenge players and track stats'}</p>
      </div>

      {error && (
        <div className="auth-error">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        {isRegister && (
          <div className="form-group">
            <label htmlFor="auth-name">Your Codename</label>
            <div className="input-wrapper">
              <User className="input-icon" size={18} />
              <input
                id="auth-name"
                type="text"
                placeholder="e.g. NeoCoder"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="auth-email">Grid Net Email</label>
          <div className="input-wrapper">
            <Mail className="input-icon" size={18} />
            <input
              id="auth-email"
              type="email"
              placeholder="e.g. pilot@cyberarcade.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="auth-password">Security Key (Password)</label>
          <div className="input-wrapper">
            <Lock className="input-icon" size={18} />
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              className="password-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => {
                playSound('click');
                setShowPassword(!showPassword);
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="form-group remember-me-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 1rem 0' }}>
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{ width: 'auto', margin: 0, accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
          <label htmlFor="remember-me" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', margin: 0 }}>
            Remember my codename email
          </label>
        </div>

        <button type="submit" className="btn-primary auth-submit" disabled={loading}>
          {loading ? 'INITIALIZING...' : isRegister ? 'CREATE ACCOUNT' : 'ENTER PORTAL'}
        </button>
      </form>

      <div className="auth-footer">
        <span>{isRegister ? 'Already registered in database?' : 'First time entering the grid?'}</span>
        <button className="auth-toggle-btn" onClick={toggleMode}>
          {isRegister ? 'Login instead' : 'Register codename'}
        </button>
      </div>
    </div>
  );
}
