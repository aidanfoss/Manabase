// src/components/BuilderView.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { encodeSelection, decodeSelection } from "../utils/hashState";
import Sidebar from "./Sidebar";
import MainContent from "./MainContent";
import BottomBar from "./BottomBar";
import "../styles/builder.css"; // ⬅️ builder-specific styles

export default function BuilderView() {
  const [packages, setPackages] = useState([]);
  const [landcycles, setLandcycles] = useState([]);
  const [data, setData] = useState({ lands: [], nonlands: [] });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const [selected, setSelected] = useState({
    packages: new Set(),
    landcycles: new Set(),
    colors: new Set(),
  });

  // restore hash
  useEffect(() => {
    if (window.location.hash.length > 1) {
      const decoded = decodeSelection(window.location.hash.substring(1));
      if (decoded && decoded.version >= 1) {
        setSelected({
          packages: new Set(decoded.packages || decoded.metas || []),
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
      <button
        className={`sidebar-toggle ${collapsed ? "" : "open"}`}
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Open menu" : "Hide menu"}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      <Sidebar
        packages={packages}
        landcycles={landcycles}
        selected={selected}
        toggle={toggle}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <MainContent data={data} status={status} error={error} />
      <BottomBar data={data} />
    </div>
  );
}
