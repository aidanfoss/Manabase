import React from "react";
import {
  CurrencyDollarIcon,
  PaintBrushIcon
} from "@heroicons/react/24/solid";
import { useWishlist } from "../../context/WishlistProvider";

export default function ProxySettings() {
  const {
    mpcUnitCost,
    setMpcUnitCost,
    defaultCardBack,
    setDefaultCardBack,
    prebuiltCardbacks
  } = useWishlist();

  const handleSaveCardBack = async (newVal) => {
    setDefaultCardBack(newVal);
    localStorage.setItem("manabase_default_card_back", newVal);
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await fetch("/api/users/me/card-back", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ default_card_back: newVal })
      });
    } catch (e) {
      console.error("Failed to save default card back:", e);
    }
  };

  return (
    <div className="proxy-settings-container">
      {/* Card 1: Default Cost Per Proxy */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">
            <CurrencyDollarIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />
            Target Cost per Proxy
          </h3>
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 0 }}>
          Set your default per-card print cost for MakePlayingCards orders (default is $0.25/card).
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1" }}>Cost Per Proxy ($):</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={mpcUnitCost}
            onChange={(e) => setMpcUnitCost(parseFloat(e.target.value) || 0)}
            className="setup-input"
            style={{ width: "120px" }}
          />
        </div>
      </div>

      {/* Card 2: Individual Cardback Options & Prebuilt Defaults */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">
            <PaintBrushIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />
            Individual Cardback Preferences
          </h3>
          {defaultCardBack && (
            <span className="mpc-alert-badge met" style={{ background: "rgba(16, 185, 129, 0.15)" }}>
              Active Cardback Selected
            </span>
          )}
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 0 }}>
          Choose your default cardback for proxy orders. Pick from prebuilt defaults below or input a custom Google Drive ID / search query string.
        </p>

        {/* Custom Input */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1", whiteSpace: "nowrap" }}>
            Custom ID / Query String:
          </label>
          <input
            type="text"
            className="setup-input"
            style={{ flex: 1, minWidth: "260px" }}
            placeholder="e.g. Google Drive ID, image URL, or search query (e.g. b:black lotus)"
            value={defaultCardBack}
            onChange={(e) => handleSaveCardBack(e.target.value)}
          />
          {defaultCardBack && (
            <button
              className="btn-secondary"
              onClick={() => handleSaveCardBack("")}
              style={{ padding: "0.4rem 0.75rem" }}
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Prebuilt Cardbacks Grid */}
        <h4 style={{ margin: "1rem 0 0.5rem 0", fontSize: "0.95rem", color: "#f1f5f9" }}>
          Prebuilt Cardback Defaults ({prebuiltCardbacks.length}):
        </h4>
        <div className="cardback-grid">
          {prebuiltCardbacks.map((cb) => {
            const isSelected =
              (cb.driveId && defaultCardBack === cb.driveId) ||
              (cb.query && defaultCardBack === cb.query) ||
              (cb.id && defaultCardBack === cb.id);

            return (
              <div
                key={cb.id}
                className={`cardback-option-card ${isSelected ? "selected" : ""}`}
                onClick={() => handleSaveCardBack(cb.driveId || cb.query || cb.name)}
              >
                {isSelected && <span className="cardback-selected-badge">Active</span>}
                <div className="cardback-preview-wrapper">
                  <img
                    src={cb.previewUrl || "https://cards.scryfall.io/card_back.png"}
                    alt={cb.name}
                    className="cardback-preview-img"
                    onError={(e) => { e.target.src = "https://cards.scryfall.io/card_back.png"; }}
                  />
                </div>
                <div className="cardback-name">{cb.name}</div>
                <div className="cardback-author">{cb.author || "Default"}</div>
                <div className="cardback-dpi">{cb.dpi || "800 DPI"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
