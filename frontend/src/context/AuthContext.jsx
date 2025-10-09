import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  // On load or token change, validate token and fetch user
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setUser(null);
          localStorage.removeItem("token");
        }
      } catch (e) {
        console.error("Auth validation failed:", e);
        setUser(null);
        localStorage.removeItem("token");
      }
    })();
  }, [token]);

  const login = (data) => {
    if (!data?.token || !data?.user) return;
    localStorage.setItem("token", data.token);
    setUser(data.user);
    setToken(data.token);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
