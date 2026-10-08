import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function LoginForm({ onSuccess }) {
  const { login, ssoError, setSsoError } = useAuth();
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState(ssoError || null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ google: false, discord: false, devMode: true });

  useEffect(() => {
    if (ssoError) setError(ssoError);
  }, [ssoError]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getAuthProviders();
        if (data) setProviders(data);
      } catch (e) {
        console.warn("Could not fetch auth providers config", e);
      }
    })();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (setSsoError) setSsoError(null);

    if (mode === "signup" && !consentGiven) {
      setError("You must agree to the Privacy Policy and Terms of Service to create an account.");
      return;
    }

    setLoading(true);
    try {
      let res;
      if (mode === "signup") {
        res = await api.register({ email, username, password });
      } else {
        res = await api.login({ email, password });
      }

      if (res && res.token && res.user) {
        login(res);
        if (onSuccess) onSuccess();
      } else {
        throw new Error("Invalid server response");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSSO(provider) {
    setError(null);
    if (setSsoError) setSsoError(null);
    setLoading(true);
    try {
      if (!providers[provider]) {
        if (providers.devMode) {
          // Dev mode instant login fallback
          const res = provider === "google" ? await api.loginWithGoogle() : await api.loginWithDiscord();
          if (res && res.token && res.user) {
            login(res);
            if (onSuccess) onSuccess();
            return;
          }
        } else {
          // Unconfigured in production
          const name = provider === "google" ? "Google" : "Discord";
          const envVar = provider === "google" ? "GOOGLE_CLIENT_ID" : "DISCORD_CLIENT_ID";
          setError(`${name} OAuth is not configured on this server. Please set ${envVar} in environment variables.`);
          setLoading(false);
          return;
        }
      }
      // Redirect to backend OAuth route
      window.location.href = `/api/auth/${provider}`;
    } catch (err) {
      console.error(`${provider} SSO error:`, err);
      setError(err.message || `${provider} login failed`);
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>{mode === "signup" ? "Create Account" : "Welcome Back"}</h2>
        {error && <div className="error-box">{error}</div>}

        <div className="sso-buttons">
          <button
            type="button"
            className="sso-btn sso-google"
            onClick={() => handleSSO("google")}
            disabled={loading}
          >
            <svg className="sso-icon" viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            className="sso-btn sso-discord"
            onClick={() => handleSSO("discord")}
            disabled={loading}
          >
            <svg className="sso-icon" viewBox="0 0 127.14 96.36" width="18" height="18" fill="currentColor">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a74.31,74.31,0,0,0,64.3,0c.87.68,1.76,1.36,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14c2.64-27.38-4.51-51.11-18.91-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z"/>
            </svg>
            <span>Continue with Discord</span>
          </button>
        </div>

        <div className="sso-divider">
          <span>or</span>
        </div>

        <label htmlFor="emailField">{mode === "signup" ? "Email" : "Email or Username"}</label>
        <input
          id="emailField"
          type={mode === "signup" ? "email" : "text"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {mode === "signup" && (
          <>
            <label htmlFor="usernameField">Username</label>
            <input
              id="usernameField"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </>
        )}

        <label htmlFor="passwordField">Password</label>
        <input
          id="passwordField"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-label="Password"
        />

        {mode === "signup" && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
            <input
              type="checkbox"
              id="consent-checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              required
              style={{ marginTop: '0.25rem', cursor: 'pointer' }}
            />
            <label htmlFor="consent-checkbox" style={{ margin: 0, fontWeight: 'normal', lineHeight: '1.4' }}>
              I agree to the <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>Privacy Policy</a> and <a href="/terms" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>Terms of Service</a>, and consent to the minimal data collection required to operate this service.
            </label>
          </div>
        )}

        <button type="submit" disabled={loading} aria-label={mode === "signup" ? "Sign Up" : "Log In"}>
          {loading
            ? "Loading..."
            : mode === "signup"
            ? "Sign Up"
            : "Log In"}
        </button>

        <div className="toggle-mode">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, fontSize: 'inherit', fontWeight: 'bold' }}
              >
                Log in
              </button>
            </>
          ) : (
            <>
              Need an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, fontSize: 'inherit', fontWeight: 'bold' }}
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
