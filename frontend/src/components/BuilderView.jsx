// src/components/BuilderView.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { encodeSelection, decodeSelection } from "../utils/hashState";
import Sidebar from "./Sidebar";
import MainContent from "./MainContent";
import BottomBar from "./BottomBar";
import Presets, { CreatePresetModal } from "./Presets";
import "../styles/builder.css"; // ️ builder-specific styles

export default function BuilderView({ selected, setSelected, onDataLoaded, userCollection = [] }) {
  const [packages, setPackages] = useState([]);
  const [landcycles, setLandcycles] = useState([]);
  const [data, setData] = useState({ lands: [], nonlands: [] });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(true);
  const [showManagePresets, setShowManagePresets] = useState(false);
  const [showCreatePreset, setShowCreatePreset] = useState(false);

  // restore hash
  useEffect(() => {
    if (window.location.hash.length > 1) {
      const decoded = decodeSelection(window.location.hash.substring(1));
      if (decoded && decoded.version >= 1) {
        setSelected({
          packages: new Set(decoded.packages || []),
          landcycles: new Set(decoded.landcycles || []),
          colors: new Set(decoded.colors || []),
        });
      }
    }
  }, []);

  // load packages + landcycles
  useEffect(() => {
    (async () => {
      try {
        const [p, l] = await Promise.all([
          api.getPackages(),
          api.getLandcycles(),
        ]);
        setPackages(p || []);
        setLandcycles(l || []);
      } catch (e) {
        console.error("Failed to load packages/landcycles:", e);
      }
    })();
  }, []);

  function toggle(setName, value) {
    setSelected((prev) => {
      const ns = new Set(prev[setName]);
      ns.has(value) ? ns.delete(value) : ns.add(value);
      return { ...prev, [setName]: ns };
    });
  }

  const query = useMemo(() => {
    const colorsArr = [...selected.colors];
    const effectiveColors = colorsArr.length === 0 ? ["colorless"] : colorsArr;
    return {
      packages: [...selected.packages],
      landcycles: [...selected.landcycles],
      colors: effectiveColors,
    };
  }, [selected]);

  // fetch card data
  useEffect(() => {
    setStatus("loading");
    setError(null);

    api
      .getCards(query)
      .then((payload) => {
        if (payload?.fetchableSummary?.length && landcycles.length) {
          setLandcycles((prev) =>
            prev.map((lc) => {
              const found = payload.fetchableSummary.find(
                (f) => f.id === lc.id || f.id === lc.name
              );
              return found ? { ...lc, fetchable: found.fetchable } : lc;
            })
          );
        }

        let parsed = { lands: [], nonlands: [] };
        if (Array.isArray(payload)) parsed.lands = payload;
        else if (payload && typeof payload === "object")
          parsed = {
            lands: payload.lands || [],
            nonlands: payload.nonlands || [],
          };

        setData(parsed);
        if (onDataLoaded) onDataLoaded(parsed);
        setStatus("done");

        const selection = {
          version: 1,
          packages: [...selected.packages],
          landcycles: [...selected.landcycles],
          colors: [...selected.colors],
        };
        const hash = encodeSelection(selection);
        window.history.replaceState(null, "", `#${hash}`);
      })
      .catch((e) => {
        setError(e.message || String(e));
        setStatus("error");
      });
  }, [
    query.packages.join("|"),
    query.landcycles.join("|"),
    query.colors.join("|"),
  ]);

  return (
    <div className={`app ${collapsed ? "" : "sidebar-open"}`}>
      {collapsed && (
        <div
          className="sidebar-hover-zone"
          onMouseEnter={() => setCollapsed((c) => !c)}
        >
          <div className="sidebar-hover-indicator">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      )}

      <Sidebar
        packages={packages}
        landcycles={landcycles}
        selected={selected}
        toggle={toggle}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onShowManagePresets={() => setShowManagePresets(true)}
        onShowCreatePreset={() => setShowCreatePreset(true)}
        onMouseLeave={() => setCollapsed(true)}
      />

      <MainContent data={data} status={status} error={error} userCollection={userCollection} />
      <BottomBar data={data} />

      {showManagePresets && (
        <div className="modal-overlay" onClick={() => setShowManagePresets(false)} style={{ zIndex: 1000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '1000px', height: '85vh', overflow: 'hidden', padding: 0 }}>
            <Presets 
              currentSelection={{
                packages: Array.from(selected.packages),
                landcycles: Array.from(selected.landcycles),
                colors: Array.from(selected.colors)
              }}
              landcycles={landcycles}
              asModal={true}
              onCloseModal={() => setShowManagePresets(false)}
              onApplyPreset={(preset) => {
                // Apply the preset
                const newLandcycles = new Set(Object.keys(preset.landCycles || {}));
                const newPackages = new Set(Array.isArray(preset.packages) ? preset.packages : []);
                
                setSelected(prev => ({
                  ...prev,
                  landcycles: newLandcycles,
                  packages: newPackages
                }));
                
                setShowManagePresets(false);
              }}
            />
          </div>
        </div>
      )}

      {showCreatePreset && (
        <CreatePresetModal
          currentSelection={{
            packages: Array.from(selected.packages),
            landcycles: Array.from(selected.landcycles).reduce((acc, curr) => ({ ...acc, [curr]: true }), {})
          }}
          onClose={() => setShowCreatePreset(false)}
          onSave={() => {
            setShowCreatePreset(false);
            // Optionally show a success toast or reload presets
          }}
        />
      )}
    </div>
  );
}
