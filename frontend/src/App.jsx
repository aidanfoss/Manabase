import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api/client";
import { encodeSelection, decodeSelection } from "./utils/hashState";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import BottomBar from "./components/BottomBar";
import LoginForm from "./components/LoginForm";
import { AuthProvider, useAuth } from "./context/AuthContext";
import PackageManager from "./components/PackageManager";
import "./styles.css";

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
      {screen === "main" ? <MainApp /> : <PackageManager />}
    </>
  );
}

function TopNav({ user, screen, setScreen, showLogin, setShowLogin }) {
  const { logout } = useAuth();

  const displayName = user?.username || user?.email || "Guest";
  const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${displayName}`;

  return (
    <nav className="top-nav">
      {/* Left: profile or login */}
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

      {/* Right: navigation buttons */}
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

function MainApp() {
  const [packages, setPackages] = useState([]);
  const [landcycles, setLandcycles] = useState([]);
  const [data, setData] = useState({ lands: [], nonlands: [] });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const [selected, setSelected] = useState({
    packages: new Set(),
    landcycles: new Set(),
    colors: new Set(),
  });

  // restore hash
  useEffect(() => {
    if (window.location.hash.length > 1) {
      const decoded = decodeSelection(window.location.hash.substring(1));
      if (decoded && decoded.version >= 1) {
        setSelected({
          packages: new Set(decoded.packages || decoded.metas || []),
          landcycles: new Set(decoded.landcycles || []),
          colors: new Set(decoded.colors || []),
        });
      }
    }
  }, []);

  // load data
  useEffect(() => {
    (async () => {
      try {
        const [p, l] = await Promise.all([
          api.getPackages(),
          api.getLandcycles(),
        ]);
        setPackages(p || []);
        setLandcycles(l || []);
      } catch (e) {
        console.error("Failed to load packages/landcycles:", e);
      }
    })();
  }, []);

  function toggle(setName, value) {
    setSelected((prev) => {
      const ns = new Set(prev[setName]);
      ns.has(value) ? ns.delete(value) : ns.add(value);
      return { ...prev, [setName]: ns };
    });
  }

  const query = useMemo(() => {
    const colorsArr = [...selected.colors];
    const effectiveColors = colorsArr.length === 0 ? ["colorless"] : colorsArr;
    return {
      packages: [...selected.packages],
      landcycles: [...selected.landcycles],
      colors: effectiveColors,
    };
  }, [selected]);

  // fetch cards
  useEffect(() => {
    setStatus("loading");
    setError(null);

    api
      .getCards(query)
      .then((payload) => {
        if (payload?.fetchableSummary?.length && landcycles.length) {
          setLandcycles((prev) =>
            prev.map((lc) => {
              const found = payload.fetchableSummary.find(
                (f) => f.id === lc.id || f.id === lc.name
              );
              return found ? { ...lc, fetchable: found.fetchable } : lc;
            })
          );
        }

        let parsed = { lands: [], nonlands: [] };
        if (Array.isArray(payload)) parsed.lands = payload;
        else if (payload && typeof payload === "object")
          parsed = {
            lands: payload.lands || [],
            nonlands: payload.nonlands || [],
          };

        setData(parsed);
        setStatus("done");

        const selection = {
          version: 1,
          packages: [...selected.packages],
          landcycles: [...selected.landcycles],
          colors: [...selected.colors],
        };
        const hash = encodeSelection(selection);
        window.history.replaceState(null, "", `#${hash}`);
      })
      .catch((e) => {
        setError(e.message || String(e));
        setStatus("error");
      });
  }, [
    query.packages.join("|"),
    query.landcycles.join("|"),
    query.colors.join("|"),
  ]);

  return (
    <div className={`app ${collapsed ? "" : "sidebar-open"}`}>
      <button
        className={`sidebar-toggle ${collapsed ? "" : "open"}`}
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Open menu" : "Hide menu"}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      <Sidebar
        packages={packages}
        landcycles={landcycles}
        selected={selected}
        toggle={toggle}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <MainContent data={data} status={status} error={error} />
      <BottomBar data={data} />
    </div>
  );
}
