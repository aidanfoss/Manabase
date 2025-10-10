import React, { useEffect, useState, useMemo } from "react";
import { api } from "../api/client";
import "../styles/packageManager.css";

export default function PackageManager() {
  const [packages, setPackages] = useState([]);
  const [currentPackage, setCurrentPackage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [packageSearch, setPackageSearch] = useState("");
  const [draggedCard, setDraggedCard] = useState(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false); // new modal toggle

  // Load saved packages list
  useEffect(() => {
    api.getPackages().then(setPackages).catch(console.error);
  }, []);

  // --- Search via backend (local or proxy) ---
  async function handleSearch(e) {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    try {
      const data = await api.json(`/scryfall?q=${encodeURIComponent(searchTerm)}`);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Search failed:", err);
    }
  }

  // --- Create new package ---
  function newPackage() {
    const name = prompt("Enter a name for your new package:");
    if (!name) return;
    setCurrentPackage({ name, cards: [] });
  }

  // --- Save current package ---
  async function savePackage() {
    if (!currentPackage) return;
    await api.savePackage(currentPackage);
    alert("💾 Package saved!");
    // refresh list after saving
    const updatedList = await api.getPackages();
    setPackages(updatedList);
  }

  // --- Load package ---
  function loadPackage(pkg) {
    setCurrentPackage(pkg);
    setShowLoadMenu(false);
  }

  // --- Delete package ---
  async function deletePackage(pkg) {
    if (!window.confirm(`Delete "${pkg.name}"?`)) return;
    await api.deletePackage(pkg.id);
    alert("🗑️ Deleted package.");
    // reload the list
    const updatedList = await api.getPackages();
    setPackages(updatedList);
    // clear current package if it was deleted
    if (currentPackage?.id === pkg.id) setCurrentPackage(null);
  }

  // --- Placeholder for future Share feature ---
  // TODO: Implement share functionality (e.g., generate link, export JSON)
  function sharePackage(pkg) {
    alert("🚧 Share feature coming soon!");
  }

  // --- Card add/remove ---
  function handleAdd(card) {
    if (!currentPackage) return;
    const updated = {
      ...currentPackage,
      cards: [...(currentPackage.cards || []), card],
    };
    setCurrentPackage(updated);
  }

  function handleRemove(card) {
    if (!currentPackage) return;
    const updated = {
      ...currentPackage,
      cards: (currentPackage.cards || []).filter((c) => c.id !== card.id),
    };
    setCurrentPackage(updated);
  }

  // --- Filter cards within package ---
  const filteredCards = useMemo(() => {
    const cards = currentPackage?.cards || [];
    if (!packageSearch.trim()) return cards;
    const q = packageSearch.toLowerCase();
    return cards.filter((c) => c.name?.toLowerCase().includes(q));
  }, [currentPackage, packageSearch]);

  // --- Drag and drop handlers ---
  function handleDragStart(card) {
    setDraggedCard(card);
  }

  function handleDragOver(e) {
    if (!currentPackage) return;
    e.preventDefault();
    setIsOverDropZone(true);
  }

  function handleDragLeave() {
    setIsOverDropZone(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    if (draggedCard && currentPackage) {
      handleAdd(draggedCard);
    }
    setDraggedCard(null);
    setIsOverDropZone(false);
  }

  return (
    <div className="pm-page">
      {/* === Header === */}
      <header className="pm-header">
        <div className="pm-header-left">
          <button onClick={newPackage}>New</button>
          <button onClick={savePackage}>Save</button>
          <button onClick={() => setShowLoadMenu(true)}>Load</button>
        </div>
      </header>

      {/* === Main Layout === */}
      <main className="pm-main">
        {/* Left: Scryfall Search */}
        <div className="pm-column">
          <form className="pm-search" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Find and add cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit">🔍</button>
          </form>

          <div className="pm-grid">
            {searchResults.map((card) => (
              <div
                key={card.id}
                className="pm-card"
                draggable
                onDragStart={() => handleDragStart(card)}
                title="Drag to add"
              >
                <img
                  src={
                    card.image_uris?.normal ||
                    card.image_uris?.small ||
                    card.image ||
                    ""
                  }
                  alt={card.name}
                />
                <div className="pm-add">+</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Current Package */}
        <div
          className={`pm-column ${
            !currentPackage ? "pm-column-disabled" : ""
          } ${isOverDropZone ? "pm-drop-highlight" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {currentPackage ? (
            <>
              <form className="pm-search small" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="text"
                  placeholder={`Filter cards in "${currentPackage.name}"...`}
                  value={packageSearch}
                  onChange={(e) => setPackageSearch(e.target.value)}
                />
                <button type="button" disabled>
                  🔍
                </button>
              </form>

              <div className="pm-grid">
                {filteredCards.map((card) => (
                  <div
                    key={card.id}
                    className="pm-card"
                    onClick={() => handleRemove(card)}
                    title="Click to remove"
                  >
                    <img
                      src={
                        card.image_uris?.normal ||
                        card.image_uris?.small ||
                        card.image ||
                        ""
                      }
                      alt={card.name}
                    />
                    <div className="pm-remove">×</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="pm-disabled-msg">
              ⚠️ Create or load a package to view its cards.
            </div>
          )}
        </div>
      </main>

      {/* === Load Menu Modal === */}
      {showLoadMenu && (
        <div className="pm-modal-overlay" onClick={() => setShowLoadMenu(false)}>
          <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📦 Manage Packages</h3>
            {packages.length === 0 ? (
              <p className="pm-disabled-msg">No saved packages yet.</p>
            ) : (
              <ul className="pm-package-list">
                {packages.map((p) => (
                  <li key={p.id || p.name}>
                    <span className="pkg-name">{p.name}</span>
                    <div className="pkg-actions">
                      <button onClick={() => loadPackage(p)}>Load</button>
                      <button onClick={() => sharePackage(p)} disabled>
                        Share
                      </button>
                      <button className="delete" onClick={() => deletePackage(p)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button className="pm-close" onClick={() => setShowLoadMenu(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
