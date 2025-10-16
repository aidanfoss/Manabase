import React, { useEffect, useState, useMemo, useImperativeHandle, forwardRef } from "react";
import { api } from "../api/client";
import "../styles/packageManager.css";

const PackageManager = forwardRef(function PackageManager(props, ref) {
  const [packages, setPackages] = useState([]);
  const [currentPackage, setCurrentPackage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [packageSearch, setPackageSearch] = useState("");
  const [draggedCard, setDraggedCard] = useState(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false); // modal toggle
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [undoStack, setUndoStack] = useState([]);

  // Load saved packages once
  useEffect(() => {
    api.getPackages().then(setPackages).catch(console.error);
  }, []);

  // Helper to parse cards from string
  function parsePackage(pkg) {
    if (!pkg) return pkg;
    try {
      return {
        ...pkg,
        cards: typeof pkg.cards === "string" ? JSON.parse(pkg.cards) : pkg.cards,
      };
    } catch {
      return { ...pkg, cards: [] };
    }
  }

  // --- Debounced Auto-Save ---
  useEffect(() => {
    if (!hasUnsavedChanges || !currentPackage) return;

    const timeout = setTimeout(async () => {
      try {
        const savedPackage = await api.savePackage(currentPackage);
        const parsedPackage = parsePackage(savedPackage);
        setCurrentPackage(parsedPackage); // Update with parsed data
        setHasUnsavedChanges(false);
        const updatedList = await api.getPackages();
        setPackages(updatedList);
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 2000); // Auto-save after 2 seconds of no changes

    return () => clearTimeout(timeout);
  }, [currentPackage, hasUnsavedChanges]);

  // --- Manual Search (Enter or Button) ---
  async function handleSearch(e) {
    e?.preventDefault?.();
    if (!searchTerm.trim()) return;
    try {
      const data = await api.json(`/scryfall?q=${encodeURIComponent(searchTerm)}`);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Search failed:", err);
    }
  }

  // --- Debounced Live Search (runs automatically while typing) ---
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    // Wait 500 ms after typing stops
    const timeout = setTimeout(async () => {
      try {
        const data = await api.json(`/scryfall?q=${encodeURIComponent(searchTerm)}`);
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Live search failed:", err);
      }
    }, 500);

    // Cancel previous timer if user keeps typing
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // --- Create new package ---
  function newPackage() {
    const name = prompt("Enter a name for your new package:");
    if (!name) return;
    setCurrentPackage({ name, cards: [] });
    setHasUnsavedChanges(true); // New package needs to be saved
  }

  // --- Save current package ---
  async function savePackage() {
    if (!currentPackage) return;
    const savedPackage = await api.savePackage(currentPackage);
    setCurrentPackage(savedPackage); // Update with new ID
    alert("💾 Package saved!");
    const updatedList = await api.getPackages();
    setPackages(updatedList);
  }

  // --- Load/Delete/Share (future) ---
  function loadPackage(pkg) {
    setCurrentPackage(pkg);
    setHasUnsavedChanges(false); // Reset since loading from saved state
    setShowLoadMenu(false);
  }

  async function deletePackage(pkg) {
    if (!window.confirm(`Delete "${pkg.name}"?`)) return;
    await api.deletePackage(pkg.id);
    alert("🗑️ Deleted package.");
    const updatedList = await api.getPackages();
    setPackages(updatedList);
    if (currentPackage?.id === pkg.id) setCurrentPackage(null);
  }

  // TODO: Future share functionality (e.g. export/share link)
  function sharePackage(pkg) {
    alert("🚧 Share feature coming soon!");
  }

  // --- Undo functionality ---
  useImperativeHandle(ref, () => ({
    newPackage,
    loadPackage: () => setShowLoadMenu(true),
    undo: () => {
      if (undoStack.length > 0) {
        const previousPackage = undoStack[undoStack.length - 1];
        setCurrentPackage(previousPackage);
        setUndoStack(undoStack.slice(0, -1));
      }
    },
  }));

  // --- Card add/remove ---
  function handleAdd(card) {
    if (!currentPackage) return;
    setUndoStack([...undoStack, currentPackage]);
    const updated = {
      ...currentPackage,
      cards: [...(currentPackage.cards || []), card],
    };
    setCurrentPackage(updated);
    setHasUnsavedChanges(true);
  }

  function handleRemove(card) {
    if (!currentPackage) return;
    setUndoStack([...undoStack, currentPackage]);
    const updated = {
      ...currentPackage,
      cards: (currentPackage.cards || []).filter((c) => c.id !== card.id),
    };
    setCurrentPackage(updated);
    setHasUnsavedChanges(true);
  }

  // Reset undo stack when switching packages
  useEffect(() => {
    setUndoStack([]);
  }, [currentPackage?.id]);

  // --- Filter cards within package ---
  const filteredCards = useMemo(() => {
    if (!currentPackage || !Array.isArray(currentPackage.cards)) return [];
    const cards = currentPackage.cards;
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
    if (draggedCard && currentPackage) handleAdd(draggedCard);
    setDraggedCard(null);
    setIsOverDropZone(false);
  }

  return (
    <div className="pm-page">


      {/* === Main Layout === */}
      <main className="pm-main">
        {/* Left: Search cards (debounced live search) */}
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
              <div className="pm-header">
                <form
                  className="pm-search small"
                  onSubmit={(e) => e.preventDefault()}
                >
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
                <button onClick={() => {
                  if (undoStack.length > 0) {
                    const previousPackage = undoStack[undoStack.length - 1];
                    setCurrentPackage(previousPackage);
                    setUndoStack(undoStack.slice(0, -1));
                  }
                }} disabled={undoStack.length === 0}>
                  ↶ Undo
                </button>
              </div>

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
                      <button
                        className="delete"
                        onClick={() => deletePackage(p)}
                      >
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
});

export default PackageManager;
