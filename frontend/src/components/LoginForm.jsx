import React, { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function LoginForm() {
  const { login } = useAuth();
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let res;
      if (mode === "signup") {
        // Register then auto-login
        res = await api.register({ email, username, password });
      } else {
        res = await api.login({ email, password });
      }

      // Both api.register and api.login return the same { token, user } shape
      if (res && res.token && res.user) {
        login(res); // store token + user in context/localStorage
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

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>{mode === "signup" ? "Create Account" : "Welcome Back"}</h2>
        {error && <div className="error-box">{error}</div>}

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {mode === "signup" && (
          <>
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </>
        )}

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
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
              <span onClick={() => setMode("login")}>Log in</span>
            </>
          ) : (
            <>
              Need an account?{" "}
              <span onClick={() => setMode("signup")}>Sign up</span>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
