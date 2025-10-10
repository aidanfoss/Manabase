import React, { useEffect, useState } from "react";
import { packageAPI } from "../api/packages";
import { useAuth } from "../context/AuthContext";
import "./styles.css";

export default function PackageManager() {
  const { user, token } = useAuth();
  const [packages, setPackages] = useState([]);
  const [activePkg, setActivePkg] = useState(null);
  const [cards, setCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 🧭 Load user packages
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
        setPackages(parsed || []);
      } catch (e) {
        console.error("Failed to load packages:", e);
      }
    })();
  }, [token]);

  // 🔎 Search cards from Scryfall
  async function handleSearch(e) {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchTerm)}`
      );
      const data = await res.json();
      setSearchResults(data.data || []);
    } catch (err) {
      console.error("Scryfall search failed:", err);
    } finally {
      setLoading(false);
    }
  }

  // ➕ Add card
  function addCard(card) {
    if (cards.some((c) => c.id === card.id)) return;
    setCards([...cards, card]);
  }

  // ❌ Remove card
  function removeCard(id) {
    setCards(cards.filter((c) => c.id !== id));
  }

  // 💾 Save (create or update)
  async function savePackage() {
    if (!cards.length) return alert("Add at least one card first!");
    const name =
      activePkg?.name ||
      prompt("Enter a name for this package:", activePkg?.name || "");
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

      let saved;
      if (activePkg) {
        // update existing package
        saved = await packageAPI.update(activePkg.id, payload);
        alert(`✅ Updated package "${name}"!`);
      } else {
        // create new package
        saved = await packageAPI.create(payload);
        alert(`✅ Created package "${name}"!`);
      }

      // Refresh list
      const refreshed = await packageAPI.list();
      const parsed = refreshed.map((p) => ({
        ...p,
        cards:
          typeof p.cards === "string"
            ? JSON.parse(p.cards || "[]")
            : p.cards || [],
      }));
      setPackages(parsed);
      setActivePkg(null);
      setCards([]);
      setSearchResults([]);
    } catch (e) {
      console.error("Save failed:", e);
      alert("Failed to save package.");
    } finally {
      setSaving(false);
    }
  }

  // ✏️ Load for editing
  function loadPackage(pkg) {
    const parsedCards =
      typeof pkg.cards === "string" ? JSON.parse(pkg.cards || "[]") : pkg.cards || [];
    setActivePkg(pkg);
    setCards(parsedCards);
    setSearchResults([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 🗑️ Delete
  async function deletePackage(pkg) {
    if (!window.confirm(`Delete package "${pkg.name}" permanently?`)) return;
    try {
      await packageAPI.delete(pkg.id);
      setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
      if (activePkg?.id === pkg.id) {
        setActivePkg(null);
        setCards([]);
      }
      alert(`🗑️ Deleted "${pkg.name}"`);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete package.");
    }
  }

  // ➕ Create new blank package
  function newPackage() {
    setActivePkg(null);
    setCards([]);
    setSearchResults([]);
  }

  return (
    <div className="package-page">
      <div className="package-topbar">
        <h1>Package Manager</h1>
        <div className="user-info">
          Logged in as {user?.username || user?.email}
        </div>
      </div>

      <div className="package-section">
        {/* Left side — search + add */}
        <div className="left-panel">
          <h2>{activePkg ? `Editing: ${activePkg.name}` : "New Package"}</h2>

          <form onSubmit={handleSearch} className="search-bar">
            <input
              type="text"
              placeholder="Search cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </form>

          <div className="search-results">
            {searchResults.map((card) => (
              <div
                key={card.id}
                className="search-card"
                onClick={() => addCard(card)}
                title="Click to add"
              >
                <img src={card.image_uris?.small} alt={card.name} />
                <div className="card-name">{card.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right side — current package */}
        <div className="right-panel">
          <div className="right-header">
            <h2>Cards in this Package</h2>
            {activePkg && (
              <button className="new-btn" onClick={newPackage}>
                ➕ New
              </button>
            )}
          </div>

          {cards.length === 0 && <p className="empty">No cards added yet.</p>}

          <div className="added-cards">
            {cards.map((c) => (
              <div key={c.id} className="added-card">
                <img src={c.image_uris?.small || c.image} alt={c.name} />
                <div className="card-title">{c.name}</div>
                <button onClick={() => removeCard(c.id)}>✕</button>
              </div>
            ))}
          </div>

          <button className="save-btn" onClick={savePackage} disabled={saving}>
            {saving
              ? "Saving..."
              : activePkg
              ? "💾 Update Package"
              : "💾 Save Package"}
          </button>

          {activePkg && (
            <button
              className="delete-btn"
              onClick={() => deletePackage(activePkg)}
              style={{ marginTop: "0.5rem" }}
            >
              🗑️ Delete Package
            </button>
          )}

          {/* Package list */}
          {packages.length > 0 && (
            <div className="existing-packages">
              <h3>Your Packages</h3>
              {packages.map((p) => (
                <div
                  key={p.id}
                  className={`package-entry ${
                    activePkg?.id === p.id ? "active" : ""
                  }`}
                >
                  <button onClick={() => loadPackage(p)}>{p.name}</button>
                  <button
                    className="small-delete"
                    onClick={() => deletePackage(p)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
