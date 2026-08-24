import React, { useState, useEffect } from "react";
import { 
  ArrowPathIcon, 
  PlusIcon, 
  ArchiveBoxIcon, 
  Cog6ToothIcon, 
  ArrowUturnLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  QueueListIcon
} from "@heroicons/react/24/solid";

import { api } from "../api/client";
import DeckImporter from "./DeckImporter";
import "../styles.css";

export default function DecksHub() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State to manage importer view
  const [showImporter, setShowImporter] = useState(false);
  const [importerDeck, setImporterDeck] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  
  // State for syncing
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [popupStats, setPopupStats] = useState(null);

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

  if (showImporter) {
    return <DeckImporter initialDeck={importerDeck} onBack={handleCloseImporter} />;
  }

  const visibleDecks = decks.filter(d => d.status !== 'archived');
  const archivedDecks = decks.filter(d => d.status === 'archived');

  return (
    <div className="main-content" style={{ padding: '2rem' }}>
      <div className="section-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Deck Sync Hub</h2>
          <p style={{ color: '#888', marginTop: '0.5rem' }}>
            Manage your synchronized Archidekt & Moxfield decks and import new ones.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {decks.length > 0 && (
            <>
              <button 
                onClick={handleResyncAll}
                disabled={syncingAll || syncingId !== null || refreshing}
                style={{ padding: '0.75rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: (syncingAll || syncingId !== null || refreshing) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
              >
                {syncingAll ? "Syncing..." : <><ArrowPathIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} /> Resync All</>}
              </button>
              <button
                onClick={handleRefreshLists}
                disabled={syncingAll || syncingId !== null || refreshing}
                title="Clears tradelist and wishlist cards from your decks, then re-adds them fresh."
                style={{ padding: '0.75rem 1.5rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: (syncingAll || syncingId !== null || refreshing) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
              >
                {refreshing
                  ? "Refreshing..."
                  : <><ArrowUturnLeftIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} /> Refresh</>}
              </button>
            </>
          )}
          <button 
            onClick={() => handleOpenImporter()}
            disabled={syncingAll || syncingId !== null}
            style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: (syncingAll || syncingId !== null) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            <PlusIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} /> Import New Deck
          </button>
        </div>
      </div>

      {/* Global Sync Notification Popup */}
      {popupStats && (
        <div style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem 1.5rem', 
          borderRadius: '8px', 
          background: popupStats.error ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
          border: `1px solid ${popupStats.error ? '#ef4444' : '#10b981'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', color: popupStats.error ? '#ef4444' : '#10b981' }}>
              {popupStats.title}
            </h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc' }}>{popupStats.message}</p>

            {popupStats.stats && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#10b981' }}>Added/Updated: <strong>+{popupStats.stats.added}</strong></span>
                <span style={{ color: '#ef4444' }}>Removed: <strong>-{popupStats.stats.removed}</strong></span>
                <span style={{ color: '#aaa' }}>Ignored: <strong>{popupStats.stats.ignored}</strong></span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setPopupStats(null)}
            style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#888' }}>Loading your decks...</div>
      ) : error ? (
        <div style={{ color: '#ef4444' }}>{error}</div>
      ) : decks.length === 0 ? (
        <div style={{ background: '#1c1c1c', padding: '3rem', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}><ArchiveBoxIcon style={{ width: "3rem", height: "3rem" }} /></div>
          <h3 style={{ marginBottom: '0.5rem' }}>No Decks Synced Yet</h3>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>
            Import your first deck from Archidekt or Moxfield to manage your collection and wishlist dynamically.
          </p>
          <button 
            onClick={() => handleOpenImporter()}
            style={{ padding: '0.5rem 1.5rem', background: '#2c2c2c', color: 'white', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer' }}
          >
            Import a Deck
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {visibleDecks.map(deck => (
            <div key={deck.id} style={{ 
              background: '#1c1c1c', 
              padding: '1.5rem', 
              borderRadius: '8px', 
              border: `1px solid ${deck.status === 'disabled' ? '#f59e0b' : '#333'}`, 
              display: 'flex', 
              flexDirection: 'column',
              opacity: deck.status === 'disabled' ? 0.85 : 1
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: deck.source === 'moxfield' ? '#34d399' : '#60a5fa', flex: 1, paddingRight: '1rem', wordBreak: 'break-word' }}>
                  {deck.deck_name}
                  <span style={{ 
                    display: 'inline-block', 
                    marginLeft: '0.5rem', 
                    background: deck.source === 'moxfield' ? '#065f46' : '#1e3a8a', 
                    color: 'white', 
                    fontSize: '0.65rem', 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    fontWeight: 'bold', 
                    verticalAlign: 'middle'
                  }}>
                    {deck.source === 'moxfield' ? 'Moxfield' : 'Archidekt'}
                  </span>
                  {deck.status === 'disabled' && (
                    <span 
                       title="Cards from this deck were removed when you cleared your proxy list. Resync to re-add them."
                      style={{ 
                        display: 'inline-block', 
                        marginLeft: '0.5rem', 
                        background: '#92400e', 
                        color: '#fbbf24', 
                        fontSize: '0.65rem', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontWeight: 'bold', 
                        verticalAlign: 'middle'
                      }}
                    >
                      DISABLED
                    </span>
                  )}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#666', background: '#222', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  ID: {deck.deck_id}
                </span>
              </div>
              
              <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1.25rem', flex: 1 }}>
                {deck.commander && <>Commander: <strong>{deck.commander}</strong><br/></>}
                Last Synced: {new Date(deck.updated_at).toLocaleString()}
                <br/>
                {deck.status === 'disabled' ? (
                  <span style={{ color: '#f59e0b' }}>
                    ⚠️ Cards disabled — resync to restore
                  </span>
                ) : (
                  <>Status: <strong>{deck.status || "active"}</strong> | Privacy: <strong>{deck.is_public ? "Public" : "Private"}</strong></>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => handleQuickResync(deck)}
                  disabled={syncingAll || syncingId === deck.deck_id}
                  style={{ 
                    flex: 1, 
                    padding: '0.5rem', 
                    background: deck.status === 'disabled' ? '#78350f' : '#2c2c2c', 
                    color: deck.status === 'disabled' ? '#fbbf24' : 'white', 
                    border: `1px solid ${deck.status === 'disabled' ? '#f59e0b' : '#444'}`, 
                    borderRadius: '4px', 
                    cursor: (syncingAll || syncingId === deck.deck_id) ? 'not-allowed' : 'pointer', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '0.5rem', 
                    alignItems: 'center',
                    fontWeight: deck.status === 'disabled' ? 'bold' : 'normal'
                  }}
                  title={deck.status === 'disabled' ? "Click to resync and re-enable this deck's cards." : ""}
                >
                  <span><ArrowPathIcon style={{ width: "1.2em", height: "1.2em" }} /></span> 
                  {(syncingAll || syncingId === deck.deck_id) 
                    ? "Syncing..." 
                    : (deck.status === 'disabled' ? "Re-Enable & Sync" : "Quick Sync")}
                </button>
                <button 
                  onClick={() => handleOpenImporter(deck)}
                  disabled={syncingAll || syncingId === deck.deck_id}
                  style={{ padding: '0.5rem 0.75rem', background: '#2c2c2c', color: 'white', border: '1px solid #444', borderRadius: '4px', cursor: (syncingAll || syncingId === deck.deck_id) ? 'not-allowed' : 'pointer' }}
                  title="Edit mappings and options"
                >
                  <Cog6ToothIcon style={{ width: "1.2em", height: "1.2em" }} />
                </button>
              </div>

              {/* Dropdown for Requested Cards */}
              <DeckRequestedCardsDropdown deck={deck} />
            </div>
          ))}
        </div>
      )}

      {archivedDecks.length > 0 && (
        <div style={{ marginTop: '3rem', borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
          <button 
            onClick={() => setShowArchived(!showArchived)}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
          >
            {showArchived ? "Hide Archived Decks" : `Show Archived Decks (${archivedDecks.length})`}
          </button>

          {showArchived && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1rem', alignItems: 'start' }}>
              {archivedDecks.map(deck => (
                <div key={deck.id} style={{ background: '#181818', padding: '1.25rem', borderRadius: '8px', border: '1px solid #282828', opacity: 0.85 }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#aaa' }}>{deck.deck_name}</h4>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.75rem' }}>
                    ID: {deck.deck_id} | Platform: {deck.source === 'moxfield' ? 'Moxfield' : 'Archidekt'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <button 
                      onClick={() => handleOpenImporter(deck)}
                      style={{ padding: '0.35rem 0.75rem', background: '#252525', color: '#ccc', border: '1px solid #3a3a3a', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      Unarchive / Edit
                    </button>
                  </div>
                  <DeckRequestedCardsDropdown deck={deck} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeckRequestedCardsDropdown({ deck }) {
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

  // If there are no requested items but there are owned items, default filter to all
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

  // Sort displayed items alphabetically by card name
  const sortedItems = [...displayedItems].sort((a, b) => (a.card_name || "").localeCompare(b.card_name || ""));

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid #2d2d2d', paddingTop: '0.85rem' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          background: isOpen ? '#232733' : '#1a1d24',
          border: `1px solid ${isOpen ? '#3b82f6' : '#333a48'}`,
          borderRadius: '6px',
          color: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: '600',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <QueueListIcon style={{ width: '1.15em', height: '1.15em', color: totalRequestedCount > 0 ? '#60a5fa' : '#9ca3af' }} />
          <span>Requested Cards ({totalRequestedCount})</span>
          {wishlistCount > 0 && (
            <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(168, 85, 247, 0.25)', color: '#d8b4fe', fontWeight: 'bold' }}>
              {wishlistCount} Wishlist
            </span>
          )}
          {tradelistCount > 0 && (
            <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(234, 179, 8, 0.25)', color: '#fde047', fontWeight: 'bold' }}>
              {tradelistCount} Trade
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUpIcon style={{ width: '1.1em', height: '1.1em', color: '#9ca3af', flexShrink: 0 }} />
        ) : (
          <ChevronDownIcon style={{ width: '1.1em', height: '1.1em', color: '#9ca3af', flexShrink: 0 }} />
        )}
      </button>

      {isOpen && (
        <div style={{
          marginTop: '0.5rem',
          background: '#13151b',
          border: '1px solid #28303f',
          borderRadius: '6px',
          padding: '0.75rem',
          fontSize: '0.82rem'
        }}>
          {/* Filter Pills if multiple categories exist */}
          {items.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.65rem' }}>
              {requestedItems.length > 0 && (
                <button
                  onClick={() => setActiveFilter("requested")}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: effectiveFilter === 'requested' ? '#3b82f6' : '#2e384d',
                    background: effectiveFilter === 'requested' ? 'rgba(59, 130, 246, 0.25)' : '#1a202c',
                    color: effectiveFilter === 'requested' ? '#93c5fd' : '#94a3b8',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontWeight: effectiveFilter === 'requested' ? 'bold' : 'normal'
                  }}
                >
                  Requested ({totalRequestedCount})
                </button>
              )}
              {wishlistItems.length > 0 && (
                <button
                  onClick={() => setActiveFilter("wishlist")}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: effectiveFilter === 'wishlist' ? '#a855f7' : '#2e384d',
                    background: effectiveFilter === 'wishlist' ? 'rgba(168, 85, 247, 0.25)' : '#1a202c',
                    color: effectiveFilter === 'wishlist' ? '#d8b4fe' : '#94a3b8',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontWeight: effectiveFilter === 'wishlist' ? 'bold' : 'normal'
                  }}
                >
                  Wishlist ({wishlistCount})
                </button>
              )}
              {tradelistItems.length > 0 && (
                <button
                  onClick={() => setActiveFilter("tradelist")}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: effectiveFilter === 'tradelist' ? '#eab308' : '#2e384d',
                    background: effectiveFilter === 'tradelist' ? 'rgba(234, 179, 8, 0.25)' : '#1a202c',
                    color: effectiveFilter === 'tradelist' ? '#fde047' : '#94a3b8',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontWeight: effectiveFilter === 'tradelist' ? 'bold' : 'normal'
                  }}
                >
                  Tradelist ({tradelistCount})
                </button>
              )}
              {ownedItems.length > 0 && (
                <button
                  onClick={() => setActiveFilter("owned")}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: effectiveFilter === 'owned' ? '#10b981' : '#2e384d',
                    background: effectiveFilter === 'owned' ? 'rgba(16, 185, 129, 0.25)' : '#1a202c',
                    color: effectiveFilter === 'owned' ? '#6ee7b7' : '#94a3b8',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontWeight: effectiveFilter === 'owned' ? 'bold' : 'normal'
                  }}
                >
                  Collection ({ownedCount})
                </button>
              )}
              <button
                onClick={() => setActiveFilter("all")}
                style={{
                  padding: '2px 7px',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: effectiveFilter === 'all' ? '#64748b' : '#2e384d',
                  background: effectiveFilter === 'all' ? 'rgba(100, 116, 139, 0.25)' : '#1a202c',
                  color: effectiveFilter === 'all' ? '#cbd5e1' : '#94a3b8',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: effectiveFilter === 'all' ? 'bold' : 'normal'
                }}
              >
                All ({totalAllCount})
              </button>
            </div>
          )}

          {/* Quick search input if more than 5 cards */}
          {items.length > 5 && (
            <input
              type="text"
              placeholder="Search cards in this deck..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.35rem 0.6rem',
                background: '#0a0c10',
                border: '1px solid #2d3748',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '0.75rem',
                marginBottom: '0.5rem',
                boxSizing: 'border-box'
              }}
            />
          )}

          {/* Card list */}
          {sortedItems.length === 0 ? (
            <div style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>
              {searchTerm ? "No cards match search." : "No cards requested for this deck."}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: '2px'
            }}>
              {sortedItems.map((item, idx) => (
                <div
                  key={`${item.card_name}-${item.list_type}-${item.set_code}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    padding: '0.35rem 0.5rem',
                    background: '#1b1f2b',
                    borderRadius: '4px',
                    border: '1px solid #252c3d'
                  }}
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
                      style={{
                        color: '#f1f5f9',
                        textDecoration: 'none',
                        fontWeight: '500',
                        fontSize: '0.8rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#f1f5f9'}
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
                    {item.is_foil && (
                      <span style={{
                        fontSize: '0.68rem',
                        background: 'rgba(234, 179, 8, 0.2)',
                        color: '#fde047',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontWeight: '600'
                      }}>
                        ✨ Foil
                      </span>
                    )}
                    {item.list_type === 'wishlist' ? (
                      <span style={{
                        fontSize: '0.65rem',
                        background: 'rgba(168, 85, 247, 0.2)',
                        color: '#c084fc',
                        border: '1px solid rgba(168, 85, 247, 0.5)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 'bold'
                      }}>
                        Wishlist
                      </span>
                    ) : item.list_type === 'tradelist' ? (
                      <span style={{
                        fontSize: '0.65rem',
                        background: 'rgba(234, 179, 8, 0.2)',
                        color: '#facc15',
                        border: '1px solid rgba(234, 179, 8, 0.5)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 'bold'
                      }}>
                        Tradelist
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.65rem',
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.5)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 'bold'
                      }}>
                        Collection
                      </span>
                    )}
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
