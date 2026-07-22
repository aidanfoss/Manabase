// src/components/OwnedCollection.jsx
import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import { parseImportInput } from "../utils/csvImporter";
import "../styles/owned.css";

const LANGUAGES = [
  { code: "EN", name: "English" },
  { code: "JA", name: "Japanese" },
  { code: "DE", name: "German" },
  { code: "FR", name: "French" },
  { code: "IT", name: "Italian" },
  { code: "ES", name: "Spanish" },
  { code: "ZH", name: "Chinese Simplified" },
  { code: "KO", name: "Korean" },
  { code: "RU", name: "Russian" },
  { code: "PT", name: "Portuguese" }
];

const CONDITIONS = [
  { code: "NM", name: "Near Mint (100%)" },
  { code: "LP", name: "Lightly Played (85%)" },
  { code: "MP", name: "Moderately Played (70%)" },
  { code: "HP", name: "Heavily Played (50%)" },
  { code: "PO", name: "Damaged/Poor (30%)" }
];

const CONDITION_MULTIPLIERS = {
  "NM": 1.0,
  "LP": 0.85,
  "MP": 0.70,
  "HP": 0.50,
  "PO": 0.30
};

export default function OwnedCollection({ onCollectionChanged }) {
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  
  // Cache for card prints: cardName -> Scryfall details
  const [printsCache, setPrintsCache] = useState({});
  const searchTimeoutRef = useRef(null);

  // Filters State
  const [filterName, setFilterName] = useState("");
  const [filterSet, setFilterSet] = useState("");
  const [filterCondition, setFilterCondition] = useState("all");
  const [filterLanguage, setFilterLanguage] = useState("all");
  const [filterFinish, setFilterFinish] = useState("all");

  // Sorting State
  const [sortField, setSortField] = useState("card_name");
  const [sortOrder, setSortOrder] = useState("asc");

  // Load collection
  useEffect(() => {
    loadCollection();
  }, []);

  const loadCollection = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/collection/owned", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const cardsList = data || [];
        setCollection(cardsList);
        if (onCollectionChanged) {
          onCollectionChanged(cardsList);
        }

        const uniqueNames = [...new Set(cardsList.map(c => c.card_name))];
        if (uniqueNames.length > 0) {
          triggerFetchPrintsBatch(uniqueNames);
        }
      }
    } catch (e) {
      console.error("Failed to load collection:", e);
    } finally {
      setLoading(false);
    }
  };

  const triggerFetchPrintsBatch = async (cardNames) => {
    const namesToFetch = cardNames.filter(name => !printsCache[name] && printsCache[name] !== "loading");
    console.log("🗃️ [OwnedCollection] triggerFetchPrintsBatch requested for:", cardNames, "Uncached:", namesToFetch);
    if (namesToFetch.length === 0) return;

    setPrintsCache(prev => {
      const next = { ...prev };
      namesToFetch.forEach(name => { next[name] = "loading"; });
      return next;
    });

    try {
      const batchResult = await api.getCardDetailsBatch(namesToFetch);
      console.log("📦 [OwnedCollection] batchResult keys returned:", Object.keys(batchResult || {}), batchResult);
      setPrintsCache(prev => {
        const next = { ...prev };
        namesToFetch.forEach(name => {
          if (batchResult[name]) {
            next[name] = batchResult[name];
            console.log(`✅ [OwnedCollection] Successfully cached "${name}" with ${batchResult[name].prints?.length || 0} prints.`);
          } else {
            console.warn(`⚠️ [OwnedCollection] Missing card details for "${name}" in batch result!`);
            delete next[name]; // clear loading state if not found
          }
        });
        return next;
      });
    } catch (err) {
      console.error("❌ [OwnedCollection] Failed to fetch prints batch", err);
      setPrintsCache(prev => {
        const next = { ...prev };
        namesToFetch.forEach(name => { delete next[name]; });
        return next;
      });
    }
  };

  // Search card autocomplete
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await api.getCardSearch(val.trim());
        setSearchResults(results || []);
      } catch (err) {
        console.error("Card search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  // Add card to collection
  const addCard = async (card) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please log in to manage your collection.");
        return;
      }

      const payload = {
        card_name: card.name,
        quantity: 1,
        set_code: (card.set || "").toUpperCase(),
        collector_number: card.collector_number || "",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      };

      const res = await fetch("/api/collection/owned", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSearchQuery("");
        setSearchResults([]);
        loadCollection();
      }
    } catch (e) {
      console.error("Failed to add card:", e);
    }
  };

  // Update card fields
  const handleFieldChange = async (card, field, val) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const payload = {
        id: card.id,
        card_name: card.card_name,
        quantity: field === "quantity" ? parseInt(val) || 0 : card.quantity,
        set_code: field === "set_code" ? (val || "").toUpperCase() : card.set_code,
        collector_number: field === "collector_number" ? val : card.collector_number,
        is_foil: field === "is_foil" ? !!val : !!card.is_foil,
        card_condition: field === "card_condition" ? val : (card.card_condition || "NM"),
        card_language: field === "card_language" ? val : (card.card_language || "EN")
      };

      // Automatically update collector_number if set_code changes
      if (field === "set_code" && printsCache[card.card_name]) {
        const prints = printsCache[card.card_name].prints || [];
        const match = prints.find(p => p.set?.toUpperCase() === val.toUpperCase());
        if (match) {
          payload.collector_number = match.collector_number || "";
        }
      }

      const res = await fetch("/api/collection/owned", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        loadCollection();
      }
    } catch (e) {
      console.error("Failed to update card details:", e);
    }
  };

  // Delete card row
  const deleteCard = async (card) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/collection/owned", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: card.id
        }),
      });

      if (res.ok) {
        loadCollection();
      }
    } catch (e) {
      console.error("Failed to delete card:", e);
    }
  };

  // Bulk clear collection
  const handleClearCollection = async () => {
    if (!window.confirm("⚠️ Are you sure you want to clear your entire collection? This cannot be undone.")) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/collection/owned", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clear_all: true
        }),
      });

      if (res.ok) {
        loadCollection();
        alert("Collection cleared successfully!");
      }
    } catch (e) {
      console.error("Failed to clear collection:", e);
    }
  };

  // Helper to calculate card value
  const getRowPrice = (card) => {
    const cached = printsCache[card.card_name];
    if (!cached || cached === "loading" || !cached.prints) return 0;

    const activePrint = cached.prints.find(p => p.set?.toUpperCase() === (card.set_code || "").toUpperCase()) || cached.prints[0];
    if (!activePrint || !activePrint.prices) return 0;

    const basePriceStr = card.is_foil ? activePrint.prices.usd_foil : activePrint.prices.usd;
    const basePrice = parseFloat(basePriceStr) || 0;
    const mult = CONDITION_MULTIPLIERS[card.card_condition || "NM"] || 1.0;

    return basePrice * mult;
  };

  // Export as CSV File
  const handleExportCSV = () => {
    if (collection.length === 0) return;
    const headers = "Quantity,Card Name,Set Code,Collector Number,Is Foil,Condition,Language,Price Each,Total Value\r\n";
    const rows = collection.map(c => {
      const priceEach = getRowPrice(c);
      const totalVal = priceEach * c.quantity;
      return `"${c.quantity}","${c.card_name}","${c.set_code || ""}","${c.collector_number || ""}","${c.is_foil ? "Yes" : "No"}","${c.card_condition || "NM"}","${c.card_language || "EN"}","$${priceEach.toFixed(2)}","$${totalVal.toFixed(2)}"`;
    }).join("\r\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `owned_collection_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // File upload handler for CSV/TXT files
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result || "";
      setImportText(text);
      setImportStatus(`Loaded file "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.readAsText(file);
  };

  // Import from CSV or Text paste
  const handleImport = async () => {
    if (!importText.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to import cards.");
      return;
    }

    setImporting(true);
    setImportStatus("Parsing CSV / decklist content...");

    try {
      const parsedCards = parseImportInput(importText);
      if (parsedCards.length === 0) {
        alert("No valid cards found in the provided CSV or text input.");
        setImporting(false);
        setImportStatus("");
        return;
      }

      setImportStatus(`Found ${parsedCards.length} cards. Starting batch import...`);

      const CHUNK_SIZE = 500;
      let totalAdded = 0;

      for (let i = 0; i < parsedCards.length; i += CHUNK_SIZE) {
        const chunk = parsedCards.slice(i, i + CHUNK_SIZE);
        const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
        const totalBatches = Math.ceil(parsedCards.length / CHUNK_SIZE);

        setImportStatus(`Importing batch ${batchNum} of ${totalBatches} (${chunk.length} cards)...`);

        const res = await fetch("/api/collection/owned/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cards: chunk }),
        });

        if (res.ok) {
          const data = await res.json();
          totalAdded += data.count || chunk.length;
        } else {
          console.error("Batch import chunk failed:", res.status);
        }
      }

      setImportText("");
      setShowImport(false);
      setImportStatus("");
      await loadCollection();
      alert(`🎉 Successfully imported ${totalAdded} cards into your collection!`);
    } catch (err) {
      console.error("Failed importing cards:", err);
      alert("An error occurred during import. Please try again.");
    } finally {
      setImporting(false);
      setLoading(false);
    }
  };

  // Sort clicking helper
  const handleSortClick = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Reset all filters
  const handleClearFilters = () => {
    setFilterName("");
    setFilterSet("");
    setFilterCondition("all");
    setFilterLanguage("all");
    setFilterFinish("all");
  };

  // Calculate filtered and sorted lists
  const filteredAndSortedList = (() => {
    let result = [...collection];

    // Filters
    if (filterName.trim()) {
      const q = filterName.toLowerCase();
      result = result.filter(c => c.card_name.toLowerCase().includes(q));
    }
    if (filterSet.trim()) {
      const q = filterSet.toLowerCase();
      result = result.filter(c => (c.set_code || "").toLowerCase().includes(q));
    }
    if (filterCondition !== "all") {
      result = result.filter(c => (c.card_condition || "NM") === filterCondition);
    }
    if (filterLanguage !== "all") {
      result = result.filter(c => (c.card_language || "EN") === filterLanguage);
    }
    if (filterFinish !== "all") {
      const isFoilFilter = filterFinish === "foil";
      result = result.filter(c => !!c.is_foil === isFoilFilter);
    }

    // Sort
    result.sort((a, b) => {
      let valA, valB;

      if (sortField === "price") {
        valA = getRowPrice(a) * a.quantity;
        valB = getRowPrice(b) * b.quantity;
      } else if (sortField === "quantity") {
        valA = a.quantity;
        valB = b.quantity;
      } else if (sortField === "set_code") {
        valA = a.set_code || "";
        valB = b.set_code || "";
      } else if (sortField === "card_condition") {
        valA = a.card_condition || "NM";
        valB = b.card_condition || "NM";
      } else if (sortField === "card_language") {
        valA = a.card_language || "EN";
        valB = b.card_language || "EN";
      } else {
        valA = a.card_name || "";
        valB = b.card_name || "";
      }

      if (typeof valA === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder === "asc"
          ? valA - valB
          : valB - valA;
      }
    });

    return result;
  })();

  // Global totals based on full collection
  const totalItems = collection.reduce((sum, c) => sum + c.quantity, 0);
  const uniqueCardsCount = new Set(collection.map(c => c.card_name)).size;
  const totalCollectionValue = collection.reduce((sum, c) => sum + (getRowPrice(c) * c.quantity), 0);

  // Helper finish option names with pricing
  const getFinishOptionLabel = (card, finishType) => {
    const cached = printsCache[card.card_name];
    if (!cached || cached === "loading" || !cached.prints) return finishType === "foil" ? "Foil" : "Normal";
    
    const activePrint = cached.prints.find(p => p.set?.toUpperCase() === (card.set_code || "").toUpperCase()) || cached.prints[0];
    if (!activePrint || !activePrint.prices) return finishType === "foil" ? "Foil" : "Normal";
    
    const price = finishType === "foil" ? activePrint.prices.usd_foil : activePrint.prices.usd;
    return `${finishType === "foil" ? "Foil" : "Normal"} (${price ? `$${parseFloat(price).toFixed(2)}` : "N/A"})`;
  };

  const getSortIndicator = (field) => {
    if (sortField !== field) return "";
    return sortOrder === "asc" ? " 🔼" : " 🔽";
  };

  return (
    <div className="collection-page-container">
      {/* Header Area */}
      <div className="collection-header">
        <div>
          <h1 className="collection-title">🗃️ Card Inventory Manager</h1>
          <p className="collection-subtitle">Cardsphere-style tracking of condition, language, sets, and real-time market value.</p>
        </div>
        
        <div className="collection-actions">
          <button className="csv-btn export" onClick={handleExportCSV} disabled={collection.length === 0}>
            📥 Export CSV
          </button>
          <button className="csv-btn import" onClick={() => setShowImport(!showImport)}>
            📤 Bulk Import
          </button>
          <button className="csv-btn delete-all-btn" onClick={handleClearCollection} disabled={collection.length === 0}>
            🗑️ Clear Collection
          </button>
        </div>
      </div>

      {/* Global Stats Summary Row */}
      <div className="collection-stats-banner">
        <div className="stat-box">
          <span className="stat-label">Total Inventory Value</span>
          <span className="stat-val value-highlight">${totalCollectionValue.toFixed(2)}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Total Card Count</span>
          <span className="stat-val">{totalItems}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Unique Prints</span>
          <span className="stat-val">{collection.length}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Unique Card Names</span>
          <span className="stat-val">{uniqueCardsCount}</span>
        </div>
      </div>

      {showImport && (
        <div className="bulk-import-panel">
          <h3>📤 Bulk Collection Importer</h3>
          <p className="import-help">
            Supports <strong>ManaBox CSV files</strong> (e.g., <code>Giga Boxes.csv</code>), Scryfall/Cardsphere CSVs, or standard decklists (<code>4 Hallowed Fountain</code>).
          </p>
          
          <div className="import-file-section">
            <label htmlFor="csv-file-input" className="file-upload-btn">
              📁 Choose CSV or Text File
            </label>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            {importStatus && <span className="import-status-text">{importStatus}</span>}
          </div>

          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Or paste CSV text / decklist lines here:&#10;Name,Set code,Collector number,Foil,Quantity,Condition,Language&#10;Brainstorm,TLE,155,foil,1,near_mint,en"
            rows={7}
            className="import-textarea"
            disabled={importing}
          />
          <div className="import-actions">
            <button className="import-confirm-btn" onClick={handleImport} disabled={importing || !importText.trim()}>
              {importing ? "Importing..." : "Start Import"}
            </button>
            <button className="import-cancel-btn" onClick={() => { setShowImport(false); setImportStatus(""); }} disabled={importing}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Autocomplete Quick Search */}
      <div className="search-bar-row">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Quick search and add card to inventory..."
            className="collection-search-input"
          />
          {searching && <span className="search-spinner-inline">Searching...</span>}
        </div>

        {searchResults.length > 0 && (
          <div className="search-suggestions-overlay">
            {searchResults.map((card) => (
              <div 
                key={card.id} 
                className="suggestion-row"
                onClick={() => addCard(card)}
              >
                <span className="name">{card.name}</span>
                <span className="set">({card.set ? card.set.toUpperCase() : "N/A"})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Filters Header */}
      <div className="collection-filters-bar">
        <div className="filter-group">
          <label>Filter Name:</label>
          <input 
            type="text" 
            placeholder="e.g. Mox" 
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label>Filter Set:</label>
          <input 
            type="text" 
            placeholder="e.g. ELD" 
            value={filterSet}
            onChange={(e) => setFilterSet(e.target.value)}
            className="filter-input set-code"
          />
        </div>
        <div className="filter-group">
          <label>Condition:</label>
          <select 
            value={filterCondition} 
            onChange={(e) => setFilterCondition(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Conditions</option>
            {CONDITIONS.map(c => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Language:</label>
          <select 
            value={filterLanguage} 
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Languages</option>
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.code}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Finish:</label>
          <select 
            value={filterFinish} 
            onChange={(e) => setFilterFinish(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Finishes</option>
            <option value="normal">Normal Only</option>
            <option value="foil">Foil Only</option>
          </select>
        </div>
        {(filterName || filterSet || filterCondition !== "all" || filterLanguage !== "all" || filterFinish !== "all") && (
          <button className="clear-filters-btn" onClick={handleClearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {/* CSV Spreadsheet Table */}
      <div className="csv-table-wrapper">
        {loading && collection.length === 0 ? (
          <div className="table-loading">Loading inventory...</div>
        ) : collection.length === 0 ? (
          <div className="table-empty">
            Your collection is empty. Search above or bulk import to get started!
          </div>
        ) : filteredAndSortedList.length === 0 ? (
          <div className="table-empty">
            No cards match the active filters.
          </div>
        ) : (
          <table className="csv-table">
            <thead>
              <tr>
                <th className="col-qty clickable" onClick={() => handleSortClick("quantity")}>
                  Qty{getSortIndicator("quantity")}
                </th>
                <th className="col-name clickable" onClick={() => handleSortClick("card_name")}>
                  Card Name{getSortIndicator("card_name")}
                </th>
                <th className="col-set clickable" onClick={() => handleSortClick("set_code")}>
                  Set printing{getSortIndicator("set_code")}
                </th>
                <th className="col-foil">Finish</th>
                <th className="col-condition clickable" onClick={() => handleSortClick("card_condition")}>
                  Condition{getSortIndicator("card_condition")}
                </th>
                <th className="col-language clickable" onClick={() => handleSortClick("card_language")}>
                  Language{getSortIndicator("card_language")}
                </th>
                <th className="col-price clickable" onClick={() => handleSortClick("price")}>
                  Price (Est.){getSortIndicator("price")}
                </th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedList.map((card) => {
                const rowPrice = getRowPrice(card);
                const rowTotal = rowPrice * card.quantity;
                const cachedPrints = printsCache[card.card_name];
                const printsLoaded = cachedPrints && cachedPrints !== "loading";
                const isCachedFoil = !!card.is_foil;

                return (
                  <tr key={card.id}>
                    {/* Quantity cell */}
                    <td className="col-qty">
                      <input
                        type="number"
                        min="1"
                        value={card.quantity}
                        onChange={(e) => handleFieldChange(card, "quantity", e.target.value)}
                        className="table-input qty"
                      />
                    </td>
                    
                    {/* Card Name cell */}
                    <td className="col-name font-bold">
                      {card.card_name}
                    </td>
                    
                    {/* Set Code Dropdown cell */}
                    <td className="col-set">
                      <select
                        value={card.set_code ? card.set_code.toUpperCase() : ""}
                        onChange={(e) => handleFieldChange(card, "set_code", e.target.value)}
                        className="table-input set-select"
                        disabled={!printsLoaded}
                      >
                        {printsLoaded ? (
                          cachedPrints.prints.map((p, idx) => {
                            const priceStr = isCachedFoil ? p.prices?.usd_foil : p.prices?.usd;
                            const priceLabel = priceStr ? ` ($${parseFloat(priceStr).toFixed(2)})` : "";
                            return (
                              <option key={idx} value={p.set?.toUpperCase()}>
                                {p.set?.toUpperCase()} - {p.set_name}{priceLabel}
                              </option>
                            );
                          })
                        ) : (
                          <option value={card.set_code || ""}>
                            {card.set_code ? card.set_code.toUpperCase() : "Loading..."}
                          </option>
                        )}
                      </select>
                    </td>
                    
                    {/* Finish dropdown cell */}
                    <td className="col-foil">
                      <select
                        value={card.is_foil ? "foil" : "normal"}
                        onChange={(e) => handleFieldChange(card, "is_foil", e.target.value === "foil")}
                        className="table-input finish-select"
                      >
                        <option value="normal">{getFinishOptionLabel(card, "normal")}</option>
                        <option value="foil">{getFinishOptionLabel(card, "foil")}</option>
                      </select>
                    </td>

                    {/* Condition cell */}
                    <td className="col-condition">
                      <select
                        value={card.card_condition || "NM"}
                        onChange={(e) => handleFieldChange(card, "card_condition", e.target.value)}
                        className="table-input condition-select"
                      >
                        {CONDITIONS.map((cond) => (
                          <option key={cond.code} value={cond.code}>
                            {cond.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Language cell */}
                    <td className="col-language">
                      <select
                        value={card.card_language || "EN"}
                        onChange={(e) => handleFieldChange(card, "card_language", e.target.value)}
                        className="table-input language-select"
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.code} - {lang.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    
                    {/* Price cell */}
                    <td className="col-price font-bold">
                      {rowPrice > 0 ? (
                        <div className="price-display-wrapper">
                          <span className="price-each">${rowPrice.toFixed(2)} ea</span>
                          <span className="price-total">Total: ${rowTotal.toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="price-unavail">Price N/A</span>
                      )}
                    </td>
                    
                    {/* Actions cell */}
                    <td className="col-actions">
                      <button 
                        className="table-delete-btn"
                        onClick={() => deleteCard(card)}
                        title="Remove card from inventory"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
