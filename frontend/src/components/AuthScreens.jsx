import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { playSound } from '../utils/audio';
import { Mail, Lock, User, ShieldAlert } from 'lucide-react';

export default function AuthScreens() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        if (!res.success) setError(res.error);
      } else {
        const res = await login(email, password);
        if (!res.success) setError(res.error);
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
    setEmail('');
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
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
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
