import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user session already exists on page mount
  const checkUser = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/user/', {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.authenticated) {
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          wins: data.wins,
          losses: data.losses,
          ties: data.ties
        });
      } else {
        setUser(null);
      }
    } catch (e) {
      console.warn("Auth check failed:", e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  const login = async (email, password) => {
    const res = await fetch('http://localhost:8000/api/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data);
      return { success: true };
    } else {
      return { success: false, error: data.error || "Login failed" };
    }
  };

  const register = async (name, email, password) => {
    const res = await fetch('http://localhost:8000/api/auth/register/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data);
      return { success: true };
    } else {
      return { success: false, error: data.error || "Registration failed" };
    }
  };

  const logout = async () => {
    try {
      await fetch('http://localhost:8000/api/auth/logout/', { 
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.error("Logout request failed:", e);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
