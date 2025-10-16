// src/App.jsx
import React, { useState, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginForm from "./components/LoginForm";
import BuilderView from "./components/BuilderView";
import PackageManager from "./components/PackageManager";
import Presets from "./components/Presets";
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
  const [screen, setScreen] = useState("main"); // "main", "packages", or "presets"
  const [showLogin, setShowLogin] = useState(false);
  const packageRef = useRef();

  const getScreenComponent = () => {
    switch (screen) {
      case "presets":
        return <Presets />;
      case "packages":
        return <PackageManager ref={packageRef} />;
      default:
        return <BuilderView />;
    }
  };

  return (
    <>
      <TopNav
        user={user}
        screen={screen}
        setScreen={setScreen}
        showLogin={showLogin}
        setShowLogin={setShowLogin}
        packageRef={packageRef}
      />

      {showLogin && !user && (
        <div className="login-dropdown">
          <LoginForm compact onSuccess={() => setShowLogin(false)} />
        </div>
      )}

      {getScreenComponent()}
    </>
  );
}

function TopNav({ user, screen, setScreen, showLogin, setShowLogin, packageRef }) {
  const { logout } = useAuth();

  const displayName = user?.username || user?.email || "Guest";
  const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${displayName}`;

  const handleNewPackage = () => {
    if (packageRef.current && packageRef.current.newPackage) {
      packageRef.current.newPackage();
    }
  };

  const handleLoadPackage = () => {
    if (packageRef.current && packageRef.current.loadPackage) {
      packageRef.current.loadPackage();
    }
  };

  const handleUndo = () => {
    if (packageRef.current && packageRef.current.undo) {
      packageRef.current.undo();
    }
  };

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

      {/* Center: package actions (only show when on packages screen) */}
      {screen === "packages" && user && (
        <div className="nav-actions">
          <button onClick={handleNewPackage}>
            New Package
          </button>
          <button onClick={handleLoadPackage}>
            Load Package
          </button>
        </div>
      )}

      {/* Right: screen switch */}
      <div className="nav-buttons">
        <button
          className={screen === "main" ? "active" : ""}
          onClick={() => setScreen("main")}
        >
          🧱 Builder
        </button>
        <button
          className={screen === "presets" ? "active" : ""}
          onClick={() => setScreen("presets")}
        >
          🎯 Presets
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
