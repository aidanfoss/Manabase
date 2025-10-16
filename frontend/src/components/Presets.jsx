import React, { useState, useEffect } from "react";
import { PresetsService } from "../services/presetsService";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import PackageSelector from "./PackageSelector";
import "../styles/presets.css";

export default function Presets() {
  const { user } = useAuth();
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("your"); // "your" or "community"
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const data = await PresetsService.getPresets();
      setPresets(data);
    } catch (error) {
      console.error("Failed to load presets:", error);
      // Fallback to local presets if API fails
      setPresets(PresetsService.getLocalPresets());
    } finally {
      setLoading(false);
    }
  };

  const yourPresets = presets.filter(p => p.isUserPreset || p.userId);
  const communityPresets = presets.filter(p => p.isDefaultPreset || !p.userId);

  const filteredPresets = activeTab === "your" ? yourPresets : communityPresets;

  return (
    <div className="presets-screen">
      <div className="presets-header">
        <h1>Presets</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
          disabled={!user}
        >
          Create New Preset
        </button>
      </div>

      <div className="presets-tabs">
        <button
          className={activeTab === "your" ? "active" : ""}
          onClick={() => setActiveTab("your")}
        >
          Your Presets
        </button>
        <button
          className={activeTab === "community" ? "active" : ""}
          onClick={() => setActiveTab("community")}
        >
          Community Presets
        </button>
      </div>

      <div className="presets-content">
        {loading ? (
          <div className="loading">Loading presets...</div>
        ) : (
          <div className="presets-grid">
            {filteredPresets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                onUse={() => handleUsePreset(preset)}
                onImport={user ? () => handleImportPreset(preset) : null}
              />
            ))}
            {filteredPresets.length === 0 && (
              <div className="empty-state">
                {activeTab === "your" ? "You haven't created any presets yet." : "No community presets available."}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreatePresetModal
          onClose={() => setShowCreateModal(false)}
          onSave={(preset) => {
            setPresets(prev => [...prev, preset]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

function PresetCard({ preset, onUse, onImport }) {
  return (
    <div className="preset-card">
      <div className="preset-header">
        <h3>{preset.name}</h3>
        {preset.author && <span className="preset-author">by {preset.author}</span>}
      </div>
      <p className="preset-description">{preset.description}</p>
      <div className="preset-packages">
        {preset.packages?.slice(0, 3).map((pkgId) => (
          <span key={pkgId} className="package-tag">Package {pkgId}</span>
        ))}
        {preset.packages?.length > 3 && <span className="package-more">+{preset.packages.length - 3} more</span>}
      </div>
      <div className="preset-actions">
        <button className="btn-primary" onClick={onUse}>
          Use
        </button>
        {onImport && (
          <button className="btn-secondary" onClick={onImport}>
            Import
          </button>
        )}
      </div>
    </div>
  );
}

function CreatePresetModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    packages: []
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const preset = await api.savePreset(form);
      onSave(preset);
    } catch (error) {
      console.error("Failed to create preset:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Preset</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <PackageSelector
              selectedPackages={form.packages}
              onChange={(packages) => setForm(prev => ({ ...prev, packages }))}
              disabled={loading}
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Placeholder functions - need to implement navigation and state integration
const handleUsePreset = (preset) => {
  // TODO: Navigate to builder and apply preset
  console.log("Using preset:", preset);
};

const handleImportPreset = async (preset) => {
  try {
    const importedPreset = await PresetsService.importPreset(preset.id);
    setPresets(prev => [...prev, importedPreset]);
    alert("Preset imported successfully!");
  } catch (error) {
    console.error("Failed to import preset:", error);
    alert("Failed to import preset. Please try again.");
  }
};
