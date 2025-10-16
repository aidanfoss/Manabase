import React, { useState, useEffect } from "react";
import { PresetsService } from "../services/presetsService";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import PackageSelector from "./PackageSelector";
import PresetEditor from "./PresetEditor";
import "../styles/presets.css";

export default function Presets({ currentSelection, onApplyPreset, landcycles }) {
  const { user } = useAuth();
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("your"); // "your" or "community"
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const colorsArray = currentSelection.colors ? Array.from(currentSelection.colors) : [];
      const data = await PresetsService.getPresets(colorsArray);
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
                onEdit={() => setEditingPreset(preset)}
                onDelete={user ? () => handleDeletePreset(preset) : null}
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
          currentSelection={currentSelection}
          onClose={() => setShowCreateModal(false)}
          onSave={(preset) => {
            setPresets(prev => [...prev, preset]);
            setShowCreateModal(false);
          }}
        />
      )}

      {editingPreset && (
        <PresetEditor
          preset={editingPreset}
          landcycles={landcycles}
          onClose={() => setEditingPreset(null)}
          onApply={onApplyPreset}
          onSave={(updatedPreset) => {
            setPresets(prev => prev.map(p => p.id === updatedPreset.id ? updatedPreset : p));
            setEditingPreset(null);
          }}
        />
      )}
    </div>
  );
}

function PresetCard({ preset, onEdit, onDelete }) {
  return (
    <div className="preset-list-item">
      <div className="preset-list-content">
        <span className="preset-name">{preset.name}</span>
        <span className="preset-options-count">{preset.optionsCount} items</span>
        <span className="preset-author">Official</span>
      </div>
      <div className="preset-list-actions">
        {preset.price && (
          <span className="preset-list-price">{preset.price}</span>
        )}
        <button
          className="btn-primary-small"
          onClick={onEdit}
        >
          Select
        </button>
        {!preset.isDefaultPreset && onDelete && (
          <button className="btn-delete-small" onClick={onDelete}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function CreatePresetModal({ onClose, onSave, currentSelection }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    packages: [...currentSelection.packages],
    landCycles: Object.fromEntries(currentSelection.landcycles)
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

const handleDeletePreset = async (preset) => {
  if (!window.confirm(`Are you sure you want to delete the "${preset.name}" preset?`)) {
    return;
  }

  try {
    await PresetsService.deletePreset(preset.id);
    setPresets(prev => prev.filter(p => p.id !== preset.id));
  } catch (error) {
    console.error("Failed to delete preset:", error);
    alert("Failed to delete preset. Please try again.");
  }
};
