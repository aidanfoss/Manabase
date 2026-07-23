// src/components/ProxyOrderHub.jsx
import React, { useState, useEffect, useMemo } from "react";
import { resolveDisplayPrice } from "../utils/pricing";
import { parseImportInput } from "../utils/csvImporter";
import "../styles/proxy-hub.css";

export default function ProxyOrderHub({ data }) {
  // Combine lands and nonlands into a unified array
  const allCards = useMemo(() => {
    const list = [];
    if (data?.lands) {
      data.lands.forEach((c) => list.push({ ...c, category: "Land" }));
    }
    if (data?.nonlands) {
      data.nonlands.forEach((c) => list.push({ ...c, category: "Non-Land" }));
    }
    return list;
  }, [data]);

  // Local state for tracking quantities, selected print indexes, and foil finishes
  // Keyed by card name to preserve selection during updates
  const [quantities, setQuantities] = useState({});
  const [selectedPrints, setSelectedPrints] = useState({});
  const [finishes, setFinishes] = useState({}); // "nonfoil" or "foil"

  // Default Proxy Card Back preference (defaulting to Black Lotus)
  const [defaultCardBack, setDefaultCardBack] = useState(() => {
    return localStorage.getItem("manabase_default_card_back") || "b:black lotus";
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.default_card_back !== undefined) {
          const backVal = data.default_card_back || "b:black lotus";
          setDefaultCardBack(backVal);
          localStorage.setItem("manabase_default_card_back", backVal);
        }
      })
      .catch(() => {});
  }, []);

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
      console.error("Failed to update card back preference:", e);
    }
  };

  // Bulk import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const parsedPreviewCards = useMemo(() => {
    if (!importText.trim()) return [];
    return parseImportInput(importText);
  }, [importText]);

  const handleBulkImport = async () => {
    if (!importText.trim()) return;

    setImporting(true);
    setImportStatus("Parsing cards...");

    try {
      const parsed = parseImportInput(importText);
      if (parsed.length === 0) {
        alert("No valid cards found in the provided input.");
        setImporting(false);
        setImportStatus("");
        return;
      }

      // Update local quantities for matching cards in allCards
      const updatedQuants = { ...quantities };
      const updatedFinishes = { ...finishes };

      parsed.forEach((c) => {
        const existingQty = updatedQuants[c.card_name] || 0;
        updatedQuants[c.card_name] = existingQty + (c.quantity || 1);
        if (c.is_foil) {
          updatedFinishes[c.card_name] = "foil";
        }
      });

      setQuantities(updatedQuants);
      setFinishes(updatedFinishes);

      // Save to backend Proxy Wishlist if logged in
      const token = localStorage.getItem("token");
      if (token) {
        setImportStatus(`Saving ${parsed.length} cards to Proxy Hub wishlist...`);
        const CHUNK_SIZE = 500;
        for (let i = 0; i < parsed.length; i += CHUNK_SIZE) {
          const chunk = parsed.slice(i, i + CHUNK_SIZE);
          await fetch("/api/lists/bulk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ cards: chunk, list_kind: "proxy_wishlist" }),
          });
        }
      }

      setImportText("");
      setShowImportModal(false);
      setImportStatus("");
      alert(`🎉 Successfully bulk imported ${parsed.reduce((sum, c) => sum + c.quantity, 0)} cards!`);
    } catch (e) {
      console.error("Bulk import failed:", e);
      alert("An error occurred during bulk import.");
    } finally {
      setImporting(false);
    }
  };

  const handleFileRead = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportText(e.target.result || "");
    };
    reader.readAsText(file);
  };

  // Initialize state when card list changes
  useEffect(() => {
    const newQuants = { ...quantities };
    const newPrints = { ...selectedPrints };
    const newFinishes = { ...finishes };
    let changed = false;

    allCards.forEach((c) => {
      if (newQuants[c.name] === undefined) {
        newQuants[c.name] = 1;
        changed = true;
      }
      if (newPrints[c.name] === undefined) {
        newPrints[c.name] = 0; // Default to first print
        changed = true;
      }
      if (newFinishes[c.name] === undefined) {
        // Default to foil if only foil is available, else nonfoil
        const defaultPrint = c.prints?.[0] || c;
        const finishesList = defaultPrint.finishes || [];
        const hasNonFoil = finishesList.includes("nonfoil") || !finishesList.includes("foil");
        newFinishes[c.name] = hasNonFoil ? "nonfoil" : "foil";
        changed = true;
      }
    });

    if (changed) {
      setQuantities(newQuants);
      setSelectedPrints(newPrints);
      setFinishes(newFinishes);
    }
  }, [allCards]);

  const updateQuantity = (name, val) => {
    setQuantities((prev) => ({
      ...prev,
      [name]: Math.max(0, val),
    }));
  };

  const updatePrint = (name, index) => {
    setSelectedPrints((prev) => ({
      ...prev,
      [name]: index,
    }));
    // Reset finish according to new print availability
    const card = allCards.find((c) => c.name === name);
    if (card && card.prints && card.prints[index]) {
      const newPrint = card.prints[index];
      const finishesList = newPrint.finishes || [];
      const hasNonFoil = finishesList.includes("nonfoil") || !finishesList.includes("foil");
      setFinishes((prev) => ({
        ...prev,
        [name]: hasNonFoil ? "nonfoil" : "foil",
      }));
    }
  };

  const updateFinish = (name, finish) => {
    setFinishes((prev) => ({
      ...prev,
      [name]: finish,
    }));
  };

  // Compute normalized cards with currently selected printings
  const configuredCards = useMemo(() => {
    return allCards.map((c) => {
      const q = quantities[c.name] ?? 1;
      const printIndex = selectedPrints[c.name] ?? 0;
      const finish = finishes[c.name] ?? "nonfoil";
      
      // Resolve currently selected print details
      const printsList = c.prints || [];
      const activePrint = printsList[printIndex] || c;

      // Extract set, collector number, and images
      const setCode = (activePrint.set || c.set || "").toUpperCase();
      const set_name = activePrint.set_name || c.set_name || "Unknown Set";
      const collector = activePrint.collector_number || c.collector_number || "";
      
      const faces = activePrint.card_faces || c.card_faces || [];
      const isMDFC = faces.length > 1;
      const mainFace = isMDFC ? faces[0] : activePrint;
      
      const image =
        activePrint.image ||
        mainFace.image_uris?.normal ||
        activePrint.image_uris?.normal ||
        c.image ||
        null;

      // Resolve back image for MDFC print sheets
      const backImage = isMDFC ? (faces[1].image_uris?.normal || null) : null;

      // Resolve price based on finish selection
      let price = 0;
      if (activePrint.prices) {
        if (finish === "foil") {
          price = Number(activePrint.prices.usd_foil || activePrint.prices.usd_etched || activePrint.prices.usd || 0);
        } else {
          price = Number(activePrint.prices.usd || activePrint.prices.usd_foil || 0);
        }
      } else {
        price = Number(activePrint.price || c.price || 0);
      }

      return {
        ...c,
        qty: q,
        setCode,
        set_name,
        collector,
        image,
        backImage,
        price,
        finish,
        printsList,
        printIndex,
        isMDFC,
      };
    });
  }, [allCards, quantities, selectedPrints, finishes]);

  // Statistics calculations
  const stats = useMemo(() => {
    let totalItems = 0;
    let totalPrice = 0;
    let landsCount = 0;
    let nonLandsCount = 0;

    configuredCards.forEach((c) => {
      totalItems += c.qty;
      totalPrice += c.price * c.qty;
      if (c.category === "Land") landsCount += c.qty;
      else nonLandsCount += c.qty;
    });

    return {
      unique: configuredCards.length,
      items: totalItems,
      cost: totalPrice,
      lands: landsCount,
      nonlands: nonLandsCount,
    };
  }, [configuredCards]);

  // --- Copy / Export logic ---

  const copyMoxfield = () => {
    const text = configuredCards
      .filter((c) => c.qty > 0)
      .map((c) => `${c.qty} ${c.name}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    alert("📋 Copied Moxfield-compatible decklist to clipboard!");
  };

  const copyDetailed = () => {
    const text = configuredCards
      .filter((c) => c.qty > 0)
      .map((c) => {
        if (c.setCode && c.collector) {
          return `${c.qty} ${c.name} (${c.setCode}) ${c.collector}`;
        }
        if (c.setCode) {
          return `${c.qty} ${c.name} (${c.setCode})`;
        }
        return `${c.qty} ${c.name}`;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    alert("📋 Copied detailed decklist with set codes to clipboard!");
  };

  const downloadMpcCsv = () => {
    const headers = "Qty,Name,Set,Collector Number,Foil\n";
    const rows = configuredCards
      .filter((c) => c.qty > 0)
      .map((c) => {
        // Escape names containing commas
        const escapedName = c.name.includes(",") ? `"${c.name}"` : c.name;
        return `${c.qty},${escapedName},${c.setCode},${c.collector},${c.finish === "foil" ? "foil" : ""}`;
      })
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `manabase_mpc_order.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadMpcXml = () => {
    const flatQueue = [];
    configuredCards.forEach((c) => {
      if (c.qty > 0) {
        for (let i = 0; i < c.qty; i++) {
          flatQueue.push(c);
        }
      }
    });

    if (flatQueue.length === 0) return;

    const cardGroups = new Map();
    const backCards = [];

    flatQueue.forEach((c, slotIndex) => {
      const key = `${c.name}__${c.setCode || ""}__${c.collector || ""}`;
      if (!cardGroups.has(key)) {
        cardGroups.set(key, {
          name: c.name,
          setCode: c.setCode || "",
          collector: c.collector || "",
          slots: [slotIndex]
        });
      } else {
        cardGroups.get(key).slots.push(slotIndex);
      }

      if (c.isMDFC && c.backImage) {
        backCards.push({
          name: `${c.name} (Back)`,
          slot: slotIndex,
          query: `b:${c.name}`
        });
      }
    });

    const escapeXml = (str) => {
      if (!str) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<order>\n`;
    xml += `    <details>\n`;
    xml += `        <quantity>${flatQueue.length}</quantity>\n`;
    xml += `        <stock>(S30) Standard Smooth</stock>\n`;
    xml += `        <foil>false</foil>\n`;
    xml += `    </details>\n`;
    xml += `    <fronts>\n`;

    for (const group of cardGroups.values()) {
      const fileName = group.name.match(/\.(png|jpg|jpeg)$/i)
        ? group.name
        : `${group.name}.png`;

      xml += `        <card>\n`;
      xml += `            <id></id>\n`;
      xml += `            <slots>${group.slots.join(",")}</slots>\n`;
      xml += `            <name>${escapeXml(fileName)}</name>\n`;
      xml += `            <query>${escapeXml(group.name)}</query>\n`;
      xml += `        </card>\n`;
    }

    xml += `    </fronts>\n`;
    xml += `    <backs>\n`;
    backCards.forEach((bc) => {
      xml += `        <card>\n`;
      xml += `            <id></id>\n`;
      xml += `            <slots>${bc.slot}</slots>\n`;
      xml += `            <name>${escapeXml(bc.name)}.jpg</name>\n`;
      xml += `            <query>${escapeXml(bc.query)}</query>\n`;
      xml += `        </card>\n`;
    });
    xml += `    </backs>\n`;
    xml += `    <cardback>${escapeXml(defaultCardBack.trim())}</cardback>\n`;
    xml += `</order>\n`;

    const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `manabase_mpc_order.xml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- Print Sheets View ---
  const [printSheetsActive, setPrintSheetsActive] = useState(false);

  const togglePrintView = () => {
    setPrintSheetsActive(!printSheetsActive);
  };

  // Gather flat list of images for print sheet (repeating each card by its quantity)
  const printImages = useMemo(() => {
    const list = [];
    configuredCards.forEach((c) => {
      if (c.qty > 0 && c.image) {
        for (let i = 0; i < c.qty; i++) {
          list.push({
            name: c.name,
            front: c.image,
            back: c.backImage,
            isMDFC: c.isMDFC,
          });
        }
      }
    });
    return list;
  }, [configuredCards]);

  if (printSheetsActive) {
    return (
      <div className="print-sheets-overlay">
        <div className="print-header no-print">
          <div className="print-header-info">
            <h2>🖨️ Printable PDF Sheet Layout</h2>
            <p>
              Cards are sized to standard MTG proportions (<strong>63mm x 88mm</strong> / 2.5" x 3.5"). 
              Ready to print directly from your browser.
            </p>
            <p className="hint">
              💡 <em>Tip: Set margins to "None", layout to "Portrait", and scale to "100%" (or default) in the print dialog.</em>
            </p>
          </div>
          <div className="print-actions">
            <button className="btn-primary" onClick={() => window.print()}>
              Print Layout
            </button>
            <button className="btn-secondary" onClick={togglePrintView}>
              Close Preview
            </button>
          </div>
        </div>

        <div className="print-sheets-grid">
          {printImages.map((card, idx) => (
            <div key={idx} className="print-card-wrapper">
              <img src={card.front} alt={card.name} className="print-card-img" />
              {card.isMDFC && card.back && (
                <div className="print-card-mdfc-indicator no-print">MDFC Back face included below</div>
              )}
            </div>
          ))}

          {/* Render MDFC back faces at the end so sheets can be printed double-sided or cut separately */}
          {printImages
            .filter((c) => c.isMDFC && c.back)
            .map((card, idx) => (
              <div key={`back-${idx}`} className="print-card-wrapper back-face">
                <img src={card.back} alt={`${card.name} (Back)`} className="print-card-img" />
                <div className="print-card-label no-print">{card.name} (Back)</div>
              </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="proxy-hub-container">
      {/* Overview Cards Row */}
      <div className="overview-row">
        <div className="overview-card">
          <span className="label">Unique Cards</span>
          <span className="value">{stats.unique}</span>
        </div>
        <div className="overview-card">
          <span className="label">Total Cards (Qty)</span>
          <span className="value">{stats.items}</span>
        </div>
        <div className="overview-card highlight">
          <span className="label">Estimated Retail Cost</span>
          <span className="value">${stats.cost.toFixed(2)}</span>
        </div>
        <div className="overview-card">
          <span className="label">Build Breakdown</span>
          <span className="value sub">
            🌳 {stats.lands} Lands / ⚔️ {stats.nonlands} Non-Lands
          </span>
        </div>
      </div>

      {/* Control Actions Panel */}
      <div className="control-panel">
        <div className="panel-title">
          <h3>Order & Export Options</h3>
          <p>Export your tailored list for ordering sites, deckbuilders, or local home printing.</p>
        </div>
        <div className="action-buttons">
          <button className="hub-btn primary" onClick={() => setShowImportModal(true)} title="Bulk import decklists or CSV files">
            📥 Bulk Import
          </button>
          <button className="hub-btn" onClick={copyMoxfield} title="Copy simple 1x Card Name list">
            📋 Copy Moxfield List
          </button>
          <button className="hub-btn" onClick={copyDetailed} title="Copy detailed list with sets">
            📊 Copy Detailed List
          </button>
          <button className="hub-btn" onClick={downloadMpcCsv} title="Download a CSV template for MakePlayingCards">
            📦 Download MPC CSV
          </button>
          <button className="hub-btn" onClick={downloadMpcXml} title="Download an XML manifest for MPCfill / MPC Autofill">
            🛠️ Download MPC XML
          </button>
          <button className="hub-btn print" onClick={togglePrintView} title="Render standard 3x3 layout sheets for printer paper">
            🖨️ Print Sheets
          </button>
        </div>
        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", maxWidth: "500px" }}>
          <label style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: "600", whiteSpace: "nowrap" }}>
            🎨 Default Card Back ID / Query:
          </label>
          <input
            type="text"
            className="setup-input"
            style={{ flex: 1, fontSize: "0.85rem", padding: "0.35rem 0.6rem" }}
            placeholder="e.g. Google Drive ID, URL, or cardback search query"
            value={defaultCardBack}
            onChange={(e) => handleSaveCardBack(e.target.value)}
          />
        </div>
      </div>

      {/* Grid of Configured Cards */}
      <div className="proxy-grid">
        {configuredCards.map((card) => {
          if (!card.image) return null;

          return (
            <div key={card.name} className="proxy-card-item">
              <div className="proxy-card-preview">
                <img src={card.image} alt={card.name} />
                {card.isMDFC && <span className="mdfc-tag">MDFC</span>}
              </div>

              <div className="proxy-card-details">
                <div className="card-header-row">
                  <h4 className="card-name" title={card.name}>
                    {card.name}
                  </h4>
                  <span className="card-price">${(card.price * card.qty).toFixed(2)}</span>
                </div>

                <div className="control-group">
                  <label>Quantity</label>
                  <div className="qty-controls">
                    <button onClick={() => updateQuantity(card.name, card.qty - 1)}>-</button>
                    <input
                      type="number"
                      value={card.qty}
                      onChange={(e) => updateQuantity(card.name, parseInt(e.target.value) || 0)}
                      min="0"
                    />
                    <button onClick={() => updateQuantity(card.name, card.qty + 1)}>+</button>
                  </div>
                </div>

                {card.printsList && card.printsList.length > 1 && (
                  <div className="control-group">
                    <label>Set / Printing</label>
                    <select
                      value={card.printIndex}
                      onChange={(e) => updatePrint(card.name, parseInt(e.target.value))}
                      className="print-select"
                    >
                      {card.printsList.map((p, idx) => {
                        const setCode = (p.set || "").toUpperCase();
                        const priceStr = p.prices?.usd ? `$${Number(p.prices.usd).toFixed(2)}` : "N/A";
                        return (
                          <option key={idx} value={idx}>
                            ({setCode}) {p.set_name || "Unknown Set"} - {priceStr}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Finish Picker (Foil / Non-foil) */}
                <div className="control-group">
                  <label>Finish</label>
                  <div className="finish-picker">
                    <button
                      className={`finish-btn ${card.finish === "nonfoil" ? "active" : ""}`}
                      onClick={() => updateFinish(card.name, "nonfoil")}
                    >
                      Non-Foil
                    </button>
                    <button
                      className={`finish-btn ${card.finish === "foil" ? "active" : ""}`}
                      onClick={() => updateFinish(card.name, "foil")}
                    >
                      Foil
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importing && setShowImportModal(false)}>
          <div className="modal-container bulk-import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title">
                <h2>📥 Bulk Import Proxies</h2>
                <p>Upload CSV or paste decklists to add cards to your proxy order</p>
              </div>
              <button className="modal-close-btn" onClick={() => !importing && setShowImportModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div 
                className={`import-dropzone ${isDragging ? "dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileRead(e.dataTransfer.files[0]);
                  }
                }}
              >
                <span className="dropzone-icon">📄</span>
                <span className="dropzone-text">Drag & drop CSV or decklist file here, or</span>
                <label className="file-browse-btn">
                  Browse File
                  <input 
                    type="file" 
                    accept=".csv,.txt,.json" 
                    onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])} 
                    hidden 
                  />
                </label>
              </div>

              <div className="textarea-wrapper">
                <label className="input-label">Paste Decklist or CSV:</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`4 Brainstorm\n1 Sol Ring (C21) 255 *F*\n1 Watery Grave`}
                  rows={6}
                  className="import-textarea"
                  disabled={importing}
                />
              </div>

              {parsedPreviewCards.length > 0 && (
                <div className="import-preview-box">
                  <div className="preview-header">
                    <span>✅ Detected <strong>{parsedPreviewCards.length}</strong> unique cards ({parsedPreviewCards.reduce((s, c) => s + c.quantity, 0)} total items)</span>
                  </div>
                  <div className="preview-list-scroll">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Qty</th>
                          <th>Card Name</th>
                          <th>Set</th>
                          <th>Finish</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPreviewCards.slice(0, 10).map((c, idx) => (
                          <tr key={idx}>
                            <td>{c.quantity}x</td>
                            <td>{c.card_name}</td>
                            <td>{c.set_code || "Auto"}</td>
                            <td>{c.is_foil ? "Foil" : "Normal"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importStatus && (
                <div className="import-status-banner">
                  <span>⏳</span> {importStatus}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => { setImportText(""); setImportStatus(""); }}
                disabled={importing || !importText}
              >
                Clear
              </button>
              <div className="right-actions">
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowImportModal(false)}
                  disabled={importing}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleBulkImport}
                  disabled={importing || parsedPreviewCards.length === 0}
                >
                  {importing ? "Importing..." : `Import ${parsedPreviewCards.reduce((s, c) => s + c.quantity, 0)} Cards`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
