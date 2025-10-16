import React, { useState, useEffect, useMemo } from "react";
import { PresetsService } from "../services/presetsService";
import PackageSelector from "./PackageSelector";
import LandCycleSelector from "./LandCycleSelector";
import { api } from "../api/client";
import CardSearch from "./CardSearch";
import "../styles/presets.css";

export default function PresetEditor({ preset, onClose, onApply, onSave, landcycles }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [editedPreset, setEditedPreset] = useState({
    name: preset.name,
    description: preset.description,
    packages: [...(preset.packages || [])],
    landCycles: { ...(preset.landCycles || {}) },
    cards: [...(preset.cards || [])],
    price: preset.price
  });
  const [loading, setLoading] = useState(false);
  const [cardSearchQuery, setCardSearchQuery] = useState("");
  const [cardSearchResults, setCardSearchResults] = useState([]);
  const [showCardSearch, setShowCardSearch] = useState(false);

  // Group land cycles by tier for selector
  const groupedLandcycles = useMemo(() => {
    const groups = { premium: [], playable: [], budget: [], terrible: [] };
    for (const lc of landcycles) {
      const tier = lc.tier?.toLowerCase() || "budget";
      (groups[tier] ?? groups.budget).push(lc);
    }
    for (const tier in groups) {
      groups[tier].sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [landcycles]);

  const handleSave = async () => {
    if (!editedPreset.name.trim()) {
      alert("Preset name is required");
      return;
    }

    setLoading(true);
    try {
      const updatedPreset = await PresetsService.updatePreset(preset.id, {
        name: editedPreset.name,
        description: editedPreset.description,
        packages: editedPreset.packages,
        landCycles: editedPreset.landCycles,
        cards: editedPreset.cards
      });
      onSave(updatedPreset);
    } catch (error) {
      console.error("Failed to save preset:", error);
      alert("Failed to save preset");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    // Create a preset-like object with current edits including cards
    const editedPresetData = {
      id: preset.id,
      name: editedPreset.name,
      description: editedPreset.description,
      packages: editedPreset.packages,
      landCycles: editedPreset.landCycles,
      cards: editedPreset.cards,
      price: editedPreset.price
    };
    onApply(editedPresetData);
  };

  const toggleLandcycle = (key, value) => {
    setEditedPreset(prev => {
      const newLandCycles = { ...prev.landCycles };
      if (newLandCycles[value]) {
        delete newLandCycles[value];
      } else {
        newLandCycles[value] = true;
      }
      return {
        ...prev,
        landCycles: newLandCycles
      };
    });
  };

  const togglePackage = (packageId) => {
    setEditedPreset(prev => {
      const packages = [...prev.packages];
      const index = packages.indexOf(packageId);
      if (index >= 0) {
        packages.splice(index, 1);
      } else {
        packages.push(packageId);
      }
      return {
        ...prev,
        packages
      };
    });
  };

  const addCard = (card) => {
    setEditedPreset(prev => {
      const cards = [...prev.cards];
      const cardId = card.id || card.scryfall_id || card.name;
      if (!cards.find(c => (c.id || c.scryfall_id || c.name) === cardId)) {
        cards.push({
          id: cardId,
          name: card.name,
          image: card.image_uris?.small,
          count: 1
        });
      }
      return {
        ...prev,
        cards
      };
    });
  };

  const removeCard = (cardId) => {
    setEditedPreset(prev => ({
      ...prev,
      cards: prev.cards.filter(c => (c.id || c.scryfall_id || c.name) !== cardId)
    }));
  };

  const handleCardSearch = async () => {
    if (!cardSearchQuery.trim()) return;
    try {
      const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardSearchQuery)}`);
      const data = await response.json();
      setCardSearchResults(data.data || []);
    } catch (error) {
      console.error("Failed to search cards:", error);
    }
  };

  const selected = {
    landcycles: new Set(Object.keys(editedPreset.landCycles)),
    packages: new Set(editedPreset.packages)
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => ({
    landCycles: Object.keys(editedPreset.landCycles).length,
    packages: editedPreset.packages.length,
    cards: editedPreset.cards.length,
    total: Object.keys(editedPreset.landCycles).length + editedPreset.packages.length + editedPreset.cards.length
  }), [editedPreset]);

  return (
    <div className="preset-editor">
      {/* Header */}
      <div className="preset-editor-header">
        <div className="header-content">
          <h2>Edit Preset</h2>
          <p className="header-subtitle">Customize your mana base configuration</p>
        </div>
        <button className="btn-close" onClick={onClose} aria-label="Close editor">×</button>
      </div>

      <div className="preset-editor-layout">
        {/* Sidebar Navigation */}
        <div className="preset-editor-sidebar">
          <nav className="editor-nav">
            <button
              className={`nav-item ${activeSection === "overview" ? "active" : ""}`}
              onClick={() => setActiveSection("overview")}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-label">Overview</span>
            </button>

            <button
              className={`nav-item ${activeSection === "landcycles" ? "active" : ""}`}
              onClick={() => setActiveSection("landcycles")}
            >
              <span className="nav-icon">🌍</span>
              <span className="nav-label">Land Cycles</span>
              {summaryStats.landCycles > 0 && (
                <span className="nav-badge">{summaryStats.landCycles}</span>
              )}
            </button>

            <button
              className={`nav-item ${activeSection === "packages" ? "active" : ""}`}
              onClick={() => setActiveSection("packages")}
            >
              <span className="nav-icon">📦</span>
              <span className="nav-label">Packages</span>
              {summaryStats.packages > 0 && (
                <span className="nav-badge">{summaryStats.packages}</span>
              )}
            </button>

            <button
              className={`nav-item ${activeSection === "cards" ? "active" : ""}`}
              onClick={() => setActiveSection("cards")}
            >
              <span className="nav-icon">🃏</span>
              <span className="nav-label">Cards</span>
              {summaryStats.cards > 0 && (
                <span className="nav-badge">{summaryStats.cards}</span>
              )}
            </button>

            <button
              className={`nav-item ${activeSection === "settings" ? "active" : ""}`}
              onClick={() => setActiveSection("settings")}
            >
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">Settings</span>
            </button>
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="preset-editor-content">
          {activeSection === "overview" && (
            <div className="section-content">
              <div className="section-header">
                <h3>Preset Overview</h3>
                <p className="section-description">Get a quick summary of your preset configuration</p>
              </div>

              <div className="overview-grid">
                <div className="overview-card">
                  <div className="overview-icon">🌍</div>
                  <div className="overview-info">
                    <h4>Land Cycles</h4>
                    <p className="overview-count">{summaryStats.landCycles} selected</p>
                  </div>
                  <button
                    className="overview-action"
                    onClick={() => setActiveSection("landcycles")}
                  >
                    Configure
                  </button>
                </div>

                <div className="overview-card">
                  <div className="overview-icon">📦</div>
                  <div className="overview-info">
                    <h4>Packages</h4>
                    <p className="overview-count">{summaryStats.packages} selected</p>
                  </div>
                  <button
                    className="overview-action"
                    onClick={() => setActiveSection("packages")}
                  >
                    Configure
                  </button>
                </div>

                <div className="overview-card">
                  <div className="overview-icon">🃏</div>
                  <div className="overview-info">
                    <h4>Cards</h4>
                    <p className="overview-count">{summaryStats.cards} selected</p>
                  </div>
                  <button
                    className="overview-action"
                    onClick={() => setActiveSection("cards")}
                  >
                    Configure
                  </button>
                </div>
              </div>

              <div className="overview-summary">
                <h4>Preset Summary</h4>
                <div className="summary-details">
                  <p><strong>Name:</strong> {editedPreset.name || "Untitled Preset"}</p>
                  <p><strong>Description:</strong> {editedPreset.description || "No description"}</p>
                  {editedPreset.price && <p><strong>Estimated Price:</strong> {editedPreset.price}</p>}
                  <p><strong>Total Components:</strong> {summaryStats.total}</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "landcycles" && (
            <div className="section-content">
              <div className="section-header">
                <h3>Land Cycles</h3>
                <p className="section-description">Choose which land cycle types to include in your preset</p>
              </div>
              <LandCycleSelector
                groupedLandcycles={groupedLandcycles}
                selected={selected}
                toggle={toggleLandcycle}
              />
            </div>
          )}

          {activeSection === "packages" && (
            <div className="section-content">
              <div className="section-header">
                <h3>Packages</h3>
                <p className="section-description">Add curated land packages to your preset</p>
              </div>
              <PackageSelector
                selectedPackages={editedPreset.packages}
                onChange={(packages) => setEditedPreset(prev => ({ ...prev, packages }))}
                compact={false}
              />
            </div>
          )}

          {activeSection === "cards" && (
            <div className="section-content">
              <div className="section-header">
                <h3>Individual Cards</h3>
                <p className="section-description">Search and add specific cards to your preset</p>
              </div>

              <div className="cards-management">
                {/* Search Section */}
                <div className="card-search-container">
                  <div className="search-header">
                    <h4>Add Cards</h4>
                    <button
                      className="btn-toggle-search"
                      onClick={() => setShowCardSearch(!showCardSearch)}
                    >
                      {showCardSearch ? "Hide Search" : "Show Search"}
                    </button>
                  </div>

                  {showCardSearch && (
                    <div className="card-search-section">
                      <div className="search-input-wrapper">
                        <input
                          type="text"
                          className="card-search-input"
                          placeholder="Search for cards by name..."
                          value={cardSearchQuery}
                          onChange={(e) => setCardSearchQuery(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleCardSearch()}
                        />
                        <button onClick={handleCardSearch} className="btn-search">
                          Search
                        </button>
                      </div>

                      {/* Search Results */}
                      {cardSearchResults.length > 0 && (
                        <div className="search-results">
                          <div className="results-grid">
                            {cardSearchResults.slice(0, 12).map((card) => {
                              const isAdded = editedPreset.cards.find(c =>
                                (c.id || c.scryfall_id || c.name) === (card.id || card.scryfall_id || card.name)
                              );

                              return (
                                <div
                                  key={card.id}
                                  className={`result-card ${isAdded ? 'added' : ''}`}
                                  onClick={() => !isAdded && addCard(card)}
                                >
                                  <img
                                    src={card.image_uris?.small}
                                    alt={card.name}
                                    className="result-card-image"
                                  />
                                  <div className="result-card-name">{card.name}</div>
                                  {isAdded && <div className="added-indicator">✓</div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Cards */}
                {editedPreset.cards.length > 0 && (
                  <div className="selected-cards-container">
                    <div className="selected-header">
                      <h4>Selected Cards ({editedPreset.cards.length})</h4>
                    </div>
                    <div className="selected-cards-grid">
                      {editedPreset.cards.map((card) => (
                        <div key={card.id || card.scryfall_id || card.name} className="selected-card">
                          <button
                            className="remove-card-btn"
                            onClick={() => removeCard(card.id || card.scryfall_id || card.name)}
                            title="Remove card"
                            aria-label="Remove card"
                          >
                            ×
                          </button>
                          <img
                            src={card.image}
                            alt={card.name}
                            className="selected-card-image"
                          />
                          <div className="selected-card-name">{card.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editedPreset.cards.length === 0 && !showCardSearch && (
                  <div className="empty-cards-state">
                    <div className="empty-icon">🃏</div>
                    <p>No cards selected yet</p>
                    <button
                      className="btn-primary"
                      onClick={() => setShowCardSearch(true)}
                    >
                      Add Cards
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "settings" && (
            <div className="section-content">
              <div className="section-header">
                <h3>Settings</h3>
                <p className="section-description">Configure your preset details and visibility</p>
              </div>

              <div className="settings-form">
                <div className="form-group">
                  <label htmlFor="preset-name" className="form-label">Preset Name</label>
                  <input
                    id="preset-name"
                    type="text"
                    className="form-input"
                    placeholder="Enter preset name..."
                    value={editedPreset.name}
                    onChange={(e) => setEditedPreset(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="preset-description" className="form-label">Description</label>
                  <textarea
                    id="preset-description"
                    className="form-textarea"
                    placeholder="Describe your preset..."
                    value={editedPreset.description}
                    onChange={(e) => setEditedPreset(prev => ({ ...prev, description: e.target.value }))}
                    rows="3"
                  />
                </div>

                {editedPreset.price && (
                  <div className="form-group">
                    <label className="form-label">Estimated Price</label>
                    <div className="price-display">{editedPreset.price}</div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label checkbox-label">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={editedPreset.isPublic || false}
                      onChange={(e) => setEditedPreset(prev => ({ ...prev, isPublic: e.target.checked }))}
                    />
                    <span>Make this preset public</span>
                  </label>
                  <p className="form-hint">Public presets are visible to all users (coming soon)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="preset-editor-footer">
        <div className="footer-summary">
          <div className="summary-stats">
            <span className="stat-item">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{summaryStats.total}</span>
            </span>
            <span className="stat-item">
              <span className="stat-label">Cycles:</span>
              <span className="stat-value">{summaryStats.landCycles}</span>
            </span>
            <span className="stat-item">
              <span className="stat-label">Packages:</span>
              <span className="stat-value">{summaryStats.packages}</span>
            </span>
            <span className="stat-item">
              <span className="stat-label">Cards:</span>
              <span className="stat-value">{summaryStats.cards}</span>
            </span>
          </div>
        </div>

        <div className="preset-editor-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleApply}>
            Apply to Builder
          </button>
          <button className="btn-primary btn-save" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "💾 Save Preset"}
          </button>
        </div>
      </div>
    </div>
  );
}
