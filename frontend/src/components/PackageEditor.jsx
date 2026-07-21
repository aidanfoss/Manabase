import React, { useState, useEffect, useMemo } from "react";
import { api } from "../api/client";
import "../styles/packageManager.css";

export default function PackageEditor({ package: pkg, onClose, onApply, onSave }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [packageSearch, setPackageSearch] = useState("");
  const [currentPackage, setCurrentPackage] = useState(pkg);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Helper to parse cards from string
  const parsePackage = (packageData) => {
    if (!packageData) return packageData;
    try {
      return {
        ...packageData,
        cards: typeof packageData.cards === "string" ? JSON.parse(packageData.cards) : packageData.cards,
      };
    } catch {
      return { ...packageData, cards: [] };
    }
  };

  useEffect(() => {
    setCurrentPackage(parsePackage(pkg));
  }, [pkg]);

  // Auto-save functionality
  useEffect(() => {
    if (!hasUnsavedChanges || !currentPackage || !currentPackage.id) return;

    const timeout = setTimeout(async () => {
      try {
        const savedPackage = await api.savePackage(currentPackage);
        const parsedPackage = parsePackage(savedPackage);
        setCurrentPackage(parsedPackage);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Auto-save failed:", err);
        // Don't show alert for auto-save failures to avoid annoying the user
        // The user can manually save if needed
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [currentPackage, hasUnsavedChanges]);

  // Manual search
  async function handleSearch(e) {
    e?.preventDefault?.();
    if (!searchTerm.trim()) return;
    try {
      const data = await api.json(`/scryfall?q=${encodeURIComponent(searchTerm)}`);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
      // Show user-friendly error message
      if (err.message.includes('404')) {
        setSearchResults([]); // No results found
      } else {
        alert("Search temporarily unavailable. Please try again.");
      }
    }
  }

  // Live search (debounced)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const data = await api.json(`/scryfall?q=${encodeURIComponent(searchTerm)}`);
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Live search failed:", err);
        setSearchResults([]);
        // Don't show alert for live search failures to avoid annoying the user
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // Card management
  function handleAdd(card) {
    if (!currentPackage) return;
    const updated = {
      ...currentPackage,
      cards: [...(currentPackage.cards || []), card],
    };
    setCurrentPackage(updated);
    setHasUnsavedChanges(true);
  }

  function handleRemove(card) {
    if (!currentPackage) return;
    const updated = {
      ...currentPackage,
      cards: (currentPackage.cards || []).filter((c) => c.id !== card.id),
    };
    setCurrentPackage(updated);
    setHasUnsavedChanges(true);
  }

  // Filter cards within package
  const filteredCards = useMemo(() => {
    if (!currentPackage || !Array.isArray(currentPackage.cards)) return [];
    const cards = currentPackage.cards;
    if (!packageSearch.trim()) return cards;
    const q = packageSearch.toLowerCase();
    return cards.filter((c) => c.name?.toLowerCase().includes(q));
  }, [currentPackage, packageSearch]);

  const handleApply = () => {
    if (onApply && typeof onApply === 'function') {
      onApply(currentPackage);
    }
    onClose();
  };

  const handleSave = async () => {
    try {
      const savedPackage = await api.savePackage(currentPackage);
      const parsedPackage = parsePackage(savedPackage);
      setCurrentPackage(parsedPackage);
      setHasUnsavedChanges(false);
      if (onSave) {
        onSave(parsedPackage);
      }
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save package. Please try again.");
    }
  };

  if (!currentPackage) return null;

  return (
    <div className="package-editor">
      <div className="package-editor-header">
        <div className="header-content">
          <h2>{currentPackage.name}</h2>
          <div className="header-subtitle">
            {currentPackage.description && <p>{currentPackage.description}</p>}
            <p>{filteredCards.length} cards • {hasUnsavedChanges ? "Unsaved changes" : "Saved"}</p>
          </div>
        </div>
        <button className="btn-close" onClick={onClose}>
          ×
        </button>
      </div>

      {/* Left/Right Layout - No Sidebar */}
      <div className="package-editor-main">
        {/* Left: Search cards (debounced live search) */}
        <div className="package-column">
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
                onClick={() => handleAdd(card)}
                title="Click to add"
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

        {/* Right: Current Package Cards */}
        <div className="package-column">
          <form
            className="pm-search"
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

          {filteredCards.length === 0 && (
            <div className="pm-disabled-msg">
              No cards in this package yet. Search for cards on the left to add them!
            </div>
          )}
        </div>
      </div>

      <div className="package-editor-footer">
        <div className="footer-summary">
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">Total Cards:</span>
              <span className="stat-value">{filteredCards.length}</span>
            </div>
            {currentPackage.userId && (
              <div className="stat-item">
                <span className="stat-label">Author:</span>
                <span className="stat-value">You</span>
              </div>
            )}
          </div>
        </div>

        <div className="package-editor-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-secondary" onClick={handleSave} disabled={!hasUnsavedChanges}>
            Save
          </button>
          <button className="btn-primary" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
