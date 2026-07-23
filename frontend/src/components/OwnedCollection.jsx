// src/components/OwnedCollection.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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

// Helper to check if a card is an unresolved token or missing Scryfall entry
const isCardUnresolved = (card, printsCache) => {
  const cached = printsCache[card.card_name];
  if (!cached || cached === "loading") return false;
  return cached.missing === true || !cached.prints || cached.prints.length === 0;
};

// Memoized individual table row component
const CollectionRow = React.memo(({
  card,
  cachedPrints,
  onFieldChange,
  onDelete
}) => {
  const isUnresolved = cachedPrints && cachedPrints !== "loading" && (cachedPrints.missing === true || !cachedPrints.prints || cachedPrints.prints.length === 0);
  const printsLoaded = cachedPrints && cachedPrints !== "loading" && !isUnresolved;
  const isCachedFoil = !!card.is_foil;

  // Calculate row price
  let rowPrice = 0;
  if (printsLoaded && cachedPrints.prints && cachedPrints.prints.length > 0) {
    const activePrint = cachedPrints.prints.find(p => p.set?.toUpperCase() === (card.set_code || "").toUpperCase()) || cachedPrints.prints[0];
    if (activePrint && activePrint.prices) {
      const basePriceStr = card.is_foil ? activePrint.prices.usd_foil : activePrint.prices.usd;
      const basePrice = parseFloat(basePriceStr) || 0;
      const mult = CONDITION_MULTIPLIERS[card.card_condition || "NM"] || 1.0;
      rowPrice = basePrice * mult;
    }
  }
  const rowTotal = rowPrice * card.quantity;

  const getFinishLabel = (finishType) => {
    if (!printsLoaded || !cachedPrints.prints) return finishType === "foil" ? "Foil" : "Normal";
    const activePrint = cachedPrints.prints.find(p => p.set?.toUpperCase() === (card.set_code || "").toUpperCase()) || cachedPrints.prints[0];
    if (!activePrint || !activePrint.prices) return finishType === "foil" ? "Foil" : "Normal";
    const price = finishType === "foil" ? activePrint.prices.usd_foil : activePrint.prices.usd;
    return `${finishType === "foil" ? "Foil" : "Normal"} (${price ? `$${parseFloat(price).toFixed(2)}` : "N/A"})`;
  };

  return (
    <tr className={isUnresolved ? "row-unresolved" : ""}>
      {/* Quantity */}
      <td className="col-qty">
        <input
          type="number"
          min="1"
          value={card.quantity}
          onChange={(e) => onFieldChange(card, "quantity", e.target.value)}
          className="table-input qty"
        />
      </td>

      {/* Card Name */}
      <td className="col-name font-bold">
        <div className="name-cell-wrapper">
          <span>{card.card_name}</span>
          {isUnresolved && (
            <span className="unresolved-badge" title="Card printing not found in database. Token or malformed import.">
              ⚠️ Token / Unresolved
            </span>
          )}
        </div>
      </td>

      {/* Set Printing */}
      <td className="col-set">
        {isUnresolved ? (
          <input
            type="text"
            value={card.set_code || ""}
            onChange={(e) => onFieldChange(card, "set_code", e.target.value)}
            placeholder="Set Code (e.g. ELD)"
            className="table-input set-input"
          />
        ) : printsLoaded ? (
          <select
            value={card.set_code ? card.set_code.toUpperCase() : ""}
            onChange={(e) => onFieldChange(card, "set_code", e.target.value)}
            className="table-input set-select"
          >
            {cachedPrints.prints.map((p, idx) => {
              const priceStr = isCachedFoil ? p.prices?.usd_foil : p.prices?.usd;
              const priceLabel = priceStr ? ` ($${parseFloat(priceStr).toFixed(2)})` : "";
              return (
                <option key={idx} value={p.set?.toUpperCase()}>
                  {p.set?.toUpperCase()} - {p.set_name}{priceLabel}
                </option>
              );
            })}
          </select>
        ) : (
          <select
            value={card.set_code ? card.set_code.toUpperCase() : ""}
            onChange={(e) => onFieldChange(card, "set_code", e.target.value)}
            className="table-input set-select"
          >
            <option value={card.set_code || ""}>
              {card.set_code ? card.set_code.toUpperCase() : "Loading..."}
            </option>
          </select>
        )}
      </td>

      {/* Finish */}
      <td className="col-foil">
        <select
          value={card.is_foil ? "foil" : "normal"}
          onChange={(e) => onFieldChange(card, "is_foil", e.target.value === "foil")}
          className="table-input finish-select"
        >
          <option value="normal">{getFinishLabel("normal")}</option>
          <option value="foil">{getFinishLabel("foil")}</option>
        </select>
      </td>

      {/* Condition */}
      <td className="col-condition">
        <select
          value={card.card_condition || "NM"}
          onChange={(e) => onFieldChange(card, "card_condition", e.target.value)}
          className="table-input condition-select"
        >
          {CONDITIONS.map((cond) => (
            <option key={cond.code} value={cond.code}>
              {cond.name}
            </option>
          ))}
        </select>
      </td>

      {/* Language */}
      <td className="col-language">
        <select
          value={card.card_language || "EN"}
          onChange={(e) => onFieldChange(card, "card_language", e.target.value)}
          className="table-input language-select"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.code} - {lang.name}
            </option>
          ))}
        </select>
      </td>

      {/* Price */}
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

      {/* Actions */}
      <td className="col-actions">
        <button
          className="table-delete-btn"
          onClick={() => onDelete(card)}
          title="Remove card from inventory"
        >
          Remove
        </button>
      </td>
    </tr>
  );
});

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
  
  // Cache for card prints: cardName -> Scryfall details or { missing: true, prints: [] }
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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
    if (namesToFetch.length === 0) return;

    setPrintsCache(prev => {
      const next = { ...prev };
      namesToFetch.forEach(name => { next[name] = "loading"; });
      return next;
    });

    try {
      const batchResult = await api.getCardDetailsBatch(namesToFetch);
      setPrintsCache(prev => {
        const next = { ...prev };
        namesToFetch.forEach(name => {
          if (batchResult && batchResult[name]) {
            next[name] = batchResult[name];
          } else {
            console.warn(`⚠️ [OwnedCollection] Missing card details for "${name}" in batch result!`);
            next[name] = { missing: true, prints: [] };
          }
        });
        return next;
      });
    } catch (err) {
      console.error("❌ [OwnedCollection] Failed to fetch prints batch", err);
      setPrintsCache(prev => {
        const next = { ...prev };
        namesToFetch.forEach(name => {
          next[name] = { missing: true, prints: [] };
        });
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

  // Update card fields (useCallback for child row performance)
  const handleFieldChange = useCallback(async (card, field, val) => {
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

      // Automatically update collector_number if set_code changes and prints are available
      if (field === "set_code" && printsCache[card.card_name] && printsCache[card.card_name].prints) {
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
  }, [printsCache]);

  // Delete card row
  const deleteCard = useCallback(async (card) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/collection/owned", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: card.id }),
      });

      if (res.ok) {
        loadCollection();
      }
    } catch (e) {
      console.error("Failed to delete card:", e);
    }
  }, []);

  // Delete all unresolved/token cards
  const handleDeleteAllUnresolved = async () => {
    const unresolvedCards = collection.filter(c => isCardUnresolved(c, printsCache));
    if (unresolvedCards.length === 0) return;

    if (!window.confirm(`⚠️ Are you sure you want to delete all ${unresolvedCards.length} unresolved token/malformed cards?`)) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      for (const card of unresolvedCards) {
        await fetch("/api/collection/owned", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id: card.id }),
        });
      }
      loadCollection();
    } catch (e) {
      console.error("Failed deleting unresolved cards:", e);
    } finally {
      setLoading(false);
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
        body: JSON.stringify({ clear_all: true }),
      });

      if (res.ok) {
        loadCollection();
        alert("Collection cleared successfully!");
      }
    } catch (e) {
      console.error("Failed to clear collection:", e);
    }
  };

  // Price helper for single card
  const getRowPrice = useCallback((card) => {
    const cached = printsCache[card.card_name];
    if (!cached || cached === "loading" || cached.missing || !cached.prints || cached.prints.length === 0) return 0;

    const activePrint = cached.prints.find(p => p.set?.toUpperCase() === (card.set_code || "").toUpperCase()) || cached.prints[0];
    if (!activePrint || !activePrint.prices) return 0;

    const basePriceStr = card.is_foil ? activePrint.prices.usd_foil : activePrint.prices.usd;
    const basePrice = parseFloat(basePriceStr) || 0;
    const mult = CONDITION_MULTIPLIERS[card.card_condition || "NM"] || 1.0;

    return basePrice * mult;
  }, [printsCache]);

  // Export CSV
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

  // CSV/TXT Upload
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

  // Import handler
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
    setCurrentPage(1);
  };

  // Reset filters
  const handleClearFilters = () => {
    setFilterName("");
    setFilterSet("");
    setFilterCondition("all");
    setFilterLanguage("all");
    setFilterFinish("all");
    setCurrentPage(1);
  };

  // Calculate filtered, sorted, and unresolved-prioritized list
  const filteredAndSortedList = useMemo(() => {
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

    // Sort: Unresolved / Tokens float to top first
    result.sort((a, b) => {
      const unresA = isCardUnresolved(a, printsCache);
      const unresB = isCardUnresolved(b, printsCache);

      if (unresA !== unresB) {
        return unresA ? -1 : 1;
      }

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
  }, [collection, filterName, filterSet, filterCondition, filterLanguage, filterFinish, sortField, sortOrder, printsCache, getRowPrice]);

  // Unresolved count
  const unresolvedList = useMemo(() => {
    return collection.filter(c => isCardUnresolved(c, printsCache));
  }, [collection, printsCache]);

  // Pagination calculation
  const totalFilteredCount = filteredAndSortedList.length;
  const effectivePageSize = pageSize === "all" ? totalFilteredCount || 1 : pageSize;
  const totalPages = Math.ceil(totalFilteredCount / effectivePageSize) || 1;

  const displayedList = useMemo(() => {
    if (pageSize === "all") return filteredAndSortedList;
    const startIdx = (currentPage - 1) * pageSize;
    return filteredAndSortedList.slice(startIdx, startIdx + pageSize);
  }, [filteredAndSortedList, currentPage, pageSize]);

  // Global totals
  const totalItems = collection.reduce((sum, c) => sum + c.quantity, 0);
  const uniqueCardsCount = new Set(collection.map(c => c.card_name)).size;
  const totalCollectionValue = useMemo(() => {
    return collection.reduce((sum, c) => sum + (getRowPrice(c) * c.quantity), 0);
  }, [collection, getRowPrice]);

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

      {/* Global Stats Summary Banner */}
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

      {/* Unresolved / Token Imports Warning Banner */}
      {unresolvedList.length > 0 && (
        <div className="unresolved-warning-banner">
          <div className="banner-left">
            <span className="banner-icon">⚠️</span>
            <div>
              <strong>{unresolvedList.length} unresolved token/malformed cards found in your collection</strong>
              <p>Items like "{unresolvedList.slice(0, 3).map(c => c.card_name).join('", "')}" could not be matched to official Scryfall prints. They are floating at the top of your list.</p>
            </div>
          </div>
          <button className="delete-unresolved-btn" onClick={handleDeleteAllUnresolved}>
            🗑️ Delete All {unresolvedList.length} Unresolved Cards
          </button>
        </div>
      )}

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
            onChange={(e) => { setFilterName(e.target.value); setCurrentPage(1); }}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label>Filter Set:</label>
          <input 
            type="text" 
            placeholder="e.g. ELD" 
            value={filterSet}
            onChange={(e) => { setFilterSet(e.target.value); setCurrentPage(1); }}
            className="filter-input set-code"
          />
        </div>
        <div className="filter-group">
          <label>Condition:</label>
          <select 
            value={filterCondition} 
            onChange={(e) => { setFilterCondition(e.target.value); setCurrentPage(1); }}
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
            onChange={(e) => { setFilterLanguage(e.target.value); setCurrentPage(1); }}
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
            onChange={(e) => { setFilterFinish(e.target.value); setCurrentPage(1); }}
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

      {/* Top Pagination Controls */}
      {totalFilteredCount > 0 && (
        <div className="pagination-bar">
          <div className="pagination-info">
            Showing <strong>{totalFilteredCount === 0 ? 0 : (currentPage - 1) * (pageSize === "all" ? totalFilteredCount : pageSize) + 1} - {Math.min(currentPage * (pageSize === "all" ? totalFilteredCount : pageSize), totalFilteredCount)}</strong> of <strong>{totalFilteredCount}</strong> cards
          </div>
          <div className="pagination-controls">
            <label className="page-size-label">
              Per page:
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === "all" ? "all" : parseInt(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="page-size-select"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value="all">All</option>
              </select>
            </label>

            {pageSize !== "all" && totalPages > 1 && (
              <div className="page-buttons">
                <button
                  className="page-nav-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ◀ Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) => (
                    p === "..." ? (
                      <span key={`dots-${idx}`} className="page-dots">...</span>
                    ) : (
                      <button
                        key={p}
                        className={`page-num-btn ${currentPage === p ? "active" : ""}`}
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </button>
                    )
                  ))
                }

                <button
                  className="page-nav-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next ▶
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
              {displayedList.map((card) => (
                <CollectionRow
                  key={card.id}
                  card={card}
                  cachedPrints={printsCache[card.card_name]}
                  onFieldChange={handleFieldChange}
                  onDelete={deleteCard}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Pagination Controls */}
      {totalFilteredCount > 0 && pageSize !== "all" && totalPages > 1 && (
        <div className="pagination-bar bottom">
          <div className="pagination-info">
            Page {currentPage} of {totalPages}
          </div>
          <div className="pagination-controls">
            <div className="page-buttons">
              <button
                className="page-nav-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ◀ Prev
              </button>
              <button
                className="page-nav-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
