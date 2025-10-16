import React, { useState, useMemo, useEffect } from "react";
import { api } from "../api/client";

const LandPresetSelector = ({ selectedPackages, selectedColors, selectedLandcycles, onPresetSelect }) => {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [open, setOpen] = useState(false);

  // Load presets from backend with current selection
  useEffect(() => {
    const packagesParam = [...selectedPackages].join(',');
    const landcyclesParam = [...selectedLandcycles].join(',');
    const colorsParam = [...selectedColors].join(',');

    api.getLandcyclePresets(packagesParam, landcyclesParam, colorsParam)
      .then(setPresets)
      .catch(console.error);
  }, [selectedPackages, selectedColors, selectedLandcycles]);

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset);
    onPresetSelect(preset);
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
        <span>Land Cycle Presets</span>
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
                  className={`preset-card ${selectedPreset?.name === preset.name ? 'selected' : ''}`}
                  onClick={() => handlePresetSelect(preset)}
                >
                  <div className="preset-header">
                    <h4>{preset.name}</h4>
                    <span className="price">${preset.price || 0}</span>
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
