import React, { useEffect, useState, useMemo } from "react";
import { api } from "../api/client";
import "../styles/packageManager.css";

export default function PackageManager() {
  const [packages, setPackages] = useState([]);
  const [currentPackage, setCurrentPackage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [packageSearch, setPackageSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draggedCard, setDraggedCard] = useState(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);

  // Load saved packages
  useEffect(() => {
    api.getPackages().then(setPackages).catch(console.error);
  }, []);

  // Search cards via backend proxy (Scryfall)
  async function handleSearch(e) {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    try {
      const data = await api.json(`/scryfall?q=${encodeURIComponent(searchTerm)}`);
      setSearchResults(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error("Scryfall search failed:", err);
    }
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

  // --- Package CRUD ---
  function newPackage() {
    setCurrentPackage({ name: "Untitled Package", cards: [] });
  }

  async function savePackage() {
    if (!currentPackage) return;
    await api.savePackage(currentPackage);
    alert("💾 Package saved!");
  }

  async function saveAsPackage() {
    if (!currentPackage) return;
    const renamed = prompt("Enter new package name:", currentPackage.name);
    if (!renamed) return;
    await api.savePackage({ ...currentPackage, name: renamed });
    alert("📦 Saved as new package!");
  }

  async function deletePackage() {
    if (!currentPackage?.id) return;
    if (!window.confirm("Delete this package?")) return;
    await api.deletePackage(currentPackage.id);
    alert("🗑️ Deleted package.");
    setCurrentPackage(null);
  }

  // --- Derived filtered list for right search ---
  const filteredCards = useMemo(() => {
    const cards = currentPackage?.cards || [];
    if (!packageSearch.trim()) return cards;
    const q = packageSearch.toLowerCase();
    return cards.filter((c) => c.name?.toLowerCase().includes(q));
  }, [currentPackage, packageSearch]);

  // --- Drag/drop handlers ---
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
      {/* Header */}
      <header className="pm-header">
        <div className="pm-header-left">
          <button onClick={newPackage}>New</button>
          <button onClick={savePackage}>Save</button>
          <button className="saveas" onClick={saveAsPackage}>
            Save As
          </button>
        </div>
      </header>

      {/* Main Layout */}
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

        {/* Right: Package Search + Filtered Cards */}
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
                  placeholder="Filter cards in package..."
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
              ⚠️ Select or create a package to view its cards.
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="pm-footer">
        <div>Your Packages:</div>
        <div className="pm-packages">
          {packages.map((p) => (
            <button
              key={p.id || p.name}
              className={`pkg-btn ${currentPackage?.id === p.id ? "active" : ""}`}
              onClick={() => setCurrentPackage(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
