// src/App.jsx
import React, { useState, useRef, useEffect } from "react";
import { CubeIcon, FolderIcon, ArrowPathIcon, MoonIcon, MapPinIcon, BellIcon, ArrowPathRoundedSquareIcon, Bars3Icon, XMarkIcon, ChevronDownIcon, SparklesIcon } from "@heroicons/react/24/solid";

import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginForm from "./components/LoginForm";
import BuilderView from "./components/BuilderView";
import PackageManager from "./components/PackageManager";
import Presets from "./components/Presets";
import OwnedCollection from "./components/OwnedCollection";
import WishlistHub from "./components/WishlistHub";
import WishlistOverlap from "./components/WishlistOverlap";
import TradelistManager from "./components/TradelistManager";
import DecksHub from "./components/DecksHub";
import DeckUpdater from "./pages/DeckUpdater";
import AdminDashboard from "./pages/AdminDashboard";
import InviteLanding from "./components/InviteLanding";
import { ToastProvider } from "./context/ToastContext";
import { api } from "./api/client";
import "./styles/nav-auth.css";
import "./styles/tabs.css";
import "./styles/new-landing.css";
import CommanderShowcase from "./components/CommanderShowcase";
import { WishlistProvider } from "./context/WishlistProvider";
import OnboardingModal from "./components/OnboardingModal";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <WishlistProvider>
          <Router>
            <AppContent />
          </Router>
        </WishlistProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [landcycles, setLandcycles] = useState([]);
  const [builderData, setBuilderData] = useState({ lands: [], nonlands: [] });
  const [userCollection, setUserCollection] = useState([]);
  const packageRef = useRef();

  const [selected, setSelected] = useState({
    packages: new Set(),
    landcycles: new Set(),
    colors: new Set(),
  });

  // Check for pending invite token upon login
  React.useEffect(() => {
    const pendingToken = localStorage.getItem("pending_invite_token");
    if (user && pendingToken) {
      const token = localStorage.getItem("token");
      fetch("/api/playgroups/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ invite_token: pendingToken })
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.success) {
            localStorage.removeItem("pending_invite_token");
            alert(`Success! You joined playgroup "${data.name}"`);
            navigate("/wishlist");
          }
        })
        .catch(err => console.error("Error redeeming pending invite:", err));
    }
  }, [user, navigate]);

  // Load landcycles for presets
  React.useEffect(() => {
    const loadLandcycles = async () => {
      try {
        const res = await fetch('/api/landcycles');
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setLandcycles(data || []);
        } else if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (error) {
        console.error('Failed to load landcycles:', error);
      }
    };
    loadLandcycles();
  }, []);

  // Check if onboarding needs to be shown for the current user
  React.useEffect(() => {
    if (user) {
      const userKey = `onboarding_seen_${user.id || user.username}`;
      if (!localStorage.getItem(userKey)) {
        // Show after a brief delay so the user lands in the app first
        const timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    } else {
      setShowOnboarding(false);
    }
  }, [user]);

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
            <button className="login-modal-close" onClick={() => setShowLogin(false)} title="Close"></button>
            <LoginForm onSuccess={() => setShowLogin(false)} />
          </div>
        </div>
      )}

      {showOnboarding && user && (
        <OnboardingModal user={user} onClose={() => setShowOnboarding(false)} />
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
          <Route path="/alerts/wishlist-overlap" element={<WishlistOverlap />} />
          <Route path="/trade" element={<TradelistManager />} />
          <Route path="/decks" element={<DecksHub />} />
          <Route path="/updater" element={<DeckUpdater />} />
          <Route path="/invite/:token" element={<InviteLanding onOpenLoginModal={() => setShowLogin(true)} />} />
          <Route path="/presets" element={<Presets currentSelection={selected} onApplyPreset={applyPreset} landcycles={landcycles} />} />
          <Route path="/packages" element={<PackageManager ref={packageRef} />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<LandingDashboard />} />
        </Routes>
      </div>
    </>
  );
}

function LandingDashboard() {
  const navigate = useNavigate();
  const [showcaseData, setShowcaseData] = useState(null);

  useEffect(() => {
    fetch("/api/trending/random")
      .then(r => r.json())
      .then(setShowcaseData)
      .catch(console.error);
  }, []);

  return (
    <div className="landing-container">
      <div className="landing-hero">
        <h1 className="hero-title">Forge Your Manabase</h1>
        <p className="hero-subtitle">
          Advanced tools for Commander deckbuilding, collection management, and trade orchestration.
        </p>
      </div>

      {showcaseData && <CommanderShowcase commander={showcaseData.commander} cards={showcaseData.cards} />}


      <div className="features-grid">
        {/* Feature 1: Manabase Deckbuilder */}
        <button className="feature-card" onClick={() => navigate("/builder")}>
          <div className="card-icon">
            <CubeIcon style={{ width: '1em', height: '1em', margin: '0 auto' }} />
          </div>
          <h2 className="card-title-text">Deckbuilder</h2>
          <p className="card-description">
            Build optimal land bases for your Commander decks.
          </p>
        </button>

        {/* Feature 2: Collection & Lists Manager */}
        <button className="feature-card" onClick={() => navigate("/collection")}>
          <div className="card-icon">
            <FolderIcon style={{ width: '1em', height: '1em', margin: '0 auto' }} />
          </div>
          <h2 className="card-title-text">Collection</h2>
          <p className="card-description">
            Manage your physical owned inventory and wishlists.
          </p>
        </button>

        {/* Feature 3: Archidekt Sync */}
        <button className="feature-card" onClick={() => navigate("/decks")}>
          <div className="card-icon">
            <ArrowPathIcon style={{ width: '1em', height: '1em', margin: '0 auto' }} />
          </div>
          <h2 className="card-title-text">Sync Hub</h2>
          <p className="card-description">
            Maintain synchronized copies of your Archidekt decks.
          </p>
        </button>
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
  const [tradeAlerts, setTradeAlerts] = useState(0);
  const [wishlistAlerts, setWishlistAlerts] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      setWishlistAlerts(0);
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

      fetch("/api/collection/wishlist/overlap", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && typeof data.count === 'number') {
            setWishlistAlerts(data.count);
          }
        })
        .catch(err => {
          if (err.name !== 'TypeError') {
            console.error('Error fetching wishlist alerts:', err);
          }
        });
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    window.addEventListener("refreshAlerts", fetchAlerts);

    return () => {
      clearInterval(interval);
      window.removeEventListener("refreshAlerts", fetchAlerts);
    };
  }, [user]);

  const displayName = user?.username || user?.email || "Guest";
  const avatar = user?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${displayName}`;

  return (
    <>
      <nav className="top-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <button className="logo-branding" onClick={() => navigate("/")} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <CubeIcon style={{ width: '1.5rem', height: '1.5rem', marginRight: '4px' }} /> <span style={{ fontSize: '1.5rem' }}>Manabase</span>
          </button>

          <div className="desktop-nav-links" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link className="nav-link" to="/wishlist">Proxy</Link>
            <Link className="nav-link" to="/trade">Trade</Link>
            <Link className="nav-link" to="/collection">Collection</Link>
            <Link className="nav-link" to="/decks">Decks</Link>
            <Link className="nav-link" to="/updater">Updater</Link>

            {(user?.email === "quantumaidan@gmail.com" || user?.email === "dev@manabase.com") && (
              <Link className="nav-link" style={{ color: '#fbbf24', fontWeight: 'bold' }} to="/admin">Admin</Link>
            )}

            <div className="nav-dropdown-container">
              <button className="nav-link dropdown-trigger" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                Build <ChevronDownIcon style={{ width: '0.8em', height: '0.8em', marginLeft: '4px' }} />
              </button>
              <div className="nav-dropdown-menu">
                <Link className="nav-dropdown-item" to="/builder">
                  <CubeIcon className="dropdown-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '6px' }} /> Deckbuilder
                </Link>
                <Link className="nav-dropdown-item" to="/presets">
                  <MapPinIcon className="dropdown-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '6px' }} /> Land Presets
                </Link>
                <Link className="nav-dropdown-item" to="/packages">
                  <FolderIcon className="dropdown-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '6px' }} /> Custom Packages
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="nav-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div className="desktop-icons" style={{ display: 'flex', gap: '1rem', color: '#cbd5e1', fontSize: '1.2rem', cursor: 'pointer', alignItems: 'center' }}>
            <MoonIcon title="Toggle Dark Mode" style={{ width: '1.2em', height: '1.2em' }} />
            <MapPinIcon title="Pins" style={{ width: '1.2em', height: '1.2em' }} />
            <div className="nav-dropdown-container">
              <button className="nav-link dropdown-trigger" style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} title="Notifications">
                <BellIcon style={{ width: '1.2em', height: '1.2em', color: '#cbd5e1' }} />
                {(tradeAlerts + wishlistAlerts) > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-10px',
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
                    {tradeAlerts + wishlistAlerts}
                  </div>
                )}
              </button>
              <div className="nav-dropdown-menu" style={{ right: 0, left: 'auto', minWidth: '220px', top: '100%' }}>
                {tradeAlerts > 0 && (
                  <Link className="nav-dropdown-item" to="/trade">
                    You have {tradeAlerts} pending trade{tradeAlerts !== 1 ? 's' : ''}
                  </Link>
                )}
                {wishlistAlerts > 0 && (
                  <Link className="nav-dropdown-item" to="/alerts/wishlist-overlap">
                    {wishlistAlerts} wishlist card{wishlistAlerts !== 1 ? 's' : ''} in your collection!
                  </Link>
                )}
                {(tradeAlerts + wishlistAlerts) === 0 && (
                  <div className="nav-dropdown-item" style={{ color: '#94a3b8', cursor: 'default' }}>
                    No new notifications
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="nav-profile desktop-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {user ? (
              <>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={logout} title="Log out">
                  <img src={avatar} alt="Profile" className="nav-avatar" />
                </button>
                {isTestUser && (
                  <button
                    className="cycle-user-btn"
                    onClick={handleCycleUser}
                    title={`Cycle to ${nextTestUser.username}`}
                  >
                    <ArrowPathRoundedSquareIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Switch: {nextTestUser.username}
                  </button>
                )}
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

          <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ cursor: 'pointer', color: 'white', background: 'none', border: 'none', display: 'none' }}>
            {mobileMenuOpen ? <XMarkIcon style={{ width: '2rem', height: '2rem' }} /> : <Bars3Icon style={{ width: '2rem', height: '2rem' }} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu-content">
            <Link className="mobile-nav-link" to="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            <Link className="mobile-nav-link" to="/wishlist" onClick={() => setMobileMenuOpen(false)}>Proxy</Link>
            <Link className="mobile-nav-link" to="/trade" onClick={() => setMobileMenuOpen(false)}>Trade</Link>
            <Link className="mobile-nav-link" to="/collection" onClick={() => setMobileMenuOpen(false)}>Collection</Link>
            <Link className="mobile-nav-link" to="/decks" onClick={() => setMobileMenuOpen(false)}>Decks</Link>
            <Link className="mobile-nav-link" to="/updater" onClick={() => setMobileMenuOpen(false)}>Deck Updater</Link>
            <Link className="mobile-nav-link" to="/builder" onClick={() => setMobileMenuOpen(false)}>Deckbuilder</Link>
            <Link className="mobile-nav-link" to="/presets" onClick={() => setMobileMenuOpen(false)}>Land Presets</Link>
            <Link className="mobile-nav-link" to="/packages" onClick={() => setMobileMenuOpen(false)}>Custom Packages</Link>

            {(user?.email === "quantumaidan@gmail.com" || user?.email === "dev@manabase.com") && (
              <Link className="mobile-nav-link" style={{ color: '#fbbf24' }} to="/admin" onClick={() => setMobileMenuOpen(false)}>Admin Dashboard</Link>
            )}

            <div className="mobile-nav-divider"></div>

            {user ? (
              <>
                <div className="mobile-profile-section">
                  <img src={avatar} alt="Profile" className="nav-avatar" />
                  <span className="mobile-nav-name">{displayName}</span>
                </div>
                <button className="mobile-action-btn" onClick={() => { logout(); setMobileMenuOpen(false); }}>Log out</button>
              </>
            ) : (
              <button className="mobile-action-btn" onClick={() => { setShowLogin(true); setMobileMenuOpen(false); }}>Log in / Sign up</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
