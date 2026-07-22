import React, { createContext, useContext, useEffect, useRef, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const devLoginAttempted = useRef(false);

  // On load or token change, validate token and fetch user
  useEffect(() => {
    if (!token) {
      const isDev = import.meta.env.MODE === "development" || 
                    window.location.hostname === "localhost" || 
                    window.location.hostname === "127.0.0.1";
      if (isDev) {
        if (devLoginAttempted.current) return;
        devLoginAttempted.current = true;

        (async () => {
          try {
            console.log("🛠️ Dev environment detected. Attempting auto-login...");
            const res = await fetch("/api/auth/dev-login", {
              method: "POST",
              headers: { "Content-Type": "application/json" }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.token && data.user) {
                localStorage.setItem("token", data.token);
                setUser(data.user);
                setToken(data.token);
                console.log("⚡ Dev auto-login successful:", data.user.username);
              }
            }
          } catch (e) {
            console.error("❌ Dev auto-login failed:", e);
          } finally {
            devLoginAttempted.current = false;
          }
        })();
      }
      return;
    }

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
          setToken(null);
          localStorage.removeItem("token");
        }
      } catch (e) {
        console.error("Auth validation failed:", e);
        setUser(null);
        setToken(null);
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
