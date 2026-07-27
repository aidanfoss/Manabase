import React, { createContext, useContext, useEffect, useRef, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [ssoError, setSsoError] = useState(null);
  const devLoginAttempted = useRef(false);

  // Check URL parameters for SSO redirect token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso_token");
    const err = params.get("sso_error");

    if (ssoToken) {
      console.log("🔑 SSO Login token detected from redirect");
      localStorage.setItem("token", ssoToken);
      setToken(ssoToken);
      
      // Clean query params from URL without reload
      params.delete("sso_token");
      params.delete("sso_error");
      const newQuery = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState({}, document.title, window.location.pathname + newQuery);
    } else if (err) {
      console.error("❌ SSO Error from redirect:", err);
      setSsoError(err);
      params.delete("sso_error");
      const newQuery = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState({}, document.title, window.location.pathname + newQuery);
    }
  }, []);

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
    setSsoError(null);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
    setSsoError(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, ssoError, setSsoError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
