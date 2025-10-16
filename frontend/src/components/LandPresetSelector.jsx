import React, { useState, useMemo, useEffect, useCallback } from "react";
import { api } from "../api/client";

const LandPresetSelector = ({ selectedPackages, selectedColors, selectedLandcycles, onPresetSelect }) => {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [open, setOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Debounced function to load presets with retry logic
  const loadPresetsWithRetry = useCallback(async (packagesParam, landcyclesParam, colorsParam, attempt = 0) => {
    try {
      const loadedPresets = await api.getLandcyclePresets(packagesParam, landcyclesParam, colorsParam);

      // Check if all presets have valid pricing (not $0)
      const hasValidPricing = loadedPresets.every(preset =>
        preset.price !== undefined && preset.price !== null && preset.price > 0
      );

      if (!hasValidPricing && attempt < 3) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          loadPresetsWithRetry(packagesParam, landcyclesParam, colorsParam, attempt + 1);
        }, delay);
        return;
      }

      setPresets(loadedPresets);
    } catch (error) {
      console.error('Error loading presets:', error);
      if (attempt < 3) {
        // Retry on error with backoff
        const delay = Math.pow(2, attempt) * 1000;
        setTimeout(() => {
          loadPresetsWithRetry(packagesParam, landcyclesParam, colorsParam, attempt + 1);
        }, delay);
      }
    }
  }, []);

  // Load presets from backend with current selection (debounced)
  useEffect(() => {
    const packagesParam = [...selectedPackages].join(',');
    const landcyclesParam = [...selectedLandcycles].join(',');
    const colorsParam = [...selectedColors].join(',');

    // Debounce the API call
    const debounceTimer = setTimeout(() => {
      loadPresetsWithRetry(packagesParam, landcyclesParam, colorsParam);
      setRetryCount(0);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [selectedPackages, selectedColors, selectedLandcycles, loadPresetsWithRetry]);

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset);
    onPresetSelect(preset);
  };

  const handleDeletePreset = (presetId) => {
    if (!window.confirm('Delete this preset?')) return;

    api.deletePreset(presetId)
      .then(() => {
        // Remove from local state and reload
        setPresets(prev => prev.filter(p => p.id !== presetId));
      })
      .catch(console.error);
  };

  return (
    <div className="section">
      <h3
        className="dropdown-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span>Presets</span>
        <span
          style={{
            fontSize: "0.8em",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s ease",
          }}
        >
          ▼
        </span>
      </h3>

      {open && (
        <>
          {presets.length === 0 ? (
            <p className="no-presets">Loading presets...</p>
          ) : (
            <div className="preset-list">
              {presets.map((preset) => (
                <div
                  key={preset.id || preset.name}
                  className={`preset-card ${selectedPreset?.name === preset.name ? 'selected' : ''} ${preset.isUserPreset ? 'user-preset' : preset.isDefaultPreset ? 'default-preset' : ''}`}
                  onClick={() => handlePresetSelect(preset)}
                >
                  <div className="preset-header">
                    <h4>{preset.name}</h4>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className={`price ${preset.price > 50 ? 'high-price' : 'low-price'}`}>${preset.price || 0}</span>
                      {preset.isUserPreset && !preset.isDefaultPreset && (
                        <button
                          className="delete-preset-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePreset(preset.id);
                          }}
                          title="Delete preset"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ff6b6b",
                            cursor: "pointer",
                            fontSize: "16px",
                            padding: "2px 6px",
                            borderRadius: "3px",
                            transition: "background-color 0.2s"
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 107, 107, 0.1)'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="preset-description">{preset.description}</p>
                  <div className="preset-lands">
                    {Object.keys(preset.landCycles).map((landCycle) => (
                      <div key={landCycle} className="land-item">
                        <span className="land-type">{landCycle.replace(/land$/i, ' land')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default LandPresetSelector;
