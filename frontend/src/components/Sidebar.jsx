import React, { useMemo, useState } from "react";
import ColorSelector from "./ColorSelector";
import PackageSelector from "./PackageSelector";
import LandPresetSelector from "./LandPresetSelector";
import LandCycleSelector from "./LandCycleSelector";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function Sidebar({
  packages = [],
  landcycles = [],
  selected,
  toggle,
  collapsed,
}) {
  const { user } = useAuth();


  // --- Group land cycles by tier ---
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

  const handleSavePreset = () => {
    const name = prompt('Enter a name for your preset:');
    if (!name || !name.trim()) return;

    const presetData = {
      name: name.trim(),
      description: `Custom preset with ${[...selected.colors].length} colors`,
      landCycles: selected.landcycles,
      packages: selected.packages
    };

    api.savePreset(presetData)
      .then(newPreset => {
        // Trigger a re-render by updating some state - this is a bit hacky
        // For a better solution, we might want to use context or Redux
        window.location.reload(); // Temporary solution
      })
      .catch(error => {
        alert(`Failed to save preset: ${error.message || 'Unknown error'}`);
      });
  };

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    alert("🔗 Share link copied to clipboard!");
  }

  return (
    <aside className={`aside ${collapsed ? "hidden" : ""}`}>
      <div className="section">
        <ColorSelector selected={selected} toggle={toggle} />
      </div>

      <div className="sidebar-spacer"></div>

      {/* === Presets === */}
      <div className="section">
        <LandPresetSelector
          selectedPackages={selected.packages}
          selectedColors={selected.colors}
          selectedLandcycles={selected.landcycles}
          onPresetSelect={(preset) => {
            console.log('[FRONTEND PRESET] Starting preset selection:', preset?.name, preset);

            if (preset && preset.landCycles) {
              console.log('[FRONTEND PRESET] Current selections - landcycles:', [...selected.landcycles], 'packages:', [...selected.packages]);

              // Clear current landcycle selections and apply preset landcycles
              const currentLandcycles = new Set(selected.landcycles);
              const newLandcycles = new Set(Object.keys(preset.landCycles));

              console.log('[FRONTEND PRESET] Clearing landcycles:', [...currentLandcycles]);
              console.log('[FRONTEND PRESET] Applying new landcycles:', [...newLandcycles]);

              // Handle landcycles: clear all current selections and set new ones
              currentLandcycles.forEach(lc => {
                console.log('[FRONTEND PRESET] Toggling off landcycle:', lc);
                toggle("landcycles", lc);
              });
              newLandcycles.forEach(lc => {
                console.log('[FRONTEND PRESET] Toggling on landcycle:', lc);
                toggle("landcycles", lc);
              });

              // Handle packages: clear all current selections and set new ones from preset
              const currentPackages = new Set(selected.packages);
              const newPackages = new Set(Array.isArray(preset.packages) ? preset.packages : []);

              console.log('[FRONTEND PRESET] Clearing packages:', [...currentPackages]);
              console.log('[FRONTEND PRESET] Applying new packages:', [...newPackages]);

              currentPackages.forEach(pkg => {
                console.log('[FRONTEND PRESET] Toggling off package:', pkg);
                toggle("packages", pkg);
              });
              newPackages.forEach(pkg => {
                console.log('[FRONTEND PRESET] Toggling on package:', pkg);
                toggle("packages", pkg);
              });

              console.log('[FRONTEND PRESET] Preset application complete');
            } else {
              console.warn('[FRONTEND PRESET] Invalid preset data:', preset);
            }
          }}
        />
      </div>

      {/* === Package Selector === */}
      <div className="section">
        <PackageSelector
          selectedPackages={Array.from(selected.packages)}
          compact={true}
          onChange={(newPackages) => {
            // Convert array back to Set for backwards compatibility with sidebar state
            const currentPackages = new Set(selected.packages);
            const newPackagesSet = new Set(newPackages);

            // Remove deselected packages
            currentPackages.forEach(pkg => {
              if (!newPackagesSet.has(pkg)) {
                toggle("packages", pkg);
              }
            });

            // Add newly selected packages
            newPackagesSet.forEach(pkg => {
              if (!currentPackages.has(pkg)) {
                toggle("packages", pkg);
              }
            });
          }}
        />
      </div>

      {/* === Land Cycle Selector (moved down) === */}
      <div className="section">
        <LandCycleSelector
          groupedLandcycles={groupedLandcycles}
          selected={selected}
          toggle={toggle}
          moveDown={true}
        />
      </div>

      {/* === Actions === */}
      {user && (
        <div className="section">
          <button
            className="export-btn"
            onClick={handleSavePreset}
            style={{ width: "100%", marginBottom: "0.5rem" }}
          >
            💾 Save Preset
          </button>
        </div>
      )}

      {/* === Share Button === */}
      <div className="section" style={{ textAlign: "center" }}>
        <button
          className="export-btn"
          onClick={copyShareLink}
          title="Copy share link"
          aria-label="Share"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span style={{ marginLeft: "6px" }}>Share</span>
        </button>
      </div>
    </aside>
  );
}
