// src/components/OwnedCollection.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ExclamationTriangleIcon, RectangleGroupIcon, SparklesIcon, XMarkIcon, ChevronUpIcon, ChevronDownIcon, ArchiveBoxIcon, InboxIcon, ArrowUpTrayIcon, TrashIcon, FolderIcon, MagnifyingGlassIcon, PhotoIcon, ChartBarIcon } from "@heroicons/react/24/solid";



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

// Helper to generate descriptive tag for a card print variant (e.g. #290 Borderless)
const getPrintVariantLabel = (p) => {
  const parts = [];
  if (p.collector_number) parts.push(`#${p.collector_number}`);
  if (p.border_color === "borderless") parts.push("Borderless");
  if (p.frame_effects?.includes("showcase")) parts.push("Showcase");
  if (p.frame_effects?.includes("extendedart")) parts.push("Extended Art");
  if (p.promo_types?.includes("prerelease")) parts.push("Prerelease");
  if (p.promo_types?.includes("stamped")) parts.push("Stamped");
  if (p.full_art && !parts.includes("Borderless")) parts.push("Full Art");
  return parts.join(" ");
};

// Helper to extract deduplicated unique sets from prints list
const getUniqueSetsFromPrints = (prints = []) => {
  const seen = new Set();
  const uniqueSets = [];
  for (const p of prints) {
    const setCode = (p.set || "").toUpperCase();
    if (!setCode || seen.has(setCode)) continue;
    seen.add(setCode);
    uniqueSets.push({
      set_code: setCode,
      set_name: p.set_name || setCode
    });
  }
  return uniqueSets;
};

// Helper to build Finish / Version dropdown options for a given card and set_code
const getFinishVersionOptions = (cachedPrints, setCode) => {
  if (!cachedPrints || !cachedPrints.prints || cachedPrints.prints.length === 0) {
    return [
      { key: ":normal", collNum: "", isFoil: false, label: "Normal" },
      { key: ":foil", collNum: "", isFoil: true, label: "Foil" }
    ];
  }

  const matchingPrints = cachedPrints.prints.filter(p => p.set?.toUpperCase() === (setCode || "").toUpperCase());
  const targetPrints = matchingPrints.length > 0 ? matchingPrints : cachedPrints.prints;
  const isMultiVariant = targetPrints.length > 1;

  const options = [];
  targetPrints.forEach((p) => {
    const variantTag = getPrintVariantLabel(p);
    const tagSuffix = variantTag ? ` (${variantTag})` : isMultiVariant ? ` (#${p.collector_number})` : "";

    const normPrice = p.prices?.usd ? ` ($${parseFloat(p.prices.usd).toFixed(2)})` : "";
    const foilPrice = p.prices?.usd_foil ? ` ($${parseFloat(p.prices.usd_foil).toFixed(2)})` : "";

    options.push({
      key: `${p.collector_number || ""}:normal`,
      collNum: p.collector_number || "",
      isFoil: false,
      label: `Normal${tagSuffix}${normPrice}`
    });

    options.push({
      key: `${p.collector_number || ""}:foil`,
      collNum: p.collector_number || "",
      isFoil: true,
      label: `Foil${tagSuffix}${foilPrice}`
    });
  });

  return options;
};

// Memoized Table Row Component
const CollectionRow = React.memo(({
  card,
  cachedPrints,
  onFieldChange,
  onDelete
}) => {
  const isUnresolved = cachedPrints && cachedPrints !== "loading" && (cachedPrints.missing === true || !cachedPrints.prints || cachedPrints.prints.length === 0);
  const printsLoaded = cachedPrints && cachedPrints !== "loading" && !isUnresolved;

  // Find exact active print match based on set_code and collector_number
  const setPrints = printsLoaded && cachedPrints.prints ? (
    cachedPrints.prints.filter(p => p.set?.toUpperCase() === (card.set_code || "").toUpperCase())
  ) : [];

  const activePrint = setPrints.length > 0 ? (
    setPrints.find(p => card.collector_number ? p.collector_number === card.collector_number : true) || setPrints[0]
  ) : (printsLoaded && cachedPrints.prints ? cachedPrints.prints[0] : null);

  // Unique sets for the set dropdown
  const uniqueSets = getUniqueSetsFromPrints(cachedPrints?.prints);
  // Version / Finish options for active set
  const finishOptions = getFinishVersionOptions(cachedPrints, card.set_code);

  const currentSelectedFinishKey = `${activePrint?.collector_number || card.collector_number || ""}:${card.is_foil ? "foil" : "normal"}`;

  // Calculate row price
  let rowPrice = 0;
  if (activePrint && activePrint.prices) {
    const basePriceStr = card.is_foil ? activePrint.prices.usd_foil : activePrint.prices.usd;
    const basePrice = parseFloat(basePriceStr) || 0;
    const mult = CONDITION_MULTIPLIERS[card.card_condition || "NM"] || 1.0;
    rowPrice = basePrice * mult;
  }
  const rowTotal = rowPrice * card.quantity;

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
              <ExclamationTriangleIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />️ Token / Unresolved
            </span>
          )}
          {!!card.is_proxy && (
            <span className="proxy-badge" style={{ backgroundColor: '#ff9800', color: '#fff', fontSize: '0.7em', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', verticalAlign: 'middle' }}>
              PROXY
            </span>
          )}
        </div>
      </td>

      {/* Set Printing (Deduplicated Unique Sets) */}
      <td className="col-set">
        {isUnresolved ? (
          <input
            type="text"
            value={card.set_code || ""}
            onChange={(e) => onFieldChange(card, "set_code", e.target.value)}
            placeholder="Set Code (e.g. ELD)"
            className="table-input set-input"
          />
        ) : printsLoaded && uniqueSets.length > 0 ? (
          <select
            value={card.set_code ? card.set_code.toUpperCase() : ""}
            onChange={(e) => onFieldChange(card, "set_code", e.target.value)}
            className="table-input set-select"
          >
            {uniqueSets.map((s) => (
              <option key={s.set_code} value={s.set_code}>
                {s.set_code} - {s.set_name}
              </option>
            ))}
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

      {/* Finish / Version Dropdown (Includes Art Variants & Foils) */}
      <td className="col-foil">
        <select
          value={currentSelectedFinishKey}
          onChange={(e) => {
            const [collNum, finishType] = e.target.value.split(":");
            onFieldChange(card, "version_finish", {
              collector_number: collNum,
              is_foil: finishType === "foil"
            });
          }}
          className="table-input finish-select"
        >
          {finishOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
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

// Memoized Visual Card Art Tile Component
const CollectionCardTile = React.memo(({
  card,
  cachedPrints,
  onFieldChange,
  onDelete
}) => {
  const isUnresolved = cachedPrints && cachedPrints !== "loading" && (cachedPrints.missing === true || !cachedPrints.prints || cachedPrints.prints.length === 0);
  const printsLoaded = cachedPrints && cachedPrints !== "loading" && !isUnresolved;

  const setPrints = printsLoaded && cachedPrints.prints ? (
    cachedPrints.prints.filter(p => p.set?.toUpperCase() === (card.set_code || "").toUpperCase())
  ) : [];

  const activePrint = setPrints.length > 0 ? (
    setPrints.find(p => card.collector_number ? p.collector_number === card.collector_number : true) || setPrints[0]
  ) : (printsLoaded && cachedPrints.prints ? cachedPrints.prints[0] : null);

  const uniqueSets = getUniqueSetsFromPrints(cachedPrints?.prints);
  const finishOptions = getFinishVersionOptions(cachedPrints, card.set_code);
  const currentSelectedFinishKey = `${activePrint?.collector_number || card.collector_number || ""}:${card.is_foil ? "foil" : "normal"}`;

  // Image URI lookup
  let imageUrl = null;
  if (activePrint) {
    imageUrl = activePrint.image_uris?.normal || activePrint.image_uris?.small || activePrint.card_faces?.[0]?.image_uris?.normal;
  } else if (cachedPrints?.image_uris?.normal) {
    imageUrl = cachedPrints.image_uris.normal;
  }

  // Price calculation
  let rowPrice = 0;
  if (activePrint && activePrint.prices) {
    const basePriceStr = card.is_foil ? activePrint.prices.usd_foil : activePrint.prices.usd;
    const basePrice = parseFloat(basePriceStr) || 0;
    const mult = CONDITION_MULTIPLIERS[card.card_condition || "NM"] || 1.0;
    rowPrice = basePrice * mult;
  }
  const rowTotal = rowPrice * card.quantity;

  return (
    <div className={`card-tile ${isUnresolved ? "tile-unresolved" : ""} ${!!card.is_foil ? "tile-foil" : ""}`}>
      {/* Visual Card Image */}
      <div className="tile-art-wrapper">
        {imageUrl ? (
          <img src={imageUrl} alt={card.card_name} className="tile-art-img" loading="lazy" />
        ) : (
          <div className="tile-art-placeholder">
            <span className="placeholder-icon"><RectangleGroupIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /></span>
            <span className="placeholder-name">{card.card_name}</span>
            {isUnresolved && <span className="unresolved-badge"><ExclamationTriangleIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />️ Token / Unresolved</span>}
          </div>
        )}
        
        {!!card.is_foil && <div className="tile-foil-badge"><SparklesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> FOIL</div>}
        {!!card.is_proxy && <div className="tile-proxy-badge" style={{ position: 'absolute', top: '8px', left: '8px', background: '#ff9800', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', zIndex: 2 }}>PROXY</div>}
        
        <div className="tile-price-tag">
          {rowPrice > 0 ? `$${rowPrice.toFixed(2)}` : "Price N/A"}
        </div>
      </div>

      {/* Tile Content & Fields */}
      <div className="tile-content">
        <div className="tile-header">
          <span className="tile-title" title={card.card_name}>{card.card_name}</span>
          <button className="tile-delete-btn" onClick={() => onDelete(card)} title="Remove card"></button>
        </div>

        {isUnresolved && (
          <div className="tile-unresolved-alert"><ExclamationTriangleIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />️ Unresolved / Token</div>
        )}

        <div className="tile-controls-grid">
          {/* Quantity */}
          <div className="tile-control-group qty">
            <label>Qty:</label>
            <input
              type="number"
              min="1"
              value={card.quantity}
              onChange={(e) => onFieldChange(card, "quantity", e.target.value)}
              className="table-input qty"
            />
          </div>

          {/* Set Printing (Deduplicated Unique Sets) */}
          <div className="tile-control-group set">
            <label>Set:</label>
            {isUnresolved ? (
              <input
                type="text"
                value={card.set_code || ""}
                onChange={(e) => onFieldChange(card, "set_code", e.target.value)}
                placeholder="Set Code"
                className="table-input set-input"
              />
            ) : printsLoaded && uniqueSets.length > 0 ? (
              <select
                value={card.set_code ? card.set_code.toUpperCase() : ""}
                onChange={(e) => onFieldChange(card, "set_code", e.target.value)}
                className="table-input set-select"
              >
                {uniqueSets.map((s) => (
                  <option key={s.set_code} value={s.set_code}>
                    {s.set_code} - {s.set_name}
                  </option>
                ))}
              </select>
            ) : (
              <select disabled className="table-input set-select">
                <option>{card.set_code ? card.set_code.toUpperCase() : "Loading..."}</option>
              </select>
            )}
          </div>

          {/* Finish / Version Dropdown (Updates Art Image & Version in Real Time!) */}
          <div className="tile-control-group finish">
            <label>Version / Finish:</label>
            <select
              value={currentSelectedFinishKey}
              onChange={(e) => {
                const [collNum, finishType] = e.target.value.split(":");
                onFieldChange(card, "version_finish", {
                  collector_number: collNum,
                  is_foil: finishType === "foil"
                });
              }}
              className="table-input finish-select"
            >
              {finishOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div className="tile-control-group condition">
            <label>Cond:</label>
            <select
              value={card.card_condition || "NM"}
              onChange={(e) => onFieldChange(card, "card_condition", e.target.value)}
              className="table-input condition-select"
            >
              {CONDITIONS.map((cond) => (
                <option key={cond.code} value={cond.code}>{cond.code}</option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div className="tile-control-group language">
            <label>Lang:</label>
            <select
              value={card.card_language || "EN"}
              onChange={(e) => onFieldChange(card, "card_language", e.target.value)}
              className="table-input language-select"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.code}</option>
              ))}
            </select>
          </div>
        </div>

        {rowTotal > 0 && (
          <div className="tile-total-row">
            Total ({card.quantity}): <strong>${rowTotal.toFixed(2)}</strong>
          </div>
        )}
      </div>
    </div>
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

  const [globalStats, setGlobalStats] = useState({
    totalCollectionValue: 0,
    totalItems: 0,
    uniqueCardsCount: 0,
    totalFilteredCount: 0,
    unresolvedCount: 0
  });

  const [activeTab, setActiveTab] = useState("owned"); // "owned", "proxy", "deck"
  const [importDestination, setImportDestination] = useState("auto");
  const [proxyRuleAltered, setProxyRuleAltered] = useState(false);
  const [proxyRuleMisprint, setProxyRuleMisprint] = useState(false);
  const [proxyRulePoor, setProxyRulePoor] = useState(false);
  const [proxyRuleHP, setProxyRuleHP] = useState(false);
  const [proxyRuleMatchAll, setProxyRuleMatchAll] = useState(false);
  
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

  // Pagination & View Mode State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState("auto");

  const loadCollection = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const params = new URLSearchParams({
        list_type: activeTab,
        page: currentPage,
        limit: pageSize,
        sortField,
        sortOrder,
        filterName,
        filterSet,
        filterCondition,
        filterLanguage,
        filterFinish
      });

      const res = await fetch(`/api/collection/owned?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const cardsList = data.cards || [];
        setCollection(cardsList);
        setGlobalStats(data.stats || {
          totalCollectionValue: 0,
          totalItems: 0,
          uniqueCardsCount: 0,
          totalFilteredCount: 0,
          unresolvedCount: 0
        });
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

  const prevTabRef = useRef(activeTab);
  const debounceRef = useRef(null);

  // Load collection when parameters change
  useEffect(() => {
    const isTabChange = prevTabRef.current !== activeTab;
    if (isTabChange) {
      setCollection([]);
      setCurrentPage(1);
      prevTabRef.current = activeTab;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadCollection();
    }, 200);

    return () => clearTimeout(debounceRef.current);
  }, [activeTab, currentPage, pageSize, sortField, sortOrder, filterName, filterSet, filterCondition, filterLanguage, filterFinish]);

  // Prevent background scrolling when import modal is open
  useEffect(() => {
    if (showImport) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showImport]);

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
            next[name] = { missing: true, prints: [] };
          }
        });
        return next;
      });
    } catch (err) {
      console.error("[OwnedCollection] Failed to fetch prints batch", err);
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
        card_language: "EN",
        list_type: activeTab,
        is_proxy: activeTab === "proxy"
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
  const handleFieldChange = useCallback(async (card, field, val) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      let newCollectorNumber = card.collector_number;
      let newIsFoil = !!card.is_foil;
      let newSetCode = card.set_code;
      let newQuantity = card.quantity;
      let newCondition = card.card_condition || "NM";
      let newLanguage = card.card_language || "EN";

      if (field === "version_finish") {
        newCollectorNumber = val.collector_number;
        newIsFoil = !!val.is_foil;
      } else if (field === "quantity") {
        newQuantity = parseInt(val) || 0;
      } else if (field === "set_code") {
        newSetCode = (val || "").toUpperCase();
        // Reset collector_number to first print in new set
        if (printsCache[card.card_name] && printsCache[card.card_name].prints) {
          const newSetPrints = printsCache[card.card_name].prints.filter(p => p.set?.toUpperCase() === newSetCode);
          if (newSetPrints.length > 0) {
            newCollectorNumber = newSetPrints[0].collector_number || "";
          }
        }
      } else if (field === "collector_number") {
        newCollectorNumber = val;
      } else if (field === "is_foil") {
        newIsFoil = !!val;
      } else if (field === "card_condition") {
        newCondition = val;
      } else if (field === "card_language") {
        newLanguage = val;
      }

      const payload = {
        id: card.id,
        card_name: card.card_name,
        quantity: newQuantity,
        set_code: newSetCode,
        collector_number: newCollectorNumber,
        is_foil: newIsFoil,
        card_condition: newCondition,
        card_language: newLanguage
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
        body: JSON.stringify({ id: card.id, list_type: activeTab }),
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

    if (!window.confirm(`️ Are you sure you want to delete all ${unresolvedCards.length} unresolved token/malformed cards?`)) return;

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
          body: JSON.stringify({ id: card.id, list_type: activeTab }),
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
    const isProxyTab = activeTab === "proxy";

    const confirmMsg = isProxyTab
      ? "🗑️ Are you sure you want to clear your Proxy list?\n\nThis will also disable all deck-imported cards (from your Archidekt syncs). Your decks will remain saved — just resync them to re-add their cards."
      : "️ Are you sure you want to clear your ENTIRE collection across ALL tabs (Owned, Proxies, Decks)? This cannot be undone.";

    if (!window.confirm(confirmMsg)) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/collection/owned", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clear_all: true, list_type: activeTab }),
      });

      if (res.ok) {
        loadCollection();
        const successMsg = isProxyTab
          ? "Proxy list cleared. Your synced decks have been disabled — go to the Decks tab and resync to re-add their cards."
          : "Collection cleared successfully!";
        alert(successMsg);
      }
    } catch (e) {
      console.error("Failed to clear collection:", e);
    }
  };

  // Price helper for single card
  const getRowPrice = useCallback((card) => {
    if (card.is_proxy) return 0;
    
    const cached = printsCache[card.card_name];
    if (!cached || cached === "loading" || cached.missing || !cached.prints || cached.prints.length === 0) return 0;

    const setPrints = cached.prints.filter(p => p.set?.toUpperCase() === (card.set_code || "").toUpperCase());
    const activePrint = setPrints.length > 0 ? (
      setPrints.find(p => card.collector_number ? p.collector_number === card.collector_number : true) || setPrints[0]
    ) : cached.prints[0];

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

      const processedCards = parsedCards
        .filter(c => c.binder_type !== "list")
        .map(c => {
        const rulesActive = proxyRuleAltered || proxyRuleMisprint || proxyRulePoor || proxyRuleHP;
        let isProxy = false;
        
        if (rulesActive) {
          const activeRules = [];
          if (proxyRuleAltered) activeRules.push('altered');
          if (proxyRuleMisprint) activeRules.push('misprint');
          if (proxyRulePoor) activeRules.push('poor');
          if (proxyRuleHP) activeRules.push('hp');

          const checkRule = (rule) => {
            if (rule === 'altered') return !!c.altered;
            if (rule === 'misprint') return !!c.misprint;
            if (rule === 'poor') return c.card_condition === "PO";
            if (rule === 'hp') return c.card_condition === "HP";
            return false;
          };

          if (proxyRuleMatchAll) {
            isProxy = activeRules.every(checkRule);
          } else {
            isProxy = activeRules.some(checkRule);
          }
        }

        if (importDestination !== "auto") {
          return { ...c, list_type: importDestination, is_proxy: importDestination === "proxy" ? true : isProxy };
        }
        
        if (c.binder_type === "deck") {
          return { ...c, list_type: "deck", is_proxy: isProxy };
        }
        
        return { ...c, list_type: isProxy ? "proxy" : "owned", is_proxy: isProxy };
      });

      const CHUNK_SIZE = 500;
      let totalAdded = 0;

      for (let i = 0; i < processedCards.length; i += CHUNK_SIZE) {
        const chunk = processedCards.slice(i, i + CHUNK_SIZE);
        const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
        const totalBatches = Math.ceil(processedCards.length / CHUNK_SIZE);

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
      alert(` Successfully imported ${totalAdded} cards into your collection!`);
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

  // Pagination calculation
  const { totalFilteredCount, totalItems, uniqueCardsCount, totalCollectionValue, unresolvedCount } = globalStats;
  const totalPages = Math.ceil(totalFilteredCount / pageSize) || 1;
  const displayedList = collection;

  // Determine whether to show Visual Card Art Grid mode or Spreadsheet Table mode
  const isCardArtView = viewMode === "grid" || (viewMode === "auto" && typeof pageSize === "number" && pageSize <= 20);

  const getSortIndicator = (field) => {
    if (sortField !== field) return "";
    return sortOrder === "asc" ? " " : " ";
  };

  return (
    <div className="collection-page-container">
      {/* Header Area */}
      <div className="collection-header">
        <div>
          <h1 className="collection-title"><ArchiveBoxIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />️ Card Inventory Manager</h1>
          <p className="collection-subtitle">Cardsphere-style tracking of condition, language, sets, and real-time market value.</p>
        </div>
        
        <div className="collection-actions">
          <button className="csv-btn export" onClick={handleExportCSV} disabled={collection.length === 0}>
            <InboxIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Export CSV
          </button>
          <button className="csv-btn import" onClick={() => setShowImport(!showImport)}>
            <ArrowUpTrayIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Bulk Import
          </button>
          <button className="csv-btn delete-all-btn" onClick={handleClearCollection} disabled={collection.length === 0}>
            <TrashIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />️ Clear Collection
          </button>
        </div>
      </div>

      {/* Collection Tabs */}
      <div className="collection-tabs" style={{ display: 'flex', gap: '1rem', padding: '1rem 2rem', borderBottom: '1px solid #333', background: '#111' }}>
        <button 
          className={`tab-btn ${activeTab === 'owned' ? 'active' : ''}`}
          onClick={() => setActiveTab('owned')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'owned' ? '#4CAF50' : '#222', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Collection
        </button>
        <button 
          className={`tab-btn ${activeTab === 'proxy' ? 'active' : ''}`}
          onClick={() => setActiveTab('proxy')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'proxy' ? '#4CAF50' : '#222', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Extra Proxies
        </button>
        <button 
          className={`tab-btn ${activeTab === 'deck' ? 'active' : ''}`}
          onClick={() => setActiveTab('deck')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'deck' ? '#4CAF50' : '#222', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          In decks
        </button>
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
      {unresolvedCount > 0 && (
        <div className="unresolved-warning-banner">
          <div className="banner-left">
            <span className="banner-icon"><ExclamationTriangleIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />️</span>
            <div>
              <strong>{unresolvedCount} unresolved token/malformed cards found in your collection</strong>
              <p>These items could not be matched to official Scryfall prints. They are floating at the top of your list.</p>
            </div>
          </div>
          <button className="delete-unresolved-btn" onClick={handleDeleteAllUnresolved}>
            <TrashIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />️ Delete All {unresolvedCount} Unresolved Cards
          </button>
        </div>
      )}

      {showImport && (
        <div className="bulk-import-panel">
          <h3><ArrowUpTrayIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Bulk Collection Importer</h3>
          <p className="import-help">
            Supports <strong>ManaBox CSV files</strong> (e.g., <code>Giga Boxes.csv</code>), Scryfall/Cardsphere CSVs, or standard decklists (<code>4 Hallowed Fountain</code>).
          </p>
          
          <div className="import-file-section">
            <label htmlFor="csv-file-input" className="file-upload-btn">
              <FolderIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Choose CSV or Text File
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

          <div className="import-settings" style={{ margin: '1rem 0', padding: '1rem', background: '#222', borderRadius: '8px' }}>
            <h4>Import Settings</h4>
            <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
              <label style={{ marginRight: '1rem' }}>Destination:</label>
              <select value={importDestination} onChange={e => setImportDestination(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #444' }}>
                <option value="auto">Auto-sort</option>
                <option value="owned">Collection</option>
                <option value="proxy">Extra Proxies</option>
                <option value="deck">In decks</option>
              </select>
            </div>
            
            {importDestination === 'auto' && (
              <div>
                <label>
                  <strong>Proxy Rules:</strong> Mark as proxy if 
                  <select 
                    className="proxy-match-select" 
                    value={proxyRuleMatchAll ? "all" : "any"} 
                    onChange={e => setProxyRuleMatchAll(e.target.value === "all")}
                  >
                    <option value="any">ANY</option>
                    <option value="all">ALL</option>
                  </select> 
                  match:
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <div className={`proxy-rule-pill ${proxyRuleAltered ? 'active' : ''}`} onClick={() => setProxyRuleAltered(!proxyRuleAltered)}>
                    Altered
                  </div>
                  <div className={`proxy-rule-pill ${proxyRuleMisprint ? 'active' : ''}`} onClick={() => setProxyRuleMisprint(!proxyRuleMisprint)}>
                    Misprint
                  </div>
                  <div className={`proxy-rule-pill ${proxyRulePoor ? 'active' : ''}`} onClick={() => setProxyRulePoor(!proxyRulePoor)}>
                    Condition: Poor (PO)
                  </div>
                  <div className={`proxy-rule-pill ${proxyRuleHP ? 'active' : ''}`} onClick={() => setProxyRuleHP(!proxyRuleHP)}>
                    Condition: Heavily Played (HP)
                  </div>
                </div>
              </div>
            )}
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
          <span className="search-icon"><MagnifyingGlassIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /></span>
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

      {/* Top Pagination & View Controls Bar */}
      {totalFilteredCount > 0 && (
        <div className="pagination-bar">
          <div className="pagination-info">
            Showing <strong>{totalFilteredCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalFilteredCount)}</strong> of <strong>{totalFilteredCount}</strong> cards
          </div>
          
          <div className="pagination-controls">
            {/* View Mode Switcher */}
            <div className="view-mode-toggle">
              <button
                className={`view-toggle-btn ${isCardArtView ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Switch to Card Art Grid View (ideal for confirming visual artwork)"
              >
                <PhotoIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />️ Card Art
              </button>
              <button
                className={`view-toggle-btn ${!isCardArtView ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Switch to Spreadsheet Table View"
              >
                <ChartBarIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Table
              </button>
            </div>

            {/* Per Page Selector */}
            <label className="page-size-label">
              Per page:
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="page-size-select"
              >
                <option value={10}>10 (Visual Art)</option>
                <option value={20}>20 (Visual Art)</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>

            {totalPages > 1 && (
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

      {/* Main Content Area: Visual Card Art Grid OR Spreadsheet Table */}
      {loading && collection.length === 0 ? (
        <div className="table-loading">Loading inventory...</div>
      ) : collection.length === 0 ? (
        <div className="table-empty">
          Your collection is empty. Search above or bulk import to get started!
        </div>
      ) : globalStats.totalFilteredCount === 0 ? (
        <div className="table-empty">
          No cards match the active filters.
        </div>
      ) : isCardArtView ? (
        /* Visual Card Art Grid View */
        <div className="card-art-grid">
          {displayedList.map((card) => (
            <CollectionCardTile
              key={card.id}
              card={card}
              cachedPrints={printsCache[card.card_name]}
              onFieldChange={handleFieldChange}
              onDelete={deleteCard}
            />
          ))}
        </div>
      ) : (
        /* Spreadsheet Table View */
        <div className="csv-table-wrapper">
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
                <th className="col-foil">Version / Finish</th>
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
        </div>
      )}

      {/* Bottom Pagination Controls */}
      {totalFilteredCount > 0 && totalPages > 1 && (
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
