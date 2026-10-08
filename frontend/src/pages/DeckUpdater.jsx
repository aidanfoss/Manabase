import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  SparklesIcon,
  ExclamationTriangleIcon,
  FireIcon,
  CheckCircleIcon,
  XMarkIcon,
  BookmarkIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ChevronRightIcon,
  Squares2X2Icon
} from "@heroicons/react/24/solid";
import CardMagnifier from "../components/CardMagnifier";
import LandPreferencesBar from "../components/land-suggester/LandPreferencesBar";
import LandSuggesterConfigModal from "../components/land-suggester/LandSuggesterConfigModal";
import { useToast } from "../context/ToastContext";
import "./DeckUpdater.css";

export default function DeckUpdater() {
  const [deckAnalyses, setDeckAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter & Navigation states
  const [selectedDeckId, setSelectedDeckId] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "upgrades" | "lands" | "new" | "synergy"
  const [searchQuery, setSearchQuery] = useState("");

  // Land Preferences & Configuration states
  const [landPreferences, setLandPreferences] = useState({
    budgetTier: "budget",
    maxPricePerLand: null,
    excludeReservedList: true,
    excludeTapped: true,
    likedCycles: [],
    dislikedCycles: []
  });
  const [isLandConfigOpen, setIsLandConfigOpen] = useState(false);
  const [isSavingLandPrefs, setIsSavingLandPrefs] = useState(false);

  // Dismissals & Undo states
  const [showOptions, setShowOptions] = useState(false);
  const [dismissals, setDismissals] = useState([]);
  const [dismissalSearch, setDismissalSearch] = useState("");
  const [undoAction, setUndoAction] = useState(null);
  const undoTimerRef = useRef(null);

  const { showToast } = useToast();

  useEffect(() => {
    console.log("[DeckUpdater] Initializing DeckUpdater page - loading land preferences and deck analyses");
    fetchLandPreferences();
    fetchAllDecksAnalysis();
  }, []);

  const fetchLandPreferences = async () => {
    const token = localStorage.getItem("token");
    console.log("[DeckUpdater:LandPreferences] Fetching land preferences from backend. Token present:", !!token);
    if (!token) {
      console.warn("[DeckUpdater:LandPreferences] Cannot fetch land preferences - no auth token found in localStorage");
      return;
    }
    const startTime = performance.now();
    try {
      const res = await fetch("/api/deck-updater/land-preferences", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[DeckUpdater:LandPreferences] GET /api/deck-updater/land-preferences responded in ${elapsed}ms with HTTP status ${res.status} (${res.statusText})`);
      if (res.ok) {
        const data = await res.json();
        console.log("[DeckUpdater:LandPreferences] Received land preferences payload:", data);
        if (data && data.preferences) {
          console.log("[DeckUpdater:LandPreferences] Updating local state with preferences:", {
            budgetTier: data.preferences.budgetTier,
            maxPricePerLand: data.preferences.maxPricePerLand,
            excludeReservedList: data.preferences.excludeReservedList,
            excludeTapped: data.preferences.excludeTapped,
            likedCyclesCount: (data.preferences.likedCycles || []).length,
            likedCycles: data.preferences.likedCycles,
            dislikedCyclesCount: (data.preferences.dislikedCycles || []).length,
            dislikedCycles: data.preferences.dislikedCycles
          });
          setLandPreferences(data.preferences);
        } else {
          console.warn("[DeckUpdater:LandPreferences] Response OK but missing data.preferences property:", data);
        }
      } else {
        let errDetails = null;
        try {
          const rawText = await res.text();
          try {
            errDetails = JSON.parse(rawText);
          } catch {
            errDetails = rawText ? { error: rawText } : null;
          }
        } catch {
          errDetails = { error: "Failed to read response" };
        }
        console.error(`[DeckUpdater:LandPreferences] GET failed with HTTP ${res.status}:`, errDetails);
      }
    } catch (e) {
      console.error("[DeckUpdater:LandPreferences] Exception in fetchLandPreferences:", e);
    }
  };

  const fetchAllDecksAnalysis = async (isManualRefresh = false) => {
    const token = localStorage.getItem("token");
    console.log(`[DeckUpdater] Running fetchAllDecksAnalysis (isManualRefresh=${isManualRefresh}). Token present:`, !!token);
    if (!token) {
      console.warn("[DeckUpdater] Cannot analyze decks - no auth token");
      setLoading(false);
      return;
    }

    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const startTime = performance.now();
    try {
      console.log("[DeckUpdater] Sending GET /api/deck-updater/analyze-all with current land preferences snapshot:", {
        budgetTier: landPreferences.budgetTier,
        maxPricePerLand: landPreferences.maxPricePerLand,
        likedCycles: landPreferences.likedCycles,
        dislikedCycles: landPreferences.dislikedCycles
      });
      const res = await fetch("/api/deck-updater/analyze-all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const elapsed = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        console.log(`[DeckUpdater] GET /api/deck-updater/analyze-all responded in ${elapsed}ms with status ${res.status}`);
        const analyses = Array.isArray(data) ? data : [];
        console.log(`[DeckUpdater] Successfully loaded analyses for ${analyses.length} decks:`, analyses.map(d => ({
          deck_id: d.deck_id,
          deck_name: d.deck_name,
          commander: d.commander,
          strictlyBetterCount: d.strictlyBetter?.length || 0,
          newCardsCount: d.edhrec?.newCards?.length || 0,
          synergyCount: d.edhrec?.highSynergy?.length || 0,
          landCutsCount: d.landUpgrades?.cuts?.length || 0,
          landAddsCount: d.landUpgrades?.adds?.length || 0,
          landPrefsApplied: d.landUpgrades?.preferencesApplied
        })));
        setDeckAnalyses(analyses);
      } else {
        let errDetails = null;
        try {
          const rawText = await res.text();
          try {
            errDetails = JSON.parse(rawText);
          } catch {
            errDetails = rawText ? { error: rawText } : null;
          }
        } catch {
          errDetails = { error: "Failed to read response" };
        }
        console.error(`[DeckUpdater] Failed to analyze decks (HTTP ${res.status}):`, errDetails);
        setError(errDetails?.error || "Failed to analyze decks");
      }
    } catch (e) {
      console.error("[DeckUpdater] Network error in fetchAllDecksAnalysis:", e);
      setError("Network error while analyzing decks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSaveLandPreferences = async (newPreferences) => {
    const token = localStorage.getItem("token");
    console.log("[DeckUpdater:LandPreferences] handleSaveLandPreferences called with payload:", {
      budgetTier: newPreferences?.budgetTier,
      maxPricePerLand: newPreferences?.maxPricePerLand,
      excludeReservedList: newPreferences?.excludeReservedList,
      excludeTapped: newPreferences?.excludeTapped,
      likedCount: newPreferences?.likedCycles?.length || 0,
      likedCycles: newPreferences?.likedCycles,
      dislikedCount: newPreferences?.dislikedCycles?.length || 0,
      dislikedCycles: newPreferences?.dislikedCycles,
      tokenPresent: !!token
    });

    if (!token) {
      console.error("[DeckUpdater:LandPreferences] Cannot save land preferences - no auth token available");
      showToast("Authentication required to save preferences", "error");
      return;
    }

    setIsSavingLandPrefs(true);
    const startTime = performance.now();
    try {
      const serializedBody = JSON.stringify({ preferences: newPreferences });
      console.log(`[DeckUpdater:LandPreferences] Dispatching PUT /api/deck-updater/land-preferences (payload size: ${serializedBody.length} bytes):`, serializedBody);

      const res = await fetch("/api/deck-updater/land-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: serializedBody
      });

      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[DeckUpdater:LandPreferences] PUT responded in ${elapsed}ms with HTTP status ${res.status} (${res.statusText})`);

      if (res.ok) {
        const result = await res.json();
        console.log("[DeckUpdater:LandPreferences] Server successfully saved land preferences. Response:", result);
        const savedPrefs = result.preferences || newPreferences;
        console.log("[DeckUpdater:LandPreferences] Updating client state with saved preferences:", savedPrefs);
        setLandPreferences(savedPrefs);
        setIsLandConfigOpen(false);
        showToast("Land preferences updated successfully!", "success");
        // Re-analyze all decks with new preferences
        console.log("[DeckUpdater:LandPreferences] Triggering re-analysis of all decks with newly saved preferences...");
        await fetchAllDecksAnalysis(true);
      } else {
        let errDetails = null;
        try {
          const rawText = await res.text();
          try {
            errDetails = JSON.parse(rawText);
          } catch {
            errDetails = rawText ? { error: rawText } : null;
          }
        } catch {
          errDetails = { error: "Failed to read response" };
        }
        console.error(`[DeckUpdater:LandPreferences] Server rejected land preferences save (HTTP ${res.status}):`, errDetails);
        showToast(errDetails?.error || (typeof errDetails === "string" ? errDetails : "Failed to save land preferences"), "error");
      }
    } catch (e) {
      console.error("[DeckUpdater:LandPreferences] Network/runtime exception while saving land preferences:", e);
      showToast("Network error saving preferences", "error");
    } finally {
      setIsSavingLandPrefs(false);
    }
  };

  const handleQuickChangeBudget = async (tierId, maxPrice) => {
    const updated = {
      ...landPreferences,
      budgetTier: tierId,
      maxPricePerLand: maxPrice
    };
    console.log(`[DeckUpdater:LandPreferences] handleQuickChangeBudget: changing budget to tier='${tierId}', maxPrice=${maxPrice}`);
    setLandPreferences(updated);

    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("[DeckUpdater:LandPreferences] Quick budget update skipped backend call - no auth token");
      return;
    }

    try {
      console.log("[DeckUpdater:LandPreferences] Dispatching quick budget update to backend via PUT /api/deck-updater/land-preferences");
      const res = await fetch("/api/deck-updater/land-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ preferences: updated })
      });
      console.log(`[DeckUpdater:LandPreferences] Quick budget update HTTP response status: ${res.status}`);
      if (res.ok) {
        showToast(`Budget changed to ${tierId === "all" ? "Unlimited" : `< $${maxPrice}`}`, "info");
        console.log("[DeckUpdater:LandPreferences] Triggering re-analysis of decks after quick budget change...");
        fetchAllDecksAnalysis(true);
      } else {
        let errDetails = null;
        try {
          const rawText = await res.text();
          try {
            errDetails = JSON.parse(rawText);
          } catch {
            errDetails = rawText ? { error: rawText } : null;
          }
        } catch {
          errDetails = { error: "Failed to read response" };
        }
        console.error(`[DeckUpdater:LandPreferences] Quick budget update failed (HTTP ${res.status}):`, errDetails);
        showToast(errDetails?.error || (typeof errDetails === "string" ? errDetails : "Failed to update budget tier"), "error");
      }
    } catch (e) {
      console.error("[DeckUpdater:LandPreferences] Failed to quick update budget tier:", e);
    }
  };

  const loadDismissals = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("/api/deck-updater/dismissals", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setDismissals(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openOptions = () => {
    setShowOptions(true);
    loadDismissals();
  };

  // Triage: "Pass / Say No"
  const handlePass = async (deckId, suggestionId, cardName, deckName) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Optimistic UI removal
    setDeckAnalyses(prev => prev.map(deck => {
      if (String(deck.deck_id) !== String(deckId)) return deck;

      return {
        ...deck,
        strictlyBetter: (deck.strictlyBetter || []).filter(u => `strictly_better:${u.currentCard}` !== suggestionId),
        edhrec: {
          newCards: (deck.edhrec?.newCards || []).filter(c => `edhrec_new:${c.name}` !== suggestionId),
          highSynergy: (deck.edhrec?.highSynergy || []).filter(c => `edhrec_synergy:${c.name}` !== suggestionId)
        },
        landUpgrades: deck.landUpgrades ? {
          ...deck.landUpgrades,
          cuts: (deck.landUpgrades.cuts || []).filter(c => `land_cut:${c.name}` !== suggestionId),
          adds: (deck.landUpgrades.adds || []).filter(a => `land_add:${a.name}` !== suggestionId)
        } : deck.landUpgrades
      };
    }));

    // Optimistic addition to dismissals
    setDismissals(prev => {
      if (prev.some(d => String(d.deck_id) === String(deckId) && d.suggestion_id === suggestionId)) return prev;
      return [{ id: Date.now() + Math.random(), deck_id: deckId, suggestion_id: suggestionId, created_at: new Date().toISOString() }, ...prev];
    });

    // Provide Undo notification
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoAction({ deckId, suggestionId, cardName, deckName });
    undoTimerRef.current = setTimeout(() => {
      setUndoAction(null);
    }, 6000);

    try {
      await fetch("/api/deck-updater/dismiss", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ deck_id: deckId, suggestion_id: suggestionId })
      });
    } catch (e) {
      console.error("Failed to dismiss:", e);
    }
  };

  // Undo recent pass
  const handleUndoRecent = () => {
    if (!undoAction) return;
    const { deckId, suggestionId, cardName } = undoAction;
    setUndoAction(null);
    handleUndismiss(deckId, suggestionId);
    showToast(`Restored ${cardName} to queue`, "info");
  };

  // Triage: "Add to Wishlist"
  const handleAddToWishlist = async (deckId, suggestionId, cardName, deckName) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // 1. Add to user wishlist
      const res = await fetch("/api/collection/wishlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ card_name: cardName, quantity: 1 })
      });

      if (res.ok) {
        showToast(`Saved ${cardName} to your Wishlist!`, "success");
      }

      // 2. Dismiss from recommendation queue so it doesn't linger
      await handlePass(deckId, suggestionId, cardName, deckName);
    } catch (e) {
      console.error("Failed to add to wishlist:", e);
      showToast("Failed to add to wishlist", "error");
    }
  };

  // Undismiss / Restore
  const handleUndismiss = async (deckId, suggestionId) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setDismissals(prev => prev.filter(d => !(String(d.deck_id) === String(deckId) && d.suggestion_id === suggestionId)));

    try {
      await fetch("/api/deck-updater/undismiss", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ deck_id: deckId, suggestion_id: suggestionId })
      });
      // Refresh analysis to return card to triage feed
      fetchAllDecksAnalysis();
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate summary metrics across all suggestion types
  const summaryMetrics = useMemo(() => {
    let totalNew = 0;
    let totalUpgrades = 0;
    let totalLandCuts = 0;
    let totalLandAdds = 0;
    let totalSynergy = 0;
    let decksWithCandidates = 0;

    for (const d of deckAnalyses) {
      const newCount = d.edhrec?.newCards?.length || 0;
      const upgradeCount = d.strictlyBetter?.length || 0;
      const landCutCount = d.landUpgrades?.cuts?.length || 0;
      const landAddCount = d.landUpgrades?.adds?.length || 0;
      const synergyCount = d.edhrec?.highSynergy?.length || 0;

      totalNew += newCount;
      totalUpgrades += upgradeCount;
      totalLandCuts += landCutCount;
      totalLandAdds += landAddCount;
      totalSynergy += synergyCount;

      if (newCount > 0 || upgradeCount > 0 || landCutCount > 0 || landAddCount > 0 || synergyCount > 0) {
        decksWithCandidates++;
      }
    }

    const totalLands = totalLandCuts + totalLandAdds;
    const totalAll = totalNew + totalUpgrades + totalLands + totalSynergy;

    return {
      totalAll,
      totalNew,
      totalUpgrades,
      totalLandCuts,
      totalLandAdds,
      totalLands,
      totalSynergy,
      decksWithCandidates,
      totalDecks: deckAnalyses.length
    };
  }, [deckAnalyses]);

  // Filter decks according to selection
  const filteredDecks = useMemo(() => {
    let list = deckAnalyses;
    if (selectedDeckId !== "all") {
      list = list.filter(d => String(d.deck_id) === String(selectedDeckId));
    }
    return list;
  }, [deckAnalyses, selectedDeckId]);

  // Filter dismissal search
  const filteredDismissals = useMemo(() => {
    if (!dismissalSearch.trim()) return dismissals;
    const q = dismissalSearch.toLowerCase();
    return dismissals.filter(d => {
      const deckName = deckAnalyses.find(da => String(da.deck_id) === String(d.deck_id))?.deck_name || "";
      return d.suggestion_id.toLowerCase().includes(q) || deckName.toLowerCase().includes(q);
    });
  }, [dismissals, dismissalSearch, deckAnalyses]);

  if (loading) {
    return (
      <div className="radar-container fade-in">
        <header className="radar-header">
          <div className="radar-title-group">
            <span className="radar-tag">
              <SparklesIcon className="icon-sm" /> Release Radar
            </span>
            <h1>Deck Inclusions & Release Radar</h1>
            <p className="radar-subtitle">Scanning latest card printings, EDHRec trends, land cuts, and powercreep upgrades...</p>
          </div>
        </header>
        <div className="radar-panel radar-loading">
          <div className="radar-spinner"></div>
          <p>Analyzing decks against Scryfall, EDHRec & Land Cycles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="radar-container fade-in">
        <div className="radar-panel radar-error">
          <ExclamationTriangleIcon className="icon-lg text-amber" />
          <h2>Unable to Load Release Radar</h2>
          <p>{error}</p>
          <button className="btn-secondary" onClick={() => fetchAllDecksAnalysis()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="radar-container fade-in">
      {/* Header & Primary Actions */}
      <header className="radar-header">
        <div className="radar-title-group">
          <span className="radar-tag">
            <SparklesIcon className="icon-sm text-cyan" /> Release Radar
          </span>
          <h1>New Cards & Inclusions Dashboard</h1>
          <p className="radar-subtitle">
            Evaluate upgrades, suggested land cuts, new releases, and synergy staples for your Commander decks—all on one unified screen.
          </p>
        </div>

        <div className="radar-header-actions">
          <button
            className="btn-ghost"
            onClick={openOptions}
            title="View cards you previously passed on"
          >
            <AdjustmentsHorizontalIcon className="icon-sm" />
            <span>Passed Cards</span>
            {dismissals.length > 0 && <span className="counter-pill">{dismissals.length}</span>}
          </button>

          <button
            className={`btn-ghost ${refreshing ? "spinning" : ""}`}
            onClick={() => fetchAllDecksAnalysis(true)}
            disabled={refreshing}
            title="Refresh recommendations"
          >
            <ArrowPathIcon className="icon-sm" />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </header>

      {/* Summary KPI Strip */}
      <section className="kpi-strip">
        <div
          className={`kpi-card ${activeFilter === "upgrades" ? "active" : ""}`}
          onClick={() => setActiveFilter(activeFilter === "upgrades" ? "all" : "upgrades")}
          title="Filter by Direct Upgrades"
        >
          <div className="kpi-icon-wrap amber">
            <ExclamationTriangleIcon className="icon-md" />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{summaryMetrics.totalUpgrades}</span>
            <span className="kpi-label">Direct Upgrades</span>
          </div>
        </div>

        <div
          className={`kpi-card ${activeFilter === "lands" ? "active" : ""}`}
          onClick={() => setActiveFilter(activeFilter === "lands" ? "all" : "lands")}
          title="Filter by Land Base Optimization"
        >
          <div className="kpi-icon-wrap rose">
            <AdjustmentsHorizontalIcon className="icon-md" />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{summaryMetrics.totalLands}</span>
            <span className="kpi-label">Land Cuts & Adds</span>
          </div>
        </div>

        <div
          className={`kpi-card ${activeFilter === "new" ? "active" : ""}`}
          onClick={() => setActiveFilter(activeFilter === "new" ? "all" : "new")}
          title="Filter by New Releases"
        >
          <div className="kpi-icon-wrap cyan">
            <SparklesIcon className="icon-md" />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{summaryMetrics.totalNew}</span>
            <span className="kpi-label">New Printings</span>
          </div>
        </div>

        <div
          className={`kpi-card ${activeFilter === "synergy" ? "active" : ""}`}
          onClick={() => setActiveFilter(activeFilter === "synergy" ? "all" : "synergy")}
          title="Filter by High Synergy Staples"
        >
          <div className="kpi-icon-wrap purple">
            <FireIcon className="icon-md" />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{summaryMetrics.totalSynergy}</span>
            <span className="kpi-label">High Synergy</span>
          </div>
        </div>
      </section>

      {/* Deck Selector Filter Bar */}
      <section className="deck-selector-bar">
        <div className="deck-selector-scroll">
          <button
            className={`deck-pill ${selectedDeckId === "all" ? "active" : ""}`}
            onClick={() => setSelectedDeckId("all")}
          >
            <span>All Decks</span>
            <span className="deck-pill-count">{summaryMetrics.totalAll}</span>
          </button>

          {deckAnalyses.map(deck => {
            const count =
              (deck.edhrec?.newCards?.length || 0) +
              (deck.strictlyBetter?.length || 0) +
              (deck.landUpgrades?.cuts?.length || 0) +
              (deck.landUpgrades?.adds?.length || 0) +
              (deck.edhrec?.highSynergy?.length || 0);

            const isSelected = String(deck.deck_id) === String(selectedDeckId);

            return (
              <button
                key={deck.deck_id}
                className={`deck-pill ${isSelected ? "active" : ""}`}
                onClick={() => setSelectedDeckId(deck.deck_id)}
              >
                {deck.commanderData?.image_uri ? (
                  <img
                    src={deck.commanderData.image_uri}
                    alt={deck.commander || deck.deck_name}
                    className="deck-pill-avatar"
                  />
                ) : (
                  <span className="deck-pill-avatar-placeholder">
                    {deck.deck_name ? deck.deck_name.charAt(0).toUpperCase() : "D"}
                  </span>
                )}
                <span className="deck-pill-name">{deck.deck_name}</span>
                {count > 0 ? (
                  <span className="deck-pill-badge">{count}</span>
                ) : (
                  <CheckCircleIcon className="icon-xs text-emerald" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Control Bar: View Filter + Live Card Search */}
      <section className="control-bar">
        <div className="mode-tabs">
          <button
            className={`mode-tab ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            <Squares2X2Icon className="icon-sm" />
            <span>All Suggestions</span>
            <span className="tab-badge">{summaryMetrics.totalAll}</span>
          </button>

          <button
            className={`mode-tab ${activeFilter === "upgrades" ? "active" : ""}`}
            onClick={() => setActiveFilter("upgrades")}
          >
            <ExclamationTriangleIcon className="icon-sm text-amber" />
            <span>Upgrades</span>
            <span className="tab-badge">{summaryMetrics.totalUpgrades}</span>
          </button>

          <button
            className={`mode-tab ${activeFilter === "lands" ? "active" : ""}`}
            onClick={() => setActiveFilter("lands")}
          >
            <AdjustmentsHorizontalIcon className="icon-sm text-rose" />
            <span>Land Base</span>
            <span className="tab-badge">{summaryMetrics.totalLands}</span>
          </button>

          <button
            className={`mode-tab ${activeFilter === "new" ? "active" : ""}`}
            onClick={() => setActiveFilter("new")}
          >
            <SparklesIcon className="icon-sm text-cyan" />
            <span>New Releases</span>
            <span className="tab-badge">{summaryMetrics.totalNew}</span>
          </button>

          <button
            className={`mode-tab ${activeFilter === "synergy" ? "active" : ""}`}
            onClick={() => setActiveFilter("synergy")}
          >
            <FireIcon className="icon-sm text-purple" />
            <span>High Synergy</span>
            <span className="tab-badge">{summaryMetrics.totalSynergy}</span>
          </button>
        </div>

        <div className="search-wrap">
          <MagnifyingGlassIcon className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search cards in view..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
              <XMarkIcon className="icon-xs" />
            </button>
          )}
        </div>
      </section>

      {/* Land Base Preference Quick Bar (rendered when Land Base is visible) */}
      {(activeFilter === "all" || activeFilter === "lands") && (
        <LandPreferencesBar
          preferences={landPreferences}
          onOpenConfigModal={() => setIsLandConfigOpen(true)}
          onQuickChangeBudget={handleQuickChangeBudget}
          isLoading={refreshing}
        />
      )}

      {/* Main Content Area */}
      {filteredDecks.length === 0 ? (
        <div className="radar-panel empty-deck-state">
          <SparklesIcon className="icon-xl text-muted" />
          <h2>No Decks Imported</h2>
          <p>Import decks from Archidekt or Moxfield to receive real-time release recommendations.</p>
        </div>
      ) : (
        <div className="deck-feed">
          {filteredDecks.map(deck => {
            const rawNewCards = deck.edhrec?.newCards || [];
            const rawUpgrades = deck.strictlyBetter || [];
            const rawLandCuts = deck.landUpgrades?.cuts || [];
            const rawLandAdds = deck.landUpgrades?.adds || [];
            const rawSynergy = deck.edhrec?.highSynergy || [];

            // Apply search filtering across all categories
            const q = searchQuery.toLowerCase().trim();
            const newCards = q ? rawNewCards.filter(c => c.name.toLowerCase().includes(q)) : rawNewCards;
            const upgrades = q
              ? rawUpgrades.filter(
                  u =>
                    u.currentCard.toLowerCase().includes(q) ||
                    u.strictlyBetterCards.some(s => s.toLowerCase().includes(q))
                )
              : rawUpgrades;
            const landCuts = q
              ? rawLandCuts.filter(c => c.name.toLowerCase().includes(q) || (c.reason && c.reason.toLowerCase().includes(q)))
              : rawLandCuts;
            const landAdds = q
              ? rawLandAdds.filter(a => a.name.toLowerCase().includes(q) || (a.cycle && a.cycle.toLowerCase().includes(q)))
              : rawLandAdds;
            const synergyCards = q ? rawSynergy.filter(c => c.name.toLowerCase().includes(q)) : rawSynergy;

            const totalMatchingSuggestions =
              newCards.length + upgrades.length + landCuts.length + landAdds.length + synergyCards.length;

            const shouldShowUpgrades = (activeFilter === "all" || activeFilter === "upgrades") && upgrades.length > 0;
            const shouldShowLands = (activeFilter === "all" || activeFilter === "lands") && (landCuts.length > 0 || landAdds.length > 0);
            const shouldShowNew = (activeFilter === "all" || activeFilter === "new") && newCards.length > 0;
            const shouldShowSynergy = (activeFilter === "all" || activeFilter === "synergy") && synergyCards.length > 0;

            const hasVisibleContent = shouldShowUpgrades || shouldShowLands || shouldShowNew || shouldShowSynergy;

            // Skip rendering empty decks in "All Decks" view when there are no suggestions and not searching
            if (selectedDeckId === "all" && !hasVisibleContent && !searchQuery) {
              return null;
            }

            return (
              <article key={deck.deck_id} className="deck-section-card">
                {/* Deck Card Header */}
                <header className="deck-section-header">
                  <div className="deck-identity">
                    {deck.commanderData?.image_uri ? (
                      <CardMagnifier
                        cardImageUrl={deck.commanderData.image_uri}
                        cardName={deck.commander || deck.deck_name}
                        style={{ width: "auto", display: "inline-flex", flexShrink: 0 }}
                      >
                        <img
                          src={deck.commanderData.image_uri}
                          alt={deck.commander || deck.deck_name}
                          className="commander-art-thumb"
                        />
                      </CardMagnifier>
                    ) : (
                      <div className="commander-art-placeholder" title="No Commander Image">
                        <SparklesIcon className="icon-sm text-muted" />
                      </div>
                    )}
                    <div>
                      <h2>{deck.deck_name}</h2>
                      <div className="deck-commander-tag-row">
                        <span className="deck-commander-tag">
                          {deck.commander ? (
                            <>Commander: <strong>{deck.commander}</strong></>
                          ) : (
                            <span className="no-commander-badge">No Commander Assigned</span>
                          )}
                        </span>
                        {deck.landUpgrades?.colorIdentity?.length > 0 && (
                          <div className="deck-color-identity-pills" title={`Color Identity: ${deck.landUpgrades.colorIdentity.join(", ")}`}>
                            {deck.landUpgrades.colorIdentity.map(c => (
                              <span key={c} className={`mana-pip pip-${c.toLowerCase()}`}>{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="deck-header-meta">
                    {upgrades.length > 0 && (
                      <span className="section-count-tag amber" title="Direct Upgrades">
                        <ExclamationTriangleIcon className="icon-xs" /> {upgrades.length} Upgrades
                      </span>
                    )}
                    {(landCuts.length > 0 || landAdds.length > 0) && (
                      <span className="section-count-tag rose" title="Land Base Cuts & Adds">
                        <AdjustmentsHorizontalIcon className="icon-xs" /> {landCuts.length + landAdds.length} Land Recs
                      </span>
                    )}
                    {newCards.length > 0 && (
                      <span className="section-count-tag cyan" title="New Releases">
                        <SparklesIcon className="icon-xs" /> {newCards.length} New Releases
                      </span>
                    )}
                    {synergyCards.length > 0 && (
                      <span className="section-count-tag purple" title="High Synergy Staples">
                        <FireIcon className="icon-xs" /> {synergyCards.length} Staples
                      </span>
                    )}
                    {totalMatchingSuggestions === 0 && (
                      <span className="section-count-tag emerald">
                        <CheckCircleIcon className="icon-xs" /> Up to date
                      </span>
                    )}
                  </div>
                </header>

                {/* When all categories are empty for this deck */}
                {!hasVisibleContent && (
                  <div className="all-caught-up-banner">
                    <CheckCircleIcon className="icon-md text-emerald" />
                    <div>
                      <strong>All caught up on recommendations</strong>
                      <p>
                        {searchQuery
                          ? "No suggestions match your current search query."
                          : "No pending upgrades, land cuts, or new card additions for this deck."}
                      </p>
                    </div>
                  </div>
                )}

                {/* 1. Strictly Better Upgrades Section */}
                {shouldShowUpgrades && (
                  <section className="deck-category-section">
                    <div className="deck-category-header">
                      <div className="category-title-wrap">
                        <ExclamationTriangleIcon className="icon-sm text-amber" />
                        <h3>Direct Upgrades & Strictly Better Cards</h3>
                        <span className="category-pill amber">{upgrades.length}</span>
                      </div>
                      <p className="category-subtitle">
                        Cards currently in your deck that have strictly superior replacements or variations.
                      </p>
                    </div>

                    <div className="upgrades-feed">
                      {upgrades.map((upgrade, idx) => {
                        const suggestionId = `strictly_better:${upgrade.currentCard}`;
                        return (
                          <div key={idx} className="upgrade-pair-card">
                            {/* Left: Inferior / Current Card */}
                            <div className="upgrade-side inferior">
                              <span className="side-label">Current in Deck</span>
                              {upgrade.currentCardData?.image_uri ? (
                                <CardMagnifier
                                  cardImageUrl={upgrade.currentCardData.image_uri}
                                  cardName={upgrade.currentCard}
                                >
                                  <img
                                    src={upgrade.currentCardData.image_uri}
                                    alt={upgrade.currentCard}
                                    className="upgrade-thumb"
                                  />
                                </CardMagnifier>
                              ) : (
                                <div className="triage-placeholder">{upgrade.currentCard}</div>
                              )}
                              <span className="upgrade-card-name">{upgrade.currentCard}</span>
                              <span className="price-tag">
                                {upgrade.currentCardData?.price ? `$${upgrade.currentCardData.price}` : "--"}
                              </span>
                            </div>

                            <div className="upgrade-divider">
                              <ChevronRightIcon className="icon-md text-amber" />
                            </div>

                            {/* Right: Strictly Better Cards */}
                            <div className="upgrade-side superior">
                              <span className="side-label">Direct Upgrades / Variations</span>
                              <div className="superior-options">
                                {upgrade.strictlyBetterCardsData.map((sup, sIdx) => (
                                  <div key={sIdx} className="superior-item">
                                    {sup.image_uri ? (
                                      <CardMagnifier cardImageUrl={sup.image_uri} cardName={sup.name}>
                                        <img src={sup.image_uri} alt={sup.name} className="upgrade-thumb" />
                                      </CardMagnifier>
                                    ) : (
                                      <div className="triage-placeholder">{sup.name}</div>
                                    )}
                                    <span className="upgrade-card-name">{sup.name}</span>
                                    <div className="superior-footer">
                                      <span className="price-tag">
                                        {sup.price ? `$${sup.price}` : "--"}
                                      </span>
                                      <button
                                        className="btn-mini-wishlist"
                                        onClick={() =>
                                          handleAddToWishlist(deck.deck_id, suggestionId, sup.name, deck.deck_name)
                                        }
                                        title={`Add ${sup.name} to Wishlist`}
                                      >
                                        <BookmarkIcon className="icon-xs" /> Wishlist
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Pass button for upgrade pair */}
                            <button
                              className="upgrade-dismiss-btn"
                              onClick={() =>
                                handlePass(deck.deck_id, suggestionId, upgrade.currentCard, deck.deck_name)
                              }
                              title="Pass on this upgrade suggestion"
                            >
                              <XMarkIcon className="icon-sm" /> Pass
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 2. Land Base Optimization Section (Suggested Cuts & Better Alternatives) */}
                {shouldShowLands && (
                  <section className="deck-category-section">
                    <div className="deck-category-header">
                      <div className="category-title-wrap">
                        <AdjustmentsHorizontalIcon className="icon-sm text-rose" />
                        <h3>Land Base Optimization</h3>
                        <span className="category-pill rose">{landCuts.length + landAdds.length}</span>
                      </div>
                      <p className="category-subtitle">
                        Recommended land cuts and tier-tested cycle alternatives tailored to your deck's color identity.
                      </p>
                    </div>

                    <div className="land-subsections">
                      {/* Sub-section: Suggested Cuts */}
                      {landCuts.length > 0 && (
                        <div className="land-subgroup cuts-subgroup">
                          <div className="land-subgroup-title">
                            <ExclamationTriangleIcon className="icon-xs text-rose" />
                            <h4>Suggested Land Cuts ({landCuts.length})</h4>
                          </div>

                          <div className="triage-grid">
                            {landCuts.map((card, idx) => {
                              const suggestionId = `land_cut:${card.name}`;
                              return (
                                <div key={idx} className="triage-card cut-card">
                                  <div className="triage-visual-wrap">
                                    {card.image_uri ? (
                                      <CardMagnifier cardImageUrl={card.image_uri} cardName={card.name}>
                                        <img src={card.image_uri} alt={card.name} className="triage-card-img" />
                                      </CardMagnifier>
                                    ) : (
                                      <div className="triage-placeholder">{card.name}</div>
                                    )}
                                    <div className="triage-floating-meta">
                                      <span className="cut-badge">Suggested Cut</span>
                                    </div>
                                  </div>

                                  <div className="triage-details">
                                    <h3 className="triage-card-name" title={card.name}>
                                      {card.name}
                                    </h3>
                                    {card.reason && (
                                      <p className="triage-reason text-rose" title={card.reason}>
                                        {card.reason}
                                      </p>
                                    )}
                                  </div>

                                  <div className="triage-actions-bar single-action">
                                    <button
                                      className="action-btn pass-btn"
                                      onClick={() => handlePass(deck.deck_id, suggestionId, card.name, deck.deck_name)}
                                      title="Dismiss cut suggestion"
                                    >
                                      <XMarkIcon className="icon-sm" />
                                      <span>Keep Land (Dismiss)</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Sub-section: Better Alternatives */}
                      {landAdds.length > 0 && (
                        <div className="land-subgroup adds-subgroup">
                          <div className="land-subgroup-title">
                            <CheckCircleIcon className="icon-xs text-emerald" />
                            <h4>Recommended Land Upgrades ({landAdds.length})</h4>
                          </div>

                          <div className="triage-grid">
                            {landAdds.map((card, idx) => {
                              const suggestionId = `land_add:${card.name}`;
                              return (
                                <div key={idx} className="triage-card add-card">
                                  <div className="triage-visual-wrap">
                                    {card.image_uri ? (
                                      <CardMagnifier cardImageUrl={card.image_uri} cardName={card.name}>
                                        <img src={card.image_uri} alt={card.name} className="triage-card-img" />
                                      </CardMagnifier>
                                    ) : (
                                      <div className="triage-placeholder">{card.name}</div>
                                    )}
                                    <div className="triage-floating-meta">
                                      <span className="price-tag">
                                        {card.price !== null && card.price !== undefined ? `$${card.price.toFixed(2)}` : "--"}
                                      </span>
                                      {card.tier && (
                                        <span className="tier-badge">{card.tier.toUpperCase()}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="triage-details">
                                    <h3 className="triage-card-name" title={card.name}>
                                      {card.name}
                                    </h3>
                                    {card.cycle && (
                                      <p className="triage-reason text-emerald" title={card.cycle}>
                                        {card.cycle}
                                      </p>
                                    )}
                                  </div>

                                  <div className="triage-actions-bar">
                                    <button
                                      className="action-btn pass-btn"
                                      onClick={() => handlePass(deck.deck_id, suggestionId, card.name, deck.deck_name)}
                                      title="Pass on this land recommendation"
                                    >
                                      <XMarkIcon className="icon-sm" />
                                      <span>Pass</span>
                                    </button>

                                    <button
                                      className="action-btn wishlist-btn"
                                      onClick={() => handleAddToWishlist(deck.deck_id, suggestionId, card.name, deck.deck_name)}
                                      title="Add to Wishlist"
                                    >
                                      <BookmarkIcon className="icon-sm" />
                                      <span>Wishlist</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* 3. New Set Printings & Releases Section */}
                {shouldShowNew && (
                  <section className="deck-category-section">
                    <div className="deck-category-header">
                      <div className="category-title-wrap">
                        <SparklesIcon className="icon-sm text-cyan" />
                        <h3>New Set Printings & Releases</h3>
                        <span className="category-pill cyan">{newCards.length}</span>
                      </div>
                      <p className="category-subtitle">
                        Fresh printings and recent set additions trending in this archetype.
                      </p>
                    </div>

                    <div className="triage-grid">
                      {newCards.map((card, idx) => {
                        const suggestionId = `edhrec_new:${card.name}`;
                        return (
                          <div key={idx} className="triage-card">
                            <div className="triage-visual-wrap">
                              {card.image_uri ? (
                                <CardMagnifier cardImageUrl={card.image_uri} cardName={card.name}>
                                  <img src={card.image_uri} alt={card.name} className="triage-card-img" />
                                </CardMagnifier>
                              ) : (
                                <div className="triage-placeholder">{card.name}</div>
                              )}

                              <div className="triage-floating-meta">
                                <span className="price-tag">
                                  {card.price ? `$${card.price}` : "--"}
                                </span>
                                {card.synergy !== null && card.synergy !== undefined && (
                                  <span className="synergy-tag" title="EDHRec Synergy Score">
                                    {Math.round(card.synergy * 100)}% Syn
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="triage-details">
                              <h3 className="triage-card-name" title={card.name}>
                                {card.name}
                              </h3>
                            </div>

                            <div className="triage-actions-bar">
                              <button
                                className="action-btn pass-btn"
                                onClick={() => handlePass(deck.deck_id, suggestionId, card.name, deck.deck_name)}
                                title="Pass on this card (Say No)"
                              >
                                <XMarkIcon className="icon-sm" />
                                <span>Pass</span>
                              </button>

                              <button
                                className="action-btn wishlist-btn"
                                onClick={() => handleAddToWishlist(deck.deck_id, suggestionId, card.name, deck.deck_name)}
                                title="Add to Wishlist & mark reviewed"
                              >
                                <BookmarkIcon className="icon-sm" />
                                <span>Wishlist</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 4. High Synergy Commander Staples Section */}
                {shouldShowSynergy && (
                  <section className="deck-category-section">
                    <div className="deck-category-header">
                      <div className="category-title-wrap">
                        <FireIcon className="icon-sm text-purple" />
                        <h3>High Synergy Commander Staples</h3>
                        <span className="category-pill purple">{synergyCards.length}</span>
                      </div>
                      <p className="category-subtitle">
                        Highly synergistic staple cards registered across EDHRec.
                      </p>
                    </div>

                    <div className="triage-grid">
                      {synergyCards.map((card, idx) => {
                        const suggestionId = `edhrec_synergy:${card.name}`;
                        return (
                          <div key={idx} className="triage-card">
                            <div className="triage-visual-wrap">
                              {card.image_uri ? (
                                <CardMagnifier cardImageUrl={card.image_uri} cardName={card.name}>
                                  <img src={card.image_uri} alt={card.name} className="triage-card-img" />
                                </CardMagnifier>
                              ) : (
                                <div className="triage-placeholder">{card.name}</div>
                              )}

                              <div className="triage-floating-meta">
                                <span className="price-tag">
                                  {card.price ? `$${card.price}` : "--"}
                                </span>
                                {card.synergy !== null && card.synergy !== undefined && (
                                  <span className="synergy-tag purple" title="EDHRec Synergy Score">
                                    {Math.round(card.synergy * 100)}% Syn
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="triage-details">
                              <h3 className="triage-card-name" title={card.name}>
                                {card.name}
                              </h3>
                            </div>

                            <div className="triage-actions-bar">
                              <button
                                className="action-btn pass-btn"
                                onClick={() => handlePass(deck.deck_id, suggestionId, card.name, deck.deck_name)}
                                title="Pass on this synergy recommendation"
                              >
                                <XMarkIcon className="icon-sm" />
                                <span>Pass</span>
                              </button>

                              <button
                                className="action-btn wishlist-btn"
                                onClick={() => handleAddToWishlist(deck.deck_id, suggestionId, card.name, deck.deck_name)}
                                title="Add to Wishlist"
                              >
                                <BookmarkIcon className="icon-sm" />
                                <span>Wishlist</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Floating Undo Notification */}
      {undoAction && (
        <aside className="undo-toast-banner" role="status">
          <div className="undo-toast-content">
            <span className="undo-label">
              Passed on <strong>{undoAction.cardName}</strong> ({undoAction.deckName})
            </span>
          </div>
          <button className="btn-undo" onClick={handleUndoRecent}>
            <ArrowUturnLeftIcon className="icon-xs" /> Undo
          </button>
        </aside>
      )}

      {/* Land Suggester Configuration Modal */}
      <LandSuggesterConfigModal
        isOpen={isLandConfigOpen}
        onClose={() => setIsLandConfigOpen(false)}
        initialPreferences={landPreferences}
        onSavePreferences={handleSaveLandPreferences}
        isSaving={isSavingLandPrefs}
      />

      {/* Review History / Passed Cards Modal */}
      {showOptions && (
        <div className="modal-overlay" onClick={() => setShowOptions(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h2>Passed Cards History</h2>
                <p className="modal-subtext">Cards you previously passed on. Restore any card to bring it back to your dashboard.</p>
              </div>
              <button className="modal-close" onClick={() => setShowOptions(false)} aria-label="Close dialog">
                <XMarkIcon className="icon-sm" />
              </button>
            </header>

            {dismissals.length > 0 && (
              <div className="modal-search-wrap">
                <MagnifyingGlassIcon className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Filter passed cards..."
                  value={dismissalSearch}
                  onChange={e => setDismissalSearch(e.target.value)}
                />
              </div>
            )}

            <div className="modal-body">
              {filteredDismissals.length === 0 ? (
                <div className="empty-dismissals-state">
                  <CheckCircleIcon className="icon-lg text-muted" />
                  <p>{dismissals.length === 0 ? "You haven't passed on any cards yet." : "No passed cards match your filter."}</p>
                </div>
              ) : (
                <ul className="dismissals-list">
                  {filteredDismissals.map(d => {
                    const deck = deckAnalyses.find(da => String(da.deck_id) === String(d.deck_id));
                    const deckName = deck?.deck_name || `Deck #${d.deck_id}`;

                    let label = d.suggestion_id;
                    let typeTag = "Recommendation";
                    if (d.suggestion_id.startsWith("strictly_better:")) {
                      typeTag = "Upgrade";
                      label = d.suggestion_id.replace("strictly_better:", "");
                    } else if (d.suggestion_id.startsWith("land_cut:")) {
                      typeTag = "Land Cut";
                      label = d.suggestion_id.replace("land_cut:", "");
                    } else if (d.suggestion_id.startsWith("land_add:")) {
                      typeTag = "Land Upgrade";
                      label = d.suggestion_id.replace("land_add:", "");
                    } else if (d.suggestion_id.startsWith("edhrec_new:")) {
                      typeTag = "New Release";
                      label = d.suggestion_id.replace("edhrec_new:", "");
                    } else if (d.suggestion_id.startsWith("edhrec_synergy:")) {
                      typeTag = "Synergy";
                      label = d.suggestion_id.replace("edhrec_synergy:", "");
                    }

                    return (
                      <li key={d.id} className="dismissal-item">
                        <div className="dismissal-info">
                          <div className="dismissal-header-row">
                            <span className="dismissal-card-title">{label}</span>
                            <span className="dismissal-type-tag">{typeTag}</span>
                          </div>
                          <span className="dismissal-deck-name">{deckName}</span>
                        </div>
                        <button
                          className="restore-btn"
                          onClick={() => handleUndismiss(d.deck_id, d.suggestion_id)}
                          title="Restore to Dashboard"
                        >
                          <ArrowUturnLeftIcon className="icon-xs" /> Restore
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
