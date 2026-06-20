import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Try to load cached user immediately to prevent layout shifts/unnecessary logins
    const cached = localStorage.getItem('rememberedUser');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.email) {
          return parsed;
        }
      } catch (e) {
        localStorage.removeItem('rememberedUser');
      }
    }
    return null;
  });
  
  const [loading, setLoading] = useState(true);

  // Check if user session already exists on page mount or refresh stats
  const checkUser = async () => {
    try {
      const res = await fetch(window.API_BASE_URL + '/api/auth/user/', {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.authenticated) {
        // Update user state and keep cached credentials if they exist
        setUser(prev => {
          const updated = {
            id: data.id,
            name: data.name,
            email: data.email,
            wins: data.wins,
            losses: data.losses,
            ties: data.ties,
            coins: data.coins || 0,
            password: prev ? prev.password : undefined
          };
          localStorage.setItem('rememberedUser', JSON.stringify(updated));
          return updated;
        });
      } else {
        // Session not active on server - check if we have remembered credentials
        const cached = localStorage.getItem('rememberedUser');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.email && parsed.password) {
            // Attempt background re-login
            const loginRes = await backgroundLogin(parsed.email, parsed.password);
            if (!loginRes.success) {
              setUser(null);
              localStorage.removeItem('rememberedUser');
            }
          } else {
            setUser(null);
            localStorage.removeItem('rememberedUser');
          }
        } else {
          setUser(null);
        }
      }
    } catch (e) {
      console.warn("Auth check failed:", e);
      // On network error, keep cached user if we have one so user can still play offline modules
      const cached = localStorage.getItem('rememberedUser');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch (err) {}
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper login for background use to avoid setting state multiple times
  const backgroundLogin = async (email, password) => {
    try {
      const res = await fetch(window.API_BASE_URL + '/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        const userData = {
          id: data.id,
          name: data.name,
          email: data.email,
          wins: data.wins,
          losses: data.losses,
          ties: data.ties,
          coins: data.coins || 0,
          password: password
        };
        setUser(userData);
        localStorage.setItem('rememberedUser', JSON.stringify(userData));
        return { success: true };
      }
    } catch (err) {
      console.warn("Background login failed:", err);
    }
    return { success: false };
  };

  useEffect(() => {
    checkUser();
  }, []);

  const login = async (email, password) => {
    const res = await fetch(window.API_BASE_URL + '/api/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      const userData = {
        id: data.id,
        name: data.name,
        email: data.email,
        wins: data.wins,
        losses: data.losses,
        ties: data.ties,
        coins: data.coins || 0,
        password: password
      };
      setUser(userData);
      localStorage.setItem('rememberedUser', JSON.stringify(userData));
      return { success: true };
    } else {
      return { success: false, error: data.error || "Login failed" };
    }
  };

  const register = async (name, email, password) => {
    const res = await fetch(window.API_BASE_URL + '/api/auth/register/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      const userData = {
        id: data.id,
        name: data.name,
        email: data.email,
        wins: data.wins,
        losses: data.losses,
        ties: data.ties,
        coins: data.coins || 0,
        password: password
      };
      setUser(userData);
      localStorage.setItem('rememberedUser', JSON.stringify(userData));
      return { success: true };
    } else {
      return { success: false, error: data.error || "Registration failed" };
    }
  };

  const addCoins = async (amount) => {
    try {
      const res = await fetch(window.API_BASE_URL + '/api/profile/add_coins/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUser(prev => {
          if (!prev) return null;
          const updated = { ...prev, coins: data.coins };
          localStorage.setItem('rememberedUser', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      console.warn("Failed to add coins on server, updating locally:", e);
      setUser(prev => {
        if (!prev) return null;
        const updated = { ...prev, coins: (prev.coins || 0) + amount };
        localStorage.setItem('rememberedUser', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const logout = async () => {
    localStorage.removeItem('rememberedUser');
    try {
      await fetch(window.API_BASE_URL + '/api/auth/logout/', { 
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.error("Logout request failed:", e);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkUser, addCoins }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
