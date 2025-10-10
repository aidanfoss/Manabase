// src/App.jsx
import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginForm from "./components/LoginForm";
import BuilderView from "./components/BuilderView";
import PackageManager from "./components/PackageManager";
import "./styles/nav-auth.css";


export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user } = useAuth();
  const [screen, setScreen] = useState("main"); // "main" or "packages"
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <TopNav
        user={user}
        screen={screen}
        setScreen={setScreen}
        showLogin={showLogin}
        setShowLogin={setShowLogin}
      />

      {showLogin && !user && (
        <div className="login-dropdown">
          <LoginForm compact onSuccess={() => setShowLogin(false)} />
        </div>
      )}

      {screen === "main" ? <BuilderView /> : <PackageManager />}
    </>
  );
}

function TopNav({ user, screen, setScreen, showLogin, setShowLogin }) {
  const { logout } = useAuth();

  const displayName = user?.username || user?.email || "Guest";
  const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${displayName}`;

  return (
    <nav className="top-nav">
      {/* Left: profile / login */}
      <div className="nav-profile">
        {user ? (
          <>
            <img src={avatar} alt="Profile" className="nav-avatar" />
            <span className="nav-name">{displayName}</span>
            <button className="logout-btn nav-logout" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <button
            className="login-btn"
            onClick={() => setShowLogin((v) => !v)}
          >
            {showLogin ? "Close Login" : "Log in / Sign up"}
          </button>
        )}
      </div>

      {/* Right: screen switch */}
      <div className="nav-buttons">
        <button
          className={screen === "main" ? "active" : ""}
          onClick={() => setScreen("main")}
        >
          🧱 Builder
        </button>
        <button
          className={screen === "packages" ? "active" : ""}
          onClick={() => setScreen("packages")}
          disabled={!user}
          title={!user ? "Log in to manage packages" : ""}
        >
          📦 Packages
        </button>
      </div>
    </nav>
  );
}
