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

  // Load user packages
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await packageAPI.list();
        setPackages(data || []);
      } catch (e) {
        console.error("Failed to load packages:", e);
      }
    })();
  }, [token]);

  // --- Search Scryfall ---
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

  // --- Add card to current draft list ---
  function addCard(card) {
    if (cards.some((c) => c.id === card.id)) return; // prevent duplicates
    setCards([...cards, card]);
  }

  // --- Remove card ---
  function removeCard(id) {
    setCards(cards.filter((c) => c.id !== id));
  }

  // --- Save as new package ---
  async function savePackage() {
    if (!cards.length) return alert("Add at least one card first!");
    const name = prompt("Enter a name for this package:");
    if (!name) return;

    setSaving(true);
    try {
      const payload = {
        name,
        cards: cards.map((c) => ({
          id: c.id,
          name: c.name,
          set: c.set_name,
          image: c.image_uris?.normal || "",
        })),
      };
      const saved = await packageAPI.create(payload);
      setPackages([...packages, saved]);
      setCards([]);
      alert(`✅ Saved package "${name}"!`);
    } catch (e) {
      console.error("Save failed:", e);
      alert("Failed to save package.");
    } finally {
      setSaving(false);
    }
  }

  // --- Load existing package for editing ---
  function loadPackage(pkg) {
    setActivePkg(pkg);
    setCards(pkg.cards || []);
    setSearchResults([]);
  }

  return (
    <div className="package-page">
      <div className="package-topbar">
        <h1>Package Manager</h1>
        <div className="user-info">Logged in as {user?.username || user?.email}</div>
      </div>

      <div className="package-section">
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

        <div className="right-panel">
          <h2>Cards in this Package</h2>
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
            {saving ? "Saving..." : "💾 Save Package"}
          </button>

          {packages.length > 0 && (
            <div className="existing-packages">
              <h3>Your Packages</h3>
              {packages.map((p) => (
                <button key={p.id} onClick={() => loadPackage(p)}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
