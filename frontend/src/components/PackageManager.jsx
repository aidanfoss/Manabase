import React, { useEffect, useState } from "react";
import { packageAPI } from "../api/packages";
import { useAuth } from "../context/AuthContext";
import { parseCardLink } from "../utils/parseCardLink";
import "../styles/packageManager.css";

export default function PackageManager() {
  const { user, token } = useAuth();
  const [packages, setPackages] = useState([]);
  const [activePkg, setActivePkg] = useState(null);
  const [cards, setCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const base = import.meta.env.VITE_API_URL || "/api";

  // Load user packages
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await packageAPI.list();
        const parsed = data.map((p) => ({
          ...p,
          cards:
            typeof p.cards === "string"
              ? JSON.parse(p.cards || "[]")
              : p.cards || [],
        }));
        setPackages(parsed);
      } catch (err) {
        console.error("Failed to load packages:", err);
      }
    })();
  }, [token]);

  // Search Scryfall proxy
  async function handleSearch(e) {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${base}/scryfall?q=${encodeURIComponent(searchTerm)}`);
      const json = await res.json();
      setSearchResults(json.data || []);
    } catch (err) {
      console.error("Scryfall search failed:", err);
    } finally {
      setLoading(false);
    }
  }

  // Card actions
  const addCard = (card) =>
    setCards((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, card]));
  const removeCard = (id) => setCards((prev) => prev.filter((c) => c.id !== id));

  // Save / Save As / Delete
  async function savePackage(isCopy = false) {
    if (!cards.length) return alert("Add at least one card first!");
    let name =
      isCopy || !activePkg
        ? prompt("Enter name for new package:", activePkg?.name || "")
        : activePkg?.name || prompt("Enter a name for this package:");
    if (!name) return;

    setSaving(true);
    try {
      const payload = {
        name,
        cards: cards.map((c) => ({
          id: c.id,
          name: c.name,
          set: c.set_name || c.set,
          image: c.image_uris?.normal || c.image || "",
        })),
      };

      if (isCopy || !activePkg) {
        await packageAPI.create(payload);
      } else {
        await packageAPI.update(activePkg.id, payload);
      }

      const refreshed = await packageAPI.list();
      const parsed = refreshed.map((p) => ({
        ...p,
        cards:
          typeof p.cards === "string"
            ? JSON.parse(p.cards || "[]")
            : p.cards || [],
      }));
      setPackages(parsed);
      alert("✅ Saved successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const deletePackage = async (pkg) => {
    if (!pkg || !window.confirm(`Delete "${pkg.name}" permanently?`)) return;
    try {
      await packageAPI.delete(pkg.id);
      setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
      setActivePkg(null);
      setCards([]);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const loadPackage = (pkg) => {
    const parsed =
      typeof pkg.cards === "string" ? JSON.parse(pkg.cards || "[]") : pkg.cards || [];
    setActivePkg(pkg);
    setCards(parsed);
  };
  const newPackage = () => {
    setActivePkg(null);
    setCards([]);
  };

  // Drag & drop
  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    const data = e.dataTransfer.getData("text");
    const parsed = parseCardLink(data);
    if (!parsed) return;
    try {
      if (parsed.type === "card" && parsed.name) {
        const res = await fetch(`${base}/scryfall?q=${encodeURIComponent(parsed.name)}`);
        const json = await res.json();
        const card = json.data?.[0];
        if (card) addCard(card);
      }
    } catch (err) {
      console.error("Drop add failed:", err);
    }
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnter = (e) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = () => setDragActive(false);

  return (
    <div
      className="mox-style-layout"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {dragActive && <div className="drag-overlay">Drop cards here</div>}

      {/* HEADER BAR */}
      <header className="mox-header">
        <div className="left-controls">
          <button onClick={newPackage}>New</button>
          <button onClick={() => savePackage(false)}>💾 Save</button>
          <button onClick={() => savePackage(true)}>📁 Save As</button>
          {activePkg && (
            <button className="delete" onClick={() => deletePackage(activePkg)}>
              🗑 Delete
            </button>
          )}
        </div>
        <div className="center-search">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Find and add cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit">🔍</button>
          </form>
        </div>
        <div className="right-controls">
          <span>Logged in as {user?.username || user?.email}</span>
        </div>
      </header>

      {/* BODY GRID */}
      <main className="mox-main">
        {/* LEFT: Search Results */}
        <section className="mox-panel">
          <h3>Search Results</h3>
          <div className="card-grid">
            {searchResults.map((card) => (
              <div key={card.id} className="card-tile" onClick={() => addCard(card)}>
                <img src={card.image_uris?.small} alt={card.name} />
                <div className="add-icon">+</div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT: Package Contents */}
        <section className="mox-panel">
          <h3>{activePkg ? activePkg.name : "Untitled Package"}</h3>
          <div className="card-grid">
            {cards.map((c) => (
              <div key={c.id} className="card-tile">
                <img src={c.image_uris?.small || c.image} alt={c.name} />
                <div className="remove-icon" onClick={() => removeCard(c.id)}>
                  ✕
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="mox-footer">
        <h4>Your Packages</h4>
        <div className="pkg-list">
          {packages.map((p) => (
            <button
              key={p.id}
              className={`pkg-item ${activePkg?.id === p.id ? "active" : ""}`}
              onClick={() => loadPackage(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
