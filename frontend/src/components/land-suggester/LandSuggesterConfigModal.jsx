import React, { useState, useEffect, useMemo } from "react";
import {
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  NoSymbolIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckIcon,
  SparklesIcon,
  BoltIcon
} from "@heroicons/react/24/solid";
import {
  BUDGET_TIERS,
  LAND_CYCLE_CATEGORIES,
  LAND_CYCLES_CATALOG
} from "../../data/landCyclesConfig";

export default function LandSuggesterConfigModal({
  isOpen,
  onClose,
  initialPreferences,
  onSavePreferences,
  isSaving
}) {
  const [activeTab, setActiveTab] = useState("budget"); // "budget" | "cycles"
  const [budgetTier, setBudgetTier] = useState(initialPreferences?.budgetTier || "all");
  const [maxPricePerLand, setMaxPricePerLand] = useState(
    initialPreferences?.maxPricePerLand !== null && initialPreferences?.maxPricePerLand !== undefined
      ? initialPreferences.maxPricePerLand
      : ""
  );
  const [excludeReservedList, setExcludeReservedList] = useState(
    initialPreferences?.excludeReservedList !== undefined ? initialPreferences.excludeReservedList : true
  );
  const [excludeTapped, setExcludeTapped] = useState(
    initialPreferences?.excludeTapped !== undefined ? initialPreferences.excludeTapped : true
  );

  const [likedCycles, setLikedCycles] = useState(
    new Set((initialPreferences?.likedCycles || []).map(c => c.toLowerCase()))
  );
  const [dislikedCycles, setDislikedCycles] = useState(
    new Set((initialPreferences?.dislikedCycles || []).map(c => c.toLowerCase()))
  );

  const [cycleCategoryFilter, setCycleCategoryFilter] = useState("all");
  const [cycleSearchQuery, setCycleSearchQuery] = useState("");

  // Sync state whenever modal opens or initialPreferences update
  useEffect(() => {
    if (isOpen) {
      console.log("[LandSuggesterConfigModal] Modal opened with initial preferences:", initialPreferences);
      const incomingLiked = (initialPreferences?.likedCycles || []).map(c => c.toLowerCase());
      const incomingDisliked = (initialPreferences?.dislikedCycles || []).map(c => c.toLowerCase());

      console.log("[LandSuggesterConfigModal] Synced cycle sets:", {
        likedCount: incomingLiked.length,
        likedCycles: incomingLiked,
        dislikedCount: incomingDisliked.length,
        dislikedCycles: incomingDisliked,
        budgetTier: initialPreferences?.budgetTier || "all",
        maxPricePerLand: initialPreferences?.maxPricePerLand,
        excludeReservedList: initialPreferences?.excludeReservedList,
        excludeTapped: initialPreferences?.excludeTapped
      });

      setBudgetTier(initialPreferences?.budgetTier || "all");
      setMaxPricePerLand(
        initialPreferences?.maxPricePerLand !== null && initialPreferences?.maxPricePerLand !== undefined
          ? initialPreferences.maxPricePerLand
          : ""
      );
      setExcludeReservedList(
        initialPreferences?.excludeReservedList !== undefined ? initialPreferences.excludeReservedList : true
      );
      setExcludeTapped(
        initialPreferences?.excludeTapped !== undefined ? initialPreferences.excludeTapped : true
      );
      setLikedCycles(new Set(incomingLiked));
      setDislikedCycles(new Set(incomingDisliked));
    }
  }, [isOpen, initialPreferences]);

  // Filter cycles list
  const filteredCycles = useMemo(() => {
    const result = LAND_CYCLES_CATALOG.filter(cycle => {
      if (cycleCategoryFilter !== "all" && cycle.category !== cycleCategoryFilter) {
        return false;
      }
      if (!cycleSearchQuery.trim()) return true;

      const q = cycleSearchQuery.toLowerCase();
      const matchName = cycle.name.toLowerCase().includes(q);
      const matchCards = cycle.sampleCards.some(card => card.toLowerCase().includes(q));
      return matchName || matchCards;
    });
    return result;
  }, [cycleCategoryFilter, cycleSearchQuery]);

  // Toggle cycle preference between Liked, Disliked, and Neutral
  const setCycleState = (cycleId, targetState) => {
    const key = cycleId.toLowerCase();
    const newLiked = new Set(likedCycles);
    const newDisliked = new Set(dislikedCycles);
    const prevState = newLiked.has(key) ? "liked" : newDisliked.has(key) ? "disliked" : "neutral";

    if (targetState === "liked") {
      newDisliked.delete(key);
      newLiked.has(key) ? newLiked.delete(key) : newLiked.add(key);
    } else if (targetState === "disliked") {
      newLiked.delete(key);
      newDisliked.has(key) ? newDisliked.delete(key) : newDisliked.add(key);
    } else {
      // Neutral
      newLiked.delete(key);
      newDisliked.delete(key);
    }

    const nextState = newLiked.has(key) ? "liked" : newDisliked.has(key) ? "disliked" : "neutral";
    console.log(`[LandSuggesterConfigModal] Changed cycle state for '${cycleId}':`, {
      cycleId,
      previousState: prevState,
      nextState,
      totalLiked: newLiked.size,
      totalDisliked: newDisliked.size,
      likedCycles: Array.from(newLiked),
      dislikedCycles: Array.from(newDisliked)
    });

    setLikedCycles(newLiked);
    setDislikedCycles(newDisliked);
  };

  // Batch cycle quick actions
  const handleBatchAction = (action) => {
    console.log(`[LandSuggesterConfigModal] Running batch preset action: '${action}'`);
    if (action === "like_fast") {
      const newLiked = new Set(likedCycles);
      const newDisliked = new Set(dislikedCycles);
      const affected = [];
      LAND_CYCLES_CATALOG.filter(c => c.category === "fast_duals" && c.id !== "cycle-abu-dual-land").forEach(c => {
        const key = c.id.toLowerCase();
        newLiked.add(key);
        newDisliked.delete(key);
        affected.push(key);
      });
      console.log(`[LandSuggesterConfigModal] 'like_fast' applied to ${affected.length} cycles:`, affected);
      setLikedCycles(newLiked);
      setDislikedCycles(newDisliked);
    } else if (action === "dislike_tapped") {
      const newLiked = new Set(likedCycles);
      const newDisliked = new Set(dislikedCycles);
      const affected = [];
      LAND_CYCLES_CATALOG.filter(c => c.tier === "bottom" || c.speed === "tapped").forEach(c => {
        const key = c.id.toLowerCase();
        newDisliked.add(key);
        newLiked.delete(key);
        affected.push(key);
      });
      console.log(`[LandSuggesterConfigModal] 'dislike_tapped' applied to ${affected.length} cycles:`, affected);
      setLikedCycles(newLiked);
      setDislikedCycles(newDisliked);
    } else if (action === "reset_cycles") {
      console.log("[LandSuggesterConfigModal] 'reset_cycles' cleared all liked and disliked sets");
      setLikedCycles(new Set());
      setDislikedCycles(new Set());
    }
  };

  const handleSave = () => {
    const preferences = {
      budgetTier,
      maxPricePerLand: maxPricePerLand !== "" && !isNaN(Number(maxPricePerLand)) ? Number(maxPricePerLand) : null,
      excludeReservedList,
      excludeTapped,
      likedCycles: Array.from(likedCycles),
      dislikedCycles: Array.from(dislikedCycles)
    };
    console.log("[LandSuggesterConfigModal] Save triggered with preferences payload:", {
      budgetTier: preferences.budgetTier,
      maxPricePerLand: preferences.maxPricePerLand,
      excludeReservedList: preferences.excludeReservedList,
      excludeTapped: preferences.excludeTapped,
      likedCount: preferences.likedCycles.length,
      likedCycles: preferences.likedCycles,
      dislikedCount: preferences.dislikedCycles.length,
      dislikedCycles: preferences.dislikedCycles
    });
    onSavePreferences(preferences);
  };

  const handleResetDefaults = () => {
    console.log("[LandSuggesterConfigModal] Reset to defaults triggered");
    setBudgetTier("budget");
    setMaxPricePerLand("");
    setExcludeReservedList(true);
    setExcludeTapped(true);
    setLikedCycles(new Set());
    setDislikedCycles(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content land-config-modal" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <header className="land-config-header">
          <div className="land-config-title-group">
            <span className="radar-tag">
              <AdjustmentsHorizontalIcon className="icon-sm" /> Land Base Setup
            </span>
            <h2>Land Suggester & Budget Configuration</h2>
            <p className="modal-subtext">
              Fine-tune which lands you want recommended and cut across your Commander decks.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <XMarkIcon className="icon-sm" />
          </button>
        </header>

        {/* Modal Navigation Tabs */}
        <div className="land-config-tabs">
          <button
            className={`config-nav-tab ${activeTab === "budget" ? "active" : ""}`}
            onClick={() => setActiveTab("budget")}
          >
            <CurrencyDollarIcon className="icon-sm" />
            <span>Budget & Safeguards</span>
          </button>
          <button
            className={`config-nav-tab ${activeTab === "cycles" ? "active" : ""}`}
            onClick={() => setActiveTab("cycles")}
          >
            <SparklesIcon className="icon-sm" />
            <span>Liked & Disliked Cycles</span>
            {(likedCycles.size > 0 || dislikedCycles.size > 0) && (
              <span className="config-counter-pill">
                +{likedCycles.size} / -{dislikedCycles.size}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="land-config-body">
          {activeTab === "budget" && (
            <div className="budget-config-section fade-in">
              <div className="section-block">
                <label className="section-heading-label">
                  <CurrencyDollarIcon className="icon-xs text-amber" /> Select Target Budget Tier
                </label>
                <div className="budget-tiers-grid">
                  {BUDGET_TIERS.map(tier => {
                    const isSelected = budgetTier === tier.id;
                    return (
                      <div
                        key={tier.id}
                        className={`budget-tier-card ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          setBudgetTier(tier.id);
                          if (tier.maxPrice !== null) {
                            setMaxPricePerLand(tier.maxPrice);
                          } else {
                            setMaxPricePerLand("");
                          }
                        }}
                      >
                        <div className="budget-tier-top">
                          <span className="tier-name">{tier.label}</span>
                          {isSelected && <CheckIcon className="icon-xs text-cyan" />}
                        </div>
                        <p className="tier-desc">{tier.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="section-block custom-price-block">
                <div className="custom-price-inputs">
                  <div>
                    <label className="input-label" htmlFor="custom-max-price">
                      Custom Maximum Price Per Land (USD)
                    </label>
                    <p className="input-subtext">Optional hard ceiling for any suggested addition</p>
                  </div>
                  <div className="price-input-wrap">
                    <span className="price-currency-symbol">$</span>
                    <input
                      id="custom-max-price"
                      type="number"
                      step="0.50"
                      min="0"
                      placeholder="e.g. 5.00"
                      value={maxPricePerLand}
                      onChange={e => {
                        setMaxPricePerLand(e.target.value);
                        setBudgetTier("custom");
                      }}
                      className="custom-price-field"
                    />
                  </div>
                </div>
              </div>

              <div className="section-block safeguard-toggles-block">
                <label className="section-heading-label">
                  <ShieldCheckIcon className="icon-xs text-emerald" /> Safeguards & Filtering
                </label>

                <div className="safeguard-toggle-row">
                  <div className="safeguard-info">
                    <strong>Exclude Reserved List Lands ($500+ ABU Duals)</strong>
                    <p>Prevents suggesting original Alpha/Beta/Unlimited duals like Underground Sea, Badlands, and Taiga unless explicitly enabled.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={excludeReservedList}
                      onChange={e => setExcludeReservedList(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="safeguard-toggle-row">
                  <div className="safeguard-info">
                    <strong>Exclude Generic Tapped Lands & Suggest Cutting Them</strong>
                    <p>Automatically flags slow taplands, gainlands, and guildgates for removal while prioritizing untapped alternatives.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={excludeTapped}
                      onChange={e => setExcludeTapped(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "cycles" && (
            <div className="cycles-config-section fade-in">
              {/* Category Filter Pills & Search */}
              <div className="cycles-toolbar">
                <div className="category-pills">
                  <button
                    className={`cat-pill ${cycleCategoryFilter === "all" ? "active" : ""}`}
                    onClick={() => setCycleCategoryFilter("all")}
                  >
                    All Cycles
                  </button>
                  <button
                    className={`cat-pill ${cycleCategoryFilter === "fast_duals" ? "active" : ""}`}
                    onClick={() => setCycleCategoryFilter("fast_duals")}
                  >
                    Fast & Untapped
                  </button>
                  <button
                    className={`cat-pill ${cycleCategoryFilter === "utility_fixing" ? "active" : ""}`}
                    onClick={() => setCycleCategoryFilter("utility_fixing")}
                  >
                    Utility & Fixing
                  </button>
                  <button
                    className={`cat-pill ${cycleCategoryFilter === "budget_tempo" ? "active" : ""}`}
                    onClick={() => setCycleCategoryFilter("budget_tempo")}
                  >
                    Budget & Tapped
                  </button>
                </div>

                <div className="cycle-search-wrap">
                  <MagnifyingGlassIcon className="icon-xs text-muted" />
                  <input
                    type="text"
                    placeholder="Filter land cycles (e.g. shock, fetch, pain)..."
                    value={cycleSearchQuery}
                    onChange={e => setCycleSearchQuery(e.target.value)}
                    className="cycle-search-input"
                  />
                  {cycleSearchQuery && (
                    <button onClick={() => setCycleSearchQuery("")} className="search-clear-mini">
                      <XMarkIcon className="icon-xs" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Batch Action Buttons */}
              <div className="batch-actions-strip">
                <span className="batch-label">Quick Presets:</span>
                <button
                  className="btn-batch"
                  onClick={() => handleBatchAction("like_fast")}
                  title="Favorite all fast untapped dual cycles"
                >
                  <BoltIcon className="icon-xs text-amber" /> Like All Fast Duals
                </button>
                <button
                  className="btn-batch"
                  onClick={() => handleBatchAction("dislike_tapped")}
                  title="Dislike all low tempo tapped cycles"
                >
                  <NoSymbolIcon className="icon-xs text-rose" /> Dislike All Tapped
                </button>
                <button
                  className="btn-batch neutral"
                  onClick={() => handleBatchAction("reset_cycles")}
                  title="Reset all cycle preferences to neutral"
                >
                  <ArrowPathIcon className="icon-xs" /> Clear Custom Cycles
                </button>
              </div>

              {/* Cycles List */}
              <div className="cycles-grid">
                {filteredCycles.map(cycle => {
                  const key = cycle.id.toLowerCase();
                  const isLiked = likedCycles.has(key);
                  const isDisliked = dislikedCycles.has(key);

                  return (
                    <div
                      key={cycle.id}
                      className={`cycle-preference-card ${isLiked ? "liked" : ""} ${isDisliked ? "disliked" : ""}`}
                    >
                      <div className="cycle-card-header">
                        <div>
                          <div className="cycle-title-row">
                            <h4 className="cycle-name">{cycle.name}</h4>
                            <span className={`speed-badge ${cycle.speed}`}>
                              {cycle.speed === "untapped" ? "Untapped" : cycle.speed === "conditional" ? "Conditional" : "Tapped"}
                            </span>
                          </div>
                          <span className="cycle-price-estimate">{cycle.typicalPrice}</span>
                        </div>

                        {/* 3-State Action Selector */}
                        <div className="cycle-state-toggle">
                          <button
                            className={`state-btn like-btn ${isLiked ? "active" : ""}`}
                            onClick={() => setCycleState(cycle.id, "liked")}
                            title="Favorite: prioritize in additions & protect from cuts"
                          >
                            <HeartIcon className="icon-xs" />
                            <span>Like</span>
                          </button>
                          <button
                            className={`state-btn dislike-btn ${isDisliked ? "active" : ""}`}
                            onClick={() => setCycleState(cycle.id, "disliked")}
                            title="Dislike: exclude from additions & prioritize for cuts"
                          >
                            <NoSymbolIcon className="icon-xs" />
                            <span>Dislike</span>
                          </button>
                        </div>
                      </div>

                      {/* Sample cards in this cycle */}
                      <div className="cycle-samples-wrap">
                        <span className="sample-label">Examples:</span>
                        <div className="sample-chips">
                          {cycle.sampleCards.slice(0, 4).map((cName, idx) => (
                            <span key={idx} className="sample-chip">
                              {cName}
                            </span>
                          ))}
                          {cycle.sampleCards.length > 4 && (
                            <span className="sample-chip more">
                              +{cycle.sampleCards.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="land-config-footer">
          <button className="btn-ghost" onClick={handleResetDefaults}>
            <ArrowPathIcon className="icon-xs" /> Reset to Defaults
          </button>
          <div className="footer-right-actions">
            <button className="btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="spinner-mini"></div>
                  <span>Saving & Re-analyzing...</span>
                </>
              ) : (
                <>
                  <CheckIcon className="icon-sm" />
                  <span>Save Preferences & Re-Analyze</span>
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
