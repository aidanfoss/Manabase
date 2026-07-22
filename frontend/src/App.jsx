// src/App.jsx
import React, { useState, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginForm from "./components/LoginForm";
import BuilderView from "./components/BuilderView";
import PackageManager from "./components/PackageManager";
import Presets from "./components/Presets";
import OwnedCollection from "./components/OwnedCollection";
import WishlistHub from "./components/WishlistHub";
import TradelistManager from "./components/TradelistManager";
import { api } from "./api/client";
import "./styles/nav-auth.css";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const applyPreset = (preset) => {
    setSelected({
      packages: new Set(preset.packages || []),
      landcycles: new Set(Object.keys(preset.landCycles || {})),
      colors: new Set(),
    });
    navigate("/builder");
  };

  return (
    <>
      <header className="global-header-wrapper">
        <TopNav
          user={user}
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
        <Routes>
          <Route path="/" element={<LandingDashboard />} />
          <Route path="/builder" element={
            <BuilderView 
              selected={selected} 
              setSelected={setSelected} 
              onSetMainScreen={() => navigate("/builder")} 
              onDataLoaded={setBuilderData}
              userCollection={userCollection}
            />
          } />
          <Route path="/collection" element={<OwnedCollection onCollectionChanged={setUserCollection} />} />
          <Route path="/wishlist" element={<WishlistHub />} />
          <Route path="/trade" element={<TradelistManager />} />
          <Route path="/presets" element={<Presets currentSelection={selected} onApplyPreset={applyPreset} landcycles={landcycles} />} />
          <Route path="/packages" element={<PackageManager ref={packageRef} />} />
          <Route path="*" element={<LandingDashboard />} />
        </Routes>
      </div>
    </>
  );
}

function LandingDashboard() {
  const navigate = useNavigate();
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
            <button className="sub-btn" onClick={() => navigate("/builder")}>🧱 Launch Builder</button>
            <button className="sub-btn" onClick={() => navigate("/presets")}>🎯 Land Presets</button>
            <button className="sub-btn" onClick={() => navigate("/packages")}>📦 Custom Packages</button>
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
            <button className="sub-btn" onClick={() => navigate("/collection")}>🗃️ Collection</button>
            <button className="sub-btn" onClick={() => navigate("/wishlist")}>✨ Proxy Hub</button>
            <button className="sub-btn" onClick={() => navigate("/trade")}>🤝 Trade Hub</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TEST_USERS = [
  { username: "DevUser", email: "dev@manabase.com" },
  { username: "TestUser1", email: "testuser1@example.com" },
  { username: "TestUser2", email: "testuser2@example.com" },
  { username: "TestUser3", email: "testuser3@example.com" },
  { username: "TestUser4", email: "testuser4@example.com" },
  { username: "TestUser5", email: "testuser5@example.com" },
  { username: "TestUser6", email: "testuser6@example.com" },
  { username: "TestUser7", email: "testuser7@example.com" },
  { username: "TestUser8", email: "testuser8@example.com" },
  { username: "TestUser9", email: "testuser9@example.com" }
];

function TopNav({ user, showLogin, setShowLogin }) {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tradeAlerts, setTradeAlerts] = useState(0);

  const isTestUser = user && /^(DevUser|TestUser\d*)$/i.test(user.username);

  const currentTestIndex = isTestUser
    ? TEST_USERS.findIndex(u => u.username.toLowerCase() === user.username.toLowerCase())
    : -1;

  const nextTestUser = isTestUser
    ? TEST_USERS[(currentTestIndex + 1) % TEST_USERS.length]
    : TEST_USERS[0];

  const handleCycleUser = async () => {
    try {
      let res;
      if (nextTestUser.username === "DevUser") {
        try {
          res = await api.devLogin();
        } catch {
          res = await api.login({ email: nextTestUser.email, password: "password" });
        }
      } else {
        try {
          res = await api.login({ email: nextTestUser.email, password: "password" });
        } catch {
          res = await api.register({ email: nextTestUser.email, username: nextTestUser.username, password: "password" });
        }
      }

      if (res && res.token && res.user) {
        login(res);
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to cycle test user:", err);
      alert(`Could not switch to ${nextTestUser.username}`);
    }
  };

  React.useEffect(() => {
    if (!user) {
      setTradeAlerts(0);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchAlerts = () => {
      fetch("/api/trade/pending-count", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && typeof data.count === 'number') {
            setTradeAlerts(data.count);
          }
        })
        .catch(err => {
          if (err.name !== 'TypeError') {
            console.error('Error fetching trade alerts:', err);
          }
        });
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
            {isTestUser && (
              <button
                className="cycle-user-btn"
                onClick={handleCycleUser}
                title={`Cycle to ${nextTestUser.username}`}
              >
                🔄 Switch: {nextTestUser.username}
              </button>
            )}
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
      <div className="logo-branding" onClick={() => navigate("/")}>
        💎 Manabase Hub
      </div>

      {/* Right: navigation & tools */}
      <div className="nav-controls-right">
        {user && tradeAlerts > 0 && (
          <button
            className={`home-btn ${location.pathname === "/trade" ? "active" : ""}`}
            onClick={() => navigate("/trade")}
            title="View Trades"
            style={{ color: "#ef4444", fontWeight: "bold" }}
          >
            🤝 Trades ({tradeAlerts})
          </button>
        )}
        <button
          className={`home-btn ${location.pathname === "/" ? "active" : ""}`}
          onClick={() => navigate("/")}
          title="Go to Dashboard"
        >
          🏠 Home
        </button>
      </div>
    </nav>
  );
}
