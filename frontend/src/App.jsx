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

  if (!user) return <LoginForm />;

  return (
    <>
      <TopNav screen={screen} setScreen={setScreen} />
      {screen === "main" ? <MainApp /> : <PackageManager />}
    </>
  );
}

function TopNav({ screen, setScreen }) {
  return (
    <nav className="top-nav">
      <h1 className="logo">Manabase Builder</h1>
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
        >
          📦 Packages
        </button>
      </div>
    </nav>
  );
}

function MainApp() {
  const [metas, setMetas] = useState([]);
  const [landcycles, setLandcycles] = useState([]);
  const [data, setData] = useState({ lands: [], nonlands: [] });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false); // start visible by default

  const [selected, setSelected] = useState({
    metas: new Set(),
    landcycles: new Set(),
    colors: new Set(),
  });

  // Restore hash from URL
  useEffect(() => {
    if (window.location.hash.length > 1) {
      const decoded = decodeSelection(window.location.hash.substring(1));
      if (decoded && decoded.version >= 1) {
        setSelected({
          metas: new Set(decoded.metas || []),
          landcycles: new Set(decoded.landcycles || []),
          colors: new Set(decoded.colors || []),
        });
      }
    }
  }, []);

  // Load metas + landcycles
  useEffect(() => {
    (async () => {
      try {
        const [m, l] = await Promise.all([api.getMetas(), api.getLandcycles()]);
        setMetas(m || []);
        setLandcycles(l || []);
      } catch (e) {
        console.error("Failed to load metas/landcycles:", e);
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
      metas: [...selected.metas],
      landcycles: [...selected.landcycles],
      colors: effectiveColors,
    };
  }, [selected]);

  // Fetch cards from backend
  useEffect(() => {
    setStatus("loading");
    setError(null);

    api
      .getCards(query)
      .then((payload) => {
        // Update landcycle fetchability
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

        // Parse response
        let parsed = { lands: [], nonlands: [] };
        if (Array.isArray(payload)) parsed.lands = payload;
        else if (payload && typeof payload === "object")
          parsed = {
            lands: payload.lands || [],
            nonlands: payload.nonlands || [],
          };

        setData(parsed);
        setStatus("done");

        // Update URL hash
        const selection = {
          version: 1,
          metas: [...selected.metas],
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
  }, [query.metas.join("|"), query.landcycles.join("|"), query.colors.join("|")]);

  return (
    <div className={`app ${collapsed ? "" : "sidebar-open"}`}>
      {/* === Sidebar Toggle Button === */}
      <button
        className={`sidebar-toggle ${collapsed ? "" : "open"}`}
        onClick={() => setCollapsed((c) => !c)}
      >
        ☰
      </button>

      {/* === Slide-out Sidebar === */}
      <aside className={`aside-slide ${collapsed ? "hidden" : "visible"}`}>
        <Sidebar
          metas={metas}
          landcycles={landcycles}
          selected={selected}
          toggle={toggle}
        />
      </aside>

      {/* === Main Content === */}
      <MainContent data={data} status={status} error={error} />
      <BottomBar data={data} />
    </div>
  );
}
