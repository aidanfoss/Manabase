// src/App.jsx
import React, { useState, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginForm from "./components/LoginForm";
import BuilderView from "./components/BuilderView";
import PackageManager from "./components/PackageManager";
import Presets from "./components/Presets";
import OwnedCollection from "./components/OwnedCollection";
import WishlistHub from "./components/WishlistHub";
import TradelistManager from "./components/TradelistManager";
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
  const [screen, setScreen] = useState("landing"); // "landing", "main", "collection", "wishlist", "tradelist", "packages", "presets"
  const [showLogin, setShowLogin] = useState(false);
  const [landcycles, setLandcycles] = useState([]);
  const [builderData, setBuilderData] = useState({ lands: [], nonlands: [] });
  const [userCollection, setUserCollection] = useState([]);
  const packageRef = useRef();

  const [selected, setSelected] = useState({
    packages: new Set(),
    landcycles: new Set(),
    colors: new Set(),
  });

  // Load landcycles for presets
  React.useEffect(() => {
    const loadLandcycles = async () => {
      try {
        const res = await fetch('/api/landcycles');
        if (res.ok) {
          const data = await res.json();
          setLandcycles(data || []);
        }
      } catch (error) {
        console.error('Failed to load landcycles:', error);
      }
    };
    loadLandcycles();
  }, []);

  const getScreenComponent = () => {
    switch (screen) {
      case "landing":
        return <LandingDashboard setScreen={setScreen} />;
      case "collection":
        return <OwnedCollection onCollectionChanged={setUserCollection} />;
      case "wishlist":
        return <WishlistHub />;
      case "tradelist":
        return <TradelistManager />;
      case "presets":
        return <Presets currentSelection={selected} onApplyPreset={applyPreset} landcycles={landcycles} />;
      case "packages":
        return <PackageManager ref={packageRef} />;
      default:
        return (
          <BuilderView 
            selected={selected} 
            setSelected={setSelected} 
            onSetMainScreen={() => setScreen("main")} 
            onDataLoaded={setBuilderData}
            userCollection={userCollection}
          />
        );
    }
  };

  const applyPreset = (preset) => {
    setSelected({
      packages: new Set(preset.packages || []),
      landcycles: new Set(Object.keys(preset.landCycles || {})),
      colors: new Set(),
    });
    setScreen("main");
  };

  return (
    <>
      <header className="global-header-wrapper">
        <TopNav
          user={user}
          screen={screen}
          setScreen={setScreen}
          showLogin={showLogin}
          setShowLogin={setShowLogin}
        />
      </header>

      {showLogin && !user && (
        <div className="login-modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="login-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="login-modal-close" onClick={() => setShowLogin(false)} title="Close">✕</button>
            <LoginForm onSuccess={() => setShowLogin(false)} />
          </div>
        </div>
      )}

      <div className="main-viewport-content">
        {getScreenComponent()}
      </div>
    </>
  );
}

function LandingDashboard({ setScreen }) {
  return (
    <div className="landing-container">
      <div className="landing-hero">
        <h1 className="hero-title">Welcome to Manabase Hub</h1>
        <p className="hero-subtitle">
          Construct the perfect mana foundation, manage collections, plan wishlist proxies, and track trades in one dashboard.
        </p>
      </div>

      <div className="features-grid">
        {/* Feature 1: Manabase Deckbuilder */}
        <div className="feature-card">
          <div className="card-badge-top">Feature 01</div>
          <div className="card-icon">🧱</div>
          <h2 className="card-title-text">Manabase Deckbuilder</h2>
          <p className="card-description">
            Build optimal land bases for your Commander decks. Configure color identities, apply curated land cycle presets, load card packages, and view live price rankings.
          </p>
          
          <div className="landing-sub-buttons" onClick={(e) => e.stopPropagation()}>
            <button className="sub-btn" onClick={() => setScreen("main")}>🧱 Launch Builder</button>
            <button className="sub-btn" onClick={() => setScreen("presets")}>🎯 Land Presets</button>
            <button className="sub-btn" onClick={() => setScreen("packages")}>📦 Custom Packages</button>
          </div>
        </div>

        {/* Feature 2: Collection & Lists Manager */}
        <div className="feature-card">
          <div className="card-badge-top">Feature 02</div>
          <div className="card-icon">🗂️</div>
          <h2 className="card-title-text">Collection & Lists Hub</h2>
          <p className="card-description">
            Manage your physical owned inventory, organize print set details, configure playgroup proxy rules compliance, and track cards you would like to trade.
          </p>
          
          <div className="landing-sub-buttons" onClick={(e) => e.stopPropagation()}>
            <button className="sub-btn" onClick={() => setScreen("collection")}>🗃️ Owned CSV</button>
            <button className="sub-btn" onClick={() => setScreen("wishlist")}>✨ Wishlist & Proxies</button>
            <button className="sub-btn" onClick={() => setScreen("tradelist")}>🤝 Tradelist</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopNav({ user, screen, setScreen, showLogin, setShowLogin }) {
  const { logout } = useAuth();
  const [tradeAlerts, setTradeAlerts] = useState(0);

  React.useEffect(() => {
    if (!user) {
      setTradeAlerts(0);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchAlerts = () => {
      fetch("/api/trade/alerts", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && typeof data.count === 'number') {
            setTradeAlerts(data.count);
          }
        })
        .catch(console.error);
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const displayName = user?.username || user?.email || "Guest";
  const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${displayName}`;

  return (
    <nav className="top-nav">
      {/* Left: profile / login */}
      <div className="nav-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {user ? (
          <>
            <div style={{ position: 'relative' }}>
              <img src={avatar} alt="Profile" className="nav-avatar" />
              {tradeAlerts > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 'bold'
                }}>
                  {tradeAlerts}
                </div>
              )}
            </div>
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

      {/* Center: logo branding */}
      <div className="logo-branding" onClick={() => setScreen("landing")}>
        💎 Manabase Hub
      </div>

      {/* Right: navigation & tools */}
      <div className="nav-controls-right">
        {user && tradeAlerts > 0 && (
          <button
            className={`home-btn ${screen === "wishlist" ? "active" : ""}`}
            onClick={() => setScreen("wishlist")}
            title="View Trades"
            style={{ color: "#ef4444", fontWeight: "bold" }}
          >
            🤝 Trades ({tradeAlerts})
          </button>
        )}
        <button
          className={`home-btn ${screen === "landing" ? "active" : ""}`}
          onClick={() => setScreen("landing")}
          title="Go to Dashboard"
        >
          🏠 Home
        </button>
      </div>
    </nav>
  );
}
