import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api/client";
import Card from "./components/Card";
import "./styles.css";
import { encodeSelection, decodeSelection } from "./utils/hashState";

export default function App() {
  const [metas, setMetas] = useState([]);
  const [landcycles, setLandcycles] = useState([]);
  const [data, setData] = useState({ lands: [], nonlands: [] });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState({
    metas: new Set(),
    landcycles: new Set(),
    colors: new Set(),
  });

  // Restore hash from URL
  useEffect(() => {
    if (window.location.hash.length > 1) {
      const decoded = decodeSelection(window.location.hash.substring(1));
      if (decoded && decoded.version >= 1) {
        setSelected({
          metas: new Set(decoded.metas || []),
          landcycles: new Set(decoded.landcycles || []),
          colors: new Set(decoded.colors || []),
        });
      }
    }
  }, []);

  // Load metas + landcycles
  useEffect(() => {
    (async () => {
      try {
        const [m, l] = await Promise.all([api.getMetas(), api.getLandcycles()]);
        setMetas(m || []);
        setLandcycles(l || []);
      } catch (e) {
        console.error("Failed to load metas/landcycles:", e);
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
      metas: [...selected.metas],
      landcycles: [...selected.landcycles],
      colors: effectiveColors,
    };
  }, [selected]);

  // Fetch cards from backend
  useEffect(() => {
    setStatus("loading");
    setError(null);

    api
      .getCards(query)
      .then((payload) => {
        // Sync fetchable updates from backend
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
          metas: [...selected.metas],
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
  }, [query.metas.join("|"), query.landcycles.join("|"), query.colors.join("|")]);

  // Group landcycles by tier
  const groupedLandcycles = useMemo(() => {
    const groups = { premium: [], playable: [], budget: [], terrible: [] };
    for (const lc of landcycles) {
      const tier = lc.tier?.toLowerCase() || "budget";
      if (groups[tier]) groups[tier].push(lc);
      else groups.budget.push(lc);
    }
    for (const tier in groups) {
      groups[tier].sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [landcycles]);

  return (
    <div className="app">
      {/* === Sidebar === */}
      <aside className="aside">
        <h2>Manabase Builder</h2>
        <p className="helper">
          Select colors, metas, and land cycles to populate cards. Prices shown are the
          lowest printing (foil or nonfoil).
        </p>

        {/* === Colors === */}
        <div className="section">
          <h3>Colors</h3>
          <div className="color-buttons">
            {["W", "U", "B", "R", "G"].map((c) => (
              <button
                key={c}
                onClick={() => toggle("colors", c)}
                className={
                  "color-btn color-" + c + (selected.colors.has(c) ? " active" : "")
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* === Metas === */}
        <div className="section">
          <h3>Metas</h3>
          <div className="taglist">
            {metas.map((m) => (
              <button
                key={m.name}
                onClick={() => toggle("metas", m.name)}
                className={"tag" + (selected.metas.has(m.name) ? " active" : "")}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* === Land Cycles === */}
        <div className="section">
          <h3>Land Cycles</h3>
          {[
            ["premium", "🟩 Premium (Untapped)"],
            ["playable", "🟨 Playable (Conditional)"],
            ["budget", "🟥 Budget / Slow"],
            ["terrible", "⬛ Terrible (Actively Bad)"],
          ].map(([tier, label]) => (
            <div key={tier} className={`tier-group ${tier}`}>
              <div className="tier-label">{label}</div>
              <div className="taglist">
                {groupedLandcycles[tier].map((lc) => (
                  <button
                    key={lc.id ?? lc.name}
                    onClick={() => toggle("landcycles", lc.id ?? lc.name)}
                    className={[
                      "tag",
                      lc.fetchable ? "fetchable" : "",
                      selected.landcycles.has(lc.id ?? lc.name) ? "active" : "",
                    ].join(" ")}
                    title={
                      (lc.fetchable ? "Fetchable — " : "") +
                      (lc.description || "")
                    }
                  >
                    {lc.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* === Share === */}
        <div className="section">
          <h3>Share</h3>
          <button
            className="tag active"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("🔗 Link copied to clipboard!");
            }}
          >
            Copy Share Link
          </button>
        </div>
      </aside>

      {/* === Main Content === */}
      <main className="main">
        {status === "loading" && <div className="status">Loading cards…</div>}
        {status === "error" && <div className="status error">Error: {error}</div>}

        {["lands", "nonlands"].map((section) => {
          const cards = data[section] || [];
          if (!cards.length) return null;
          const title = section === "lands" ? "Lands" : "Non-Lands";
          return (
            <div key={section}>
              <div className="section-title-row">
                <div className="section-title">{title}</div>
                {cards.length > 0 && (
                  <div className="export-controls">
                    <button
                      className="export-btn"
                      onClick={() => exportSection(title, cards)}
                    >
                      Export
                    </button>
                    <button
                      className="copy-btn small"
                      onClick={() => copySection(title, cards)}
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
              <div className="grid">
                {cards.map((it, i) => (
                  <Card key={i} item={it} />
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );

  // === Export & Copy Helpers ===
  function exportSection(name, cards) {
    if (!cards?.length) return;
    const lines = cards.map((c) => {
      const setCode = (c.set || c.prints?.[0]?.set || "").toUpperCase();
      const collector = c.collector_number || c.prints?.[0]?.collector_number || "";
      if (setCode && collector) return `1 ${c.name} (${setCode}) ${collector}`;
      if (setCode) return `1 ${c.name} (${setCode})`;
      return `1 ${c.name}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function copySection(name, cards) {
    if (!cards?.length) return;
    const text = cards
      .map((c) => {
        const setCode = (c.set || c.prints?.[0]?.set || "").toUpperCase();
        const collector = c.collector_number || c.prints?.[0]?.collector_number || "";
        if (setCode && collector) return `1 ${c.name} (${setCode}) ${collector}`;
        if (setCode) return `1 ${c.name} (${setCode})`;
        return `1 ${c.name}`;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    alert(`📋 Copied ${name} list to clipboard!`);
  }
}
