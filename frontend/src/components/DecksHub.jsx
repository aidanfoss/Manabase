import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowPathIcon,
  PlusIcon,
  ArchiveBoxIcon,
  Cog6ToothIcon,
  ArrowUturnLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  QueueListIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ShieldCheckIcon,
  TagIcon,
  Square2StackIcon,
  GlobeAltIcon
} from "@heroicons/react/24/solid";

import { api } from "../api/client";
import DeckImporter from "./DeckImporter";
import "../styles/deck-hub.css";

// Helper to format relative time
function formatRelativeTime(dateString) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
}

export default function DecksHub() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Commander Card Metadata Cache (Scryfall art_crop, images, color_identity, mana_cost)
  const [commanderCache, setCommanderCache] = useState({});

  // Floating Card Hover Preview
  const [hoveredPreviewCard, setHoveredPreviewCard] = useState(null);

  // State to manage importer view
  const [showImporter, setShowImporter] = useState(false);
  const [importerDeck, setImporterDeck] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // State for syncing
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [popupStats, setPopupStats] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all"); // 'all', 'moxfield', 'archidekt'
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'active', 'disabled'
  const [colorFilter, setColorFilter] = useState("all"); // 'all', 'W', 'U', 'B', 'R', 'G', 'C'

  const loadDecks = async () => {
    setLoading(true);
    try {
      const [archidektDecks, moxfieldDecks] = await Promise.all([
        api.getSavedArchidektDecks().catch(() => []),
        api.getSavedMoxfieldDecks().catch(() => [])
      ]);
      const combined = [...(archidektDecks || []), ...(moxfieldDecks || [])];
      combined.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      setDecks(combined);

      // Extract unique commander names to batch fetch high-res artwork and metadata
      const commanderNames = new Set();
      combined.forEach(d => {
        if (d.commander) {
          commanderNames.add(d.commander);
        }
      });

      if (commanderNames.size > 0) {
        try {
          const namesList = Array.from(commanderNames);
          const metaBatch = await api.getCardDetailsBatch(namesList);
          setCommanderCache(prev => ({ ...prev, ...metaBatch }));

          // For any commander missing from batch, try searching individual cards
          for (const name of namesList) {
            if (!metaBatch[name]) {
              api.getCardSearch(name).then(results => {
                if (results && results.length > 0) {
                  setCommanderCache(prev => ({ ...prev, [name]: results[0] }));
                }
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.warn("Could not batch load commander art:", e);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load saved decks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showImporter) {
      loadDecks();
    }
  }, [showImporter]);

  const handleOpenImporter = (deck = null) => {
    setImporterDeck(deck);
    setShowImporter(true);
  };

  const handleCloseImporter = () => {
    setShowImporter(false);
    setImporterDeck(null);
    loadDecks();
  };

  const handleQuickResync = async (deck) => {
    setSyncingId(deck.deck_id);
    setPopupStats(null);
    try {
      const isMoxfield = deck.source === "moxfield";
      const res = isMoxfield
        ? await api.syncMoxfieldDeck(deck.deck_id, undefined)
        : await api.syncArchidektDeck(deck.deck_id, undefined);

      setPopupStats({
        title: "Sync Complete",
        message: `Successfully synced ${isMoxfield ? 'Moxfield' : 'Archidekt'} deck: ${deck.deck_name}`,
        stats: res.stats
      });
      loadDecks();
    } catch (err) {
      setPopupStats({
        title: "Sync Failed",
        message: err.message || `Failed to sync deck ${deck.deck_name}`,
        error: true
      });
    } finally {
      setSyncingId(null);
      setTimeout(() => setPopupStats(null), 10000);
    }
  };

  const handleResyncAll = async () => {
    if (decks.length === 0) return;

    const disabledDecks = decks.filter(d => d.status === 'disabled');
    let includeDisabled = false;
    if (disabledDecks.length > 0) {
      includeDisabled = window.confirm(
        `${disabledDecks.length} deck(s) are currently disabled (their cards were removed when you cleared your proxy list).\n\nClick OK to re-enable and resync them now, or Cancel to skip disabled decks.`
      );
    }

    const decksToSync = decks.filter(d => d.status !== 'disabled' || includeDisabled);
    if (decksToSync.length === 0) {
      setPopupStats({
        title: "Nothing to Sync",
        message: "All decks are disabled. Re-enable them by resyncing individually, or clear your proxy list and try again.",
        error: false
      });
      setTimeout(() => setPopupStats(null), 8000);
      return;
    }

    setSyncingAll(true);
    setPopupStats(null);

    let totalStats = { added: 0, removed: 0, ignored: 0 };
    let successCount = 0;

    try {
      for (const deck of decksToSync) {
        setSyncingId(deck.deck_id);
        const res = deck.source === "moxfield"
          ? await api.syncMoxfieldDeck(deck.deck_id, undefined)
          : await api.syncArchidektDeck(deck.deck_id, undefined);

        if (res.stats) {
          totalStats.added += (res.stats.added || 0);
          totalStats.removed += (res.stats.removed || 0);
          totalStats.ignored += (res.stats.ignored || 0);
        }
        successCount++;
      }

      const skippedCount = decks.length - decksToSync.length;
      setPopupStats({
        title: "Resync All Complete",
        message: `Successfully synced ${successCount} deck(s).${skippedCount > 0 ? ` (${skippedCount} disabled deck(s) skipped)` : ""}`,
        stats: totalStats
      });
      loadDecks();
    } catch (err) {
      setPopupStats({
        title: "Resync All Failed",
        message: err.message || "An error occurred during bulk sync.",
        error: true
      });
    } finally {
      setSyncingAll(false);
      setSyncingId(null);
      setTimeout(() => setPopupStats(null), 10000);
    }
  };

  const handleRefreshLists = async () => {
    if (decks.length === 0) return;

    const confirmed = window.confirm(
      `This will clear all tradelist and wishlist cards that came from your synced decks (Archidekt & Moxfield), then re-add them fresh.\n\nManually-added cards will NOT be affected.\n\nProceed?`
    );
    if (!confirmed) return;

    setRefreshing(true);
    setPopupStats(null);
    try {
      const [archidektRes, moxfieldRes] = await Promise.all([
        api.refreshArchidektLists().catch(() => ({ stats: { added: 0, removed: 0, ignored: 0 } })),
        api.refreshMoxfieldLists().catch(() => ({ stats: { added: 0, removed: 0, ignored: 0 } }))
      ]);

      const added = (archidektRes.stats?.added || 0) + (moxfieldRes.stats?.added || 0);
      const removed = (archidektRes.stats?.removed || 0) + (moxfieldRes.stats?.removed || 0);
      const ignored = (archidektRes.stats?.ignored || 0) + (moxfieldRes.stats?.ignored || 0);

      setPopupStats({
        title: "Refresh Complete",
        message: "Tradelist and wishlist have been refreshed from your decks.",
        stats: { added, removed, ignored }
      });
      loadDecks();
    } catch (err) {
      setPopupStats({
        title: "Refresh Failed",
        message: err.message || "An error occurred while refreshing.",
        error: true
      });
    } finally {
      setRefreshing(false);
      setTimeout(() => setPopupStats(null), 12000);
    }
  };

  // Filter Decks
  const visibleDecks = useMemo(() => {
    return decks.filter(deck => {
      // Archive check
      if (deck.status === 'archived') return false;

      // Platform check
      if (platformFilter !== 'all' && deck.source !== platformFilter) return false;

      // Status check
      if (statusFilter === 'active' && deck.status === 'disabled') return false;
      if (statusFilter === 'disabled' && deck.status !== 'disabled') return false;

      // Search query check (name, commander, deck id)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (deck.deck_name || "").toLowerCase().includes(q);
        const matchesComm = (deck.commander || "").toLowerCase().includes(q);
        const matchesId = String(deck.deck_id || "").toLowerCase().includes(q);
        if (!matchesName && !matchesComm && !matchesId) return false;
      }

      // Color Identity check
      if (colorFilter !== 'all') {
        const commMeta = deck.commander ? commanderCache[deck.commander] : null;
        const colorId = commMeta?.color_identity || [];
        if (colorFilter === 'C') {
          if (colorId.length > 0) return false;
        } else {
          if (!colorId.includes(colorFilter)) return false;
        }
      }

      return true;
    });
  }, [decks, platformFilter, statusFilter, searchQuery, colorFilter, commanderCache]);

  const archivedDecks = useMemo(() => {
    return decks.filter(d => d.status === 'archived');
  }, [decks]);

  // Aggregate stats
  const totalCardsCount = useMemo(() => {
    return decks.reduce((sum, d) => {
      const cardList = typeof d.cards === 'string' ? JSON.parse(d.cards || "[]") : (d.cards || []);
      return sum + (cardList.length || d.items?.length || 0);
    }, 0);
  }, [decks]);

  const totalDemandsCount = useMemo(() => {
    return decks.reduce((sum, d) => {
      const items = d.items || [];
      const requested = items.filter(i => i.list_type === "wishlist" || i.list_type === "tradelist");
      return sum + requested.reduce((s, i) => s + (i.quantity || 1), 0);
    }, 0);
  }, [decks]);

  const activeCommandersCount = useMemo(() => {
    return decks.filter(d => d.commander && d.status !== 'archived').length;
  }, [decks]);

  if (showImporter) {
    return <DeckImporter initialDeck={importerDeck} onBack={handleCloseImporter} />;
  }

  return (
    <div className="deck-hub-container">
      {/* Ambient Leyline Background Auras */}
      <div className="deck-hub-aura-bg">
        <div className="deck-aura-orb deck-aura-orb-1"></div>
        <div className="deck-aura-orb deck-aura-orb-2"></div>
        <div className="deck-aura-orb deck-aura-orb-3"></div>
      </div>

      {/* Header & Command Actions */}
      <div className="deck-hub-header">
        <div className="deck-hub-title-group">
          <h1>
            <SparklesIcon className="deck-hub-title-icon" />
            Deck Sync Hub
          </h1>
          <p className="deck-hub-subtitle">
            Synchronize, explore, and manage your Moxfield & Archidekt decks with live commander art and dynamic collection tracking.
          </p>
        </div>

        <div className="deck-hub-actions">
          {decks.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleResyncAll}
                disabled={syncingAll || syncingId !== null || refreshing}
                className="mystic-btn mystic-btn-emerald"
                title="Sync all active decks with remote platforms"
              >
                <ArrowPathIcon className={syncingAll ? "icon-spin" : ""} style={{ width: "1.15em", height: "1.15em" }} />
                <span>{syncingAll ? "Syncing Decks..." : "Resync All"}</span>
              </button>

              <button
                type="button"
                onClick={handleRefreshLists}
                disabled={syncingAll || syncingId !== null || refreshing}
                className="mystic-btn mystic-btn-purple"
                title="Clears tradelist and wishlist cards from your decks, then re-adds them fresh."
              >
                <ArrowUturnLeftIcon className={refreshing ? "icon-spin" : ""} style={{ width: "1.15em", height: "1.15em" }} />
                <span>{refreshing ? "Refreshing..." : "Refresh Lists"}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => handleOpenImporter()}
            disabled={syncingAll || syncingId !== null}
            className="mystic-btn mystic-btn-primary"
          >
            <PlusIcon style={{ width: "1.15em", height: "1.15em" }} />
            <span>Import New Deck</span>
          </button>
        </div>
      </div>

      {/* Global Sync Notification Popup */}
      {popupStats && (
        <div className={`deck-sync-alert ${popupStats.error ? 'error' : 'success'}`}>
          <div>
            <div className="deck-sync-alert-header">
              {popupStats.error ? (
                <ExclamationTriangleIcon style={{ width: '1.25rem', height: '1.25rem', color: '#f87171' }} />
              ) : (
                <CheckCircleIcon style={{ width: '1.25rem', height: '1.25rem', color: '#34d399' }} />
              )}
              <h4>{popupStats.title}</h4>
            </div>
            <p className="deck-sync-alert-msg">{popupStats.message}</p>

            {popupStats.stats && (
              <div className="deck-sync-stat-pills">
                <span className="stat-pill-add">Added / Updated: <strong>+{popupStats.stats.added}</strong></span>
                <span className="stat-pill-rem">Removed: <strong>-{popupStats.stats.removed}</strong></span>
                <span className="stat-pill-ign">Ignored: <strong>{popupStats.stats.ignored}</strong></span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPopupStats(null)}
            className="deck-alert-close-btn"
            title="Dismiss notification"
          >
            <XMarkIcon style={{ width: '1.2rem', height: '1.2rem' }} />
          </button>
        </div>
      )}

      {/* Crystal Stats Summary Bar */}
      {decks.length > 0 && (
        <div className="deck-hub-summary-bar">
          <div className="deck-stat-crystal">
            <div className="deck-stat-crystal-icon indigo">
              <Square2StackIcon style={{ width: "1.4rem", height: "1.4rem" }} />
            </div>
            <div>
              <div className="deck-stat-val">{decks.length}</div>
              <div className="deck-stat-lbl">Total Synced Decks</div>
            </div>
          </div>

          <div className="deck-stat-crystal">
            <div className="deck-stat-crystal-icon emerald">
              <SparklesIcon style={{ width: "1.4rem", height: "1.4rem" }} />
            </div>
            <div>
              <div className="deck-stat-val">{activeCommandersCount}</div>
              <div className="deck-stat-lbl">Commanders Leading</div>
            </div>
          </div>

          <div className="deck-stat-crystal">
            <div className="deck-stat-crystal-icon purple">
              <TagIcon style={{ width: "1.4rem", height: "1.4rem" }} />
            </div>
            <div>
              <div className="deck-stat-val">{totalCardsCount > 0 ? totalCardsCount : decks.length * 100}</div>
              <div className="deck-stat-lbl">Cards in Deck Sync</div>
            </div>
          </div>

          <div className="deck-stat-crystal">
            <div className="deck-stat-crystal-icon amber">
              <QueueListIcon style={{ width: "1.4rem", height: "1.4rem" }} />
            </div>
            <div>
              <div className="deck-stat-val">{totalDemandsCount}</div>
              <div className="deck-stat-lbl">Trade / Wishlist Demands</div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Grimoire Bar */}
      {decks.length > 0 && (
        <div className="deck-hub-filter-bar">
          <div className="deck-search-box">
            <MagnifyingGlassIcon className="deck-search-icon" />
            <input
              type="text"
              placeholder="Filter by deck name, commander, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="deck-search-input"
            />
          </div>

          <div className="deck-filter-pills">
            {/* Platform Filter */}
            <button
              type="button"
              className={`filter-pill-btn ${platformFilter === 'all' ? 'active' : ''}`}
              onClick={() => setPlatformFilter('all')}
            >
              All Platforms
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${platformFilter === 'moxfield' ? 'active moxfield' : ''}`}
              onClick={() => setPlatformFilter('moxfield')}
            >
              Moxfield
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${platformFilter === 'archidekt' ? 'active archidekt' : ''}`}
              onClick={() => setPlatformFilter('archidekt')}
            >
              Archidekt
            </button>
          </div>

          {/* Color Identity Pills */}
          <div className="deck-filter-pills">
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginRight: '2px' }}>Color:</span>
            {['all', 'W', 'U', 'B', 'R', 'G'].map(c => (
              <button
                key={c}
                type="button"
                className={`filter-pill-btn ${colorFilter === c ? 'active' : ''}`}
                onClick={() => setColorFilter(colorFilter === c ? 'all' : c)}
                style={{ padding: '0.3rem 0.55rem', minWidth: '24px', textAlign: 'center' }}
                title={`Filter by ${c === 'all' ? 'All Colors' : c}`}
              >
                {c === 'all' ? 'Any' : c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#94a3b8" }}>
          <ArrowPathIcon className="icon-spin" style={{ width: "2.5rem", height: "2.5rem", margin: "0 auto 1rem auto", color: "#818cf8" }} />
          <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#cbd5e1" }}>Summoning your synchronized decks...</div>
          <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.4rem" }}>Gathering commander art and remote manifests</p>
        </div>
      ) : error ? (
        <div style={{ padding: "2rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "12px", color: "#fca5a5", textAlign: "center" }}>
          <ExclamationTriangleIcon style={{ width: "2rem", height: "2rem", margin: "0 auto 0.5rem auto", color: "#ef4444" }} />
          <div style={{ fontWeight: 700 }}>{error}</div>
        </div>
      ) : decks.length === 0 ? (
        <div className="deck-hub-empty-state">
          <div className="deck-empty-icon-halo">
            <ArchiveBoxIcon style={{ width: "2rem", height: "2rem" }} />
          </div>
          <h3 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#f8fafc" }}>No Decks Synced Yet</h3>
          <p style={{ color: "#94a3b8", maxWidth: "450px", margin: "0 auto 1.75rem auto", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Import your first deck from Archidekt or Moxfield to manage your MTG collection, commanders, and automated proxy queues seamlessly.
          </p>
          <button
            type="button"
            onClick={() => handleOpenImporter()}
            className="mystic-btn mystic-btn-primary"
          >
            <PlusIcon style={{ width: "1.15em", height: "1.15em" }} />
            <span>Import Your First Deck</span>
          </button>
        </div>
      ) : visibleDecks.length === 0 ? (
        <div className="deck-hub-empty-state">
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#cbd5e1" }}>No Decks Match Your Filter</h3>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "1rem" }}>Try clearing your search query or color filters.</p>
          <button
            type="button"
            onClick={() => { setSearchQuery(""); setPlatformFilter("all"); setStatusFilter("all"); setColorFilter("all"); }}
            className="mystic-btn mystic-btn-secondary"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="deck-grid">
          {visibleDecks.map(deck => (
            <DeckCardItem
              key={deck.id}
              deck={deck}
              commanderMeta={deck.commander ? commanderCache[deck.commander] : null}
              syncing={syncingAll || syncingId === deck.deck_id}
              onQuickSync={() => handleQuickResync(deck)}
              onOpenImporter={() => handleOpenImporter(deck)}
              onHoverCard={setHoveredPreviewCard}
            />
          ))}
        </div>
      )}

      {/* Archived Decks Section */}
      {archivedDecks.length > 0 && (
        <div style={{ marginTop: '3.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '2rem' }}>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="mystic-btn mystic-btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            <ArchiveBoxIcon style={{ width: "1.1em", height: "1.1em" }} />
            <span>{showArchived ? "Hide Archived Decks" : `Show Archived Decks (${archivedDecks.length})`}</span>
          </button>

          {showArchived && (
            <div className="deck-grid" style={{ marginTop: '1.5rem', opacity: 0.85 }}>
              {archivedDecks.map(deck => (
                <DeckCardItem
                  key={deck.id}
                  deck={deck}
                  commanderMeta={deck.commander ? commanderCache[deck.commander] : null}
                  syncing={syncingAll || syncingId === deck.deck_id}
                  onQuickSync={() => handleQuickResync(deck)}
                  onOpenImporter={() => handleOpenImporter(deck)}
                  onHoverCard={setHoveredPreviewCard}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Interactive Card Preview Portal */}
      {hoveredPreviewCard && (
        <div
          className="floating-mystic-card-preview"
          style={{
            left: `${Math.min(typeof window !== 'undefined' ? window.innerWidth - 280 : 800, Math.max(10, hoveredPreviewCard.x || 100))}px`,
            top: `${Math.min(typeof window !== 'undefined' ? window.innerHeight - 420 : 600, Math.max(10, hoveredPreviewCard.y || 100))}px`,
          }}
        >
          <div className="mystic-card-portal-inner">
            {hoveredPreviewCard.image_url ? (
              <img
                src={hoveredPreviewCard.image_url}
                alt={hoveredPreviewCard.card_name}
                className="portal-card-img"
              />
            ) : (
              <div className="portal-no-img">
                <SparklesIcon style={{ width: '2.5rem', height: '2.5rem', color: '#818cf8' }} />
                <span>{hoveredPreviewCard.card_name}</span>
              </div>
            )}
            <div className="portal-card-meta">
              <div className="portal-meta-title">{hoveredPreviewCard.card_name}</div>
              {hoveredPreviewCard.type_line && (
                <div className="portal-meta-sub">{hoveredPreviewCard.type_line}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Beautified Deck Card Component with Blurred Commander Art Backdrop
 */
function DeckCardItem({ deck, commanderMeta, syncing, onQuickSync, onOpenImporter, onHoverCard }) {
  const isMoxfield = deck.source === "moxfield";
  const remoteUrl = isMoxfield
    ? `https://www.moxfield.com/decks/${deck.deck_id}`
    : `https://archidekt.com/decks/${deck.deck_id}/`;

  // Commander Artwork extraction (art_crop for backdrop blur, normal/large for portal)
  const commanderArtCrop = commanderMeta?.image_uris?.art_crop
    || commanderMeta?.card_faces?.[0]?.image_uris?.art_crop
    || commanderMeta?.image_uris?.normal
    || null;

  const commanderThumb = commanderMeta?.image_uris?.small
    || commanderMeta?.image_uris?.art_crop
    || commanderMeta?.card_faces?.[0]?.image_uris?.small
    || null;

  const commanderLarge = commanderMeta?.image_uris?.normal
    || commanderMeta?.image_uris?.large
    || commanderMeta?.card_faces?.[0]?.image_uris?.normal
    || commanderThumb;

  const colorIdentity = commanderMeta?.color_identity || [];
  const cardCount = typeof deck.cards === 'string'
    ? JSON.parse(deck.cards || "[]").length
    : (deck.cards?.length || 100);

  return (
    <div className={`deck-card-frame ${deck.status === 'disabled' ? 'disabled' : ''}`}>
      {/* Blurred Commander Art Backdrop */}
      {commanderArtCrop && (
        <div
          className="deck-card-backdrop"
          style={{ backgroundImage: `url(${commanderArtCrop})` }}
        />
      )}

      {/* Dark Mystic Gradient Overlay */}
      <div className="deck-card-gradient-overlay" />

      {/* Card Content */}
      <div className="deck-card-content">
        {/* Commander Header Banner */}
        {deck.commander ? (
          <div className="deck-commander-bar">
            <div className="commander-info-meta">
              <div className="commander-eyebrow-row">
                <span className="commander-label-eyebrow">
                  <SparklesIcon style={{ width: '0.9rem', height: '0.9rem', display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
                  Commander
                </span>
                {commanderMeta?.mana_cost && (
                  <span className="commander-mana-pill">{commanderMeta.mana_cost}</span>
                )}
                {colorIdentity.length > 0 && (
                  <div className="deck-color-identity-bar">
                    {colorIdentity.map(c => (
                      <span key={c} className={`color-pip ${c}`} title={`Color: ${c}`}>{c}</span>
                    ))}
                  </div>
                )}
              </div>
              <div
                className="commander-name-text"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onHoverCard({
                    card_name: deck.commander,
                    image_url: commanderLarge,
                    type_line: commanderMeta?.type_line,
                    x: rect.right + 12,
                    y: rect.top - 50
                  });
                }}
                onMouseLeave={() => onHoverCard(null)}
                title={`${deck.commander} (Hover for full card scan)`}
              >
                {deck.commander}
              </div>
              {commanderMeta?.type_line && (
                <div className="commander-type-text">
                  {commanderMeta.type_line}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="deck-commander-bar no-commander">
            <div className="commander-info-meta">
              <div className="commander-eyebrow-row">
                <span className="commander-label-eyebrow">
                  <GlobeAltIcon style={{ width: '0.9rem', height: '0.9rem', display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
                  {isMoxfield ? "Moxfield List" : "Archidekt List"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Deck Title & Remote Platform Info */}
        <div>
          <div className="deck-title-row">
            <h3 className="deck-name-heading" title={deck.deck_name}>
              {deck.deck_name}
            </h3>
            <span className={`deck-platform-pill ${isMoxfield ? 'moxfield' : 'archidekt'}`}>
              {isMoxfield ? 'Moxfield' : 'Archidekt'}
            </span>
          </div>
        </div>

        {/* Meta Grid */}
        <div className="deck-meta-grid">
          <div className="deck-meta-item">
            Cards: <strong>{cardCount}</strong>
          </div>
          <div className="deck-meta-item">
            Synced: <strong>{formatRelativeTime(deck.updated_at)}</strong>
          </div>
          <div className="deck-meta-item">
            Access: <strong>{deck.is_public ? "Public" : "Private"}</strong>
          </div>
          <div className="deck-meta-item">
            {deck.status === 'disabled' ? (
              <span className="deck-status-disabled-chip" title="Cards were removed when proxy list was cleared. Resync to re-add.">
                <ExclamationTriangleIcon style={{ width: '1.05em', height: '1.05em' }} /> Disabled
              </span>
            ) : (
              <span>Status: <strong style={{ color: "#34d399", textTransform: "capitalize" }}>{deck.status || "active"}</strong></span>
            )}
          </div>
        </div>

        {/* Action Buttons Cluster */}
        <div className="deck-action-cluster">
          <button
            type="button"
            onClick={onQuickSync}
            disabled={syncing}
            className={`deck-action-btn-sync ${deck.status === 'disabled' ? 'disabled-resync' : ''}`}
            title={deck.status === 'disabled' ? "Click to resync and re-enable this deck's cards" : "Resync deck now"}
          >
            <ArrowPathIcon className={syncing ? "icon-spin" : ""} style={{ width: "1.1em", height: "1.1em" }} />
            <span>
              {syncing
                ? "Syncing..."
                : (deck.status === 'disabled' ? "Re-Enable & Sync" : "Quick Sync")}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenImporter}
            disabled={syncing}
            className="deck-icon-btn"
            title="Edit tag mappings & deck sync settings"
          >
            <Cog6ToothIcon style={{ width: "1.15em", height: "1.15em" }} />
          </button>

          <a
            href={remoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="deck-icon-btn"
            title={`Open deck on ${isMoxfield ? 'Moxfield' : 'Archidekt'}`}
          >
            <ArrowTopRightOnSquareIcon style={{ width: "1.15em", height: "1.15em" }} />
          </a>
        </div>

        {/* Dropdown for Requested Cards */}
        <DeckRequestedCardsDropdown deck={deck} onHoverCard={onHoverCard} />
      </div>
    </div>
  );
}

/**
 * Beautified Accordion for Cards requested or managed by this deck
 */
function DeckRequestedCardsDropdown({ deck, onHoverCard }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("requested"); // "requested", "wishlist", "tradelist", "owned", "all"
  const [searchTerm, setSearchTerm] = useState("");

  const items = deck.items || [];
  const wishlistItems = items.filter(i => i.list_type === "wishlist");
  const tradelistItems = items.filter(i => i.list_type === "tradelist");
  const ownedItems = items.filter(i => i.list_type === "owned");
  const requestedItems = items.filter(i => i.list_type === "wishlist" || i.list_type === "tradelist");

  const totalRequestedCount = requestedItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
  const wishlistCount = wishlistItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
  const tradelistCount = tradelistItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
  const ownedCount = ownedItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
  const totalAllCount = items.reduce((sum, i) => sum + (i.quantity || 1), 0);

  let effectiveFilter = activeFilter;
  if (requestedItems.length === 0 && ownedItems.length > 0 && activeFilter === "requested") {
    effectiveFilter = "all";
  }

  let displayedItems = [];
  if (effectiveFilter === "requested") displayedItems = requestedItems;
  else if (effectiveFilter === "wishlist") displayedItems = wishlistItems;
  else if (effectiveFilter === "tradelist") displayedItems = tradelistItems;
  else if (effectiveFilter === "owned") displayedItems = ownedItems;
  else displayedItems = items;

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    displayedItems = displayedItems.filter(i =>
      (i.card_name && i.card_name.toLowerCase().includes(term)) ||
      (i.set_code && i.set_code.toLowerCase().includes(term))
    );
  }

  const sortedItems = [...displayedItems].sort((a, b) => (a.card_name || "").localeCompare(b.card_name || ""));

  return (
    <div className="requested-cards-dropdown-container">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`requested-cards-toggle-btn ${isOpen ? 'open' : ''}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <QueueListIcon style={{ width: '1.15em', height: '1.15em', color: totalRequestedCount > 0 ? '#60a5fa' : '#9ca3af' }} />
          <span>Cards ({totalRequestedCount > 0 ? `${totalRequestedCount} Requested` : `${totalAllCount} Tracked`})</span>
          {wishlistCount > 0 && (
            <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(168, 85, 247, 0.25)', color: '#d8b4fe', fontWeight: 'bold' }}>
              {wishlistCount} Wish
            </span>
          )}
          {tradelistCount > 0 && (
            <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(234, 179, 8, 0.25)', color: '#fde047', fontWeight: 'bold' }}>
              {tradelistCount} Trade
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUpIcon style={{ width: '1.1em', height: '1.1em', color: '#94a3b8', flexShrink: 0 }} />
        ) : (
          <ChevronDownIcon style={{ width: '1.1em', height: '1.1em', color: '#94a3b8', flexShrink: 0 }} />
        )}
      </button>

      {isOpen && (
        <div className="requested-cards-drawer">
          {/* Filter Pills */}
          {items.length > 0 && (
            <div className="drawer-filter-pills">
              {requestedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter("requested")}
                  className={`drawer-pill-btn ${effectiveFilter === 'requested' ? 'active requested' : ''}`}
                >
                  Requested ({totalRequestedCount})
                </button>
              )}
              {wishlistItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter("wishlist")}
                  className={`drawer-pill-btn ${effectiveFilter === 'wishlist' ? 'active wishlist' : ''}`}
                >
                  Wishlist ({wishlistCount})
                </button>
              )}
              {tradelistItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter("tradelist")}
                  className={`drawer-pill-btn ${effectiveFilter === 'tradelist' ? 'active tradelist' : ''}`}
                >
                  Tradelist ({tradelistCount})
                </button>
              )}
              {ownedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter("owned")}
                  className={`drawer-pill-btn ${effectiveFilter === 'owned' ? 'active owned' : ''}`}
                >
                  Collection ({ownedCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`drawer-pill-btn ${effectiveFilter === 'all' ? 'active all' : ''}`}
              >
                All ({totalAllCount})
              </button>
            </div>
          )}

          {/* Quick Search */}
          {items.length > 5 && (
            <input
              type="text"
              placeholder="Search cards in this deck..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="drawer-search-input"
            />
          )}

          {/* Cards Scroll List */}
          {sortedItems.length === 0 ? (
            <div style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>
              {searchTerm ? "No cards match search." : "No cards in this category."}
            </div>
          ) : (
            <div className="drawer-card-scroll-list">
              {sortedItems.map((item, idx) => (
                <div
                  key={`${item.card_name}-${item.list_type}-${item.set_code}-${idx}`}
                  className="drawer-card-item-row"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
                    <span style={{
                      background: '#334155',
                      color: '#93c5fd',
                      fontSize: '0.72rem',
                      fontWeight: 'bold',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      flexShrink: 0
                    }}>
                      {item.quantity}×
                    </span>
                    <a
                      href={`https://scryfall.com/search?q=${encodeURIComponent(item.card_name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Search "${item.card_name}" on Scryfall`}
                      className="drawer-card-link"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onHoverCard({
                          card_name: item.card_name,
                          image_url: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(item.card_name)}&format=image`,
                          x: rect.right + 12,
                          y: rect.top - 50
                        });
                      }}
                      onMouseLeave={() => onHoverCard(null)}
                    >
                      {item.card_name}
                    </a>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    {item.set_code && (
                      <span style={{
                        fontSize: '0.68rem',
                        background: '#0f172a',
                        color: '#94a3b8',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontWeight: '600'
                      }}>
                        {item.set_code}
                      </span>
                    )}
                    {item.is_foil ? (
                      <span style={{
                        fontSize: '0.68rem',
                        background: 'rgba(234, 179, 8, 0.2)',
                        color: '#fde047',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontWeight: '600'
                      }}>
                        Foil
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
