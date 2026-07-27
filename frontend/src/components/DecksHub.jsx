import React, { useState, useEffect } from "react";
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
  const [popupStats, setPopupStats] = useState(null);

  const loadDecks = async () => {
    setLoading(true);
    try {
      const data = await api.getSavedArchidektDecks();
      setDecks(data || []);
    } catch (err) {
      setError(err.message || "Failed to load saved decks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only load decks if we are on the Hub view
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
    loadDecks(); // reload decks in case a new one was added
  };

  const handleQuickResync = async (deckId) => {
    setSyncingId(deckId);
    setPopupStats(null);
    try {
      // Passing undefined for mappings tells backend to use saved mappings
      const res = await api.syncArchidektDeck(deckId, undefined);
      setPopupStats({
        title: "Sync Complete",
        message: `Successfully synced deck ${deckId}`,
        stats: res.stats
      });
      loadDecks();
    } catch (err) {
      setPopupStats({
        title: "Sync Failed",
        message: err.message || `Failed to sync deck ${deckId}`,
        error: true
      });
    } finally {
      setSyncingId(null);
      // Auto-hide popup after 10s
      setTimeout(() => setPopupStats(null), 10000);
    }
  };

  const handleResyncAll = async () => {
    if (decks.length === 0) return;
    setSyncingAll(true);
    setPopupStats(null);
    
    let totalStats = { added: 0, removed: 0, ignored: 0 };
    let successCount = 0;
    
    try {
      for (const deck of decks) {
        setSyncingId(deck.deck_id);
        const res = await api.syncArchidektDeck(deck.deck_id, undefined);
        if (res.stats) {
          totalStats.added += (res.stats.added || 0);
          totalStats.removed += (res.stats.removed || 0);
          totalStats.ignored += (res.stats.ignored || 0);
        }
        successCount++;
      }
      setPopupStats({
        title: "Resync All Complete",
        message: `Successfully synced ${successCount} deck(s).`,
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

  if (showImporter) {
    return <DeckImporter initialDeck={importerDeck} onBack={handleCloseImporter} />;
  }

  const visibleDecks = decks.filter(d => d.status !== 'archived');
  const archivedDecks = decks.filter(d => d.status === 'archived');

  return (
    <div className="main-content" style={{ padding: '2rem' }}>
      <div className="section-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Archidekt Sync Hub</h2>
          <p style={{ color: '#888', marginTop: '0.5rem' }}>
            Manage your synchronized Archidekt decks and import new ones.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {decks.length > 0 && (
            <button 
              onClick={handleResyncAll}
              disabled={syncingAll || syncingId !== null}
              style={{ padding: '0.75rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: (syncingAll || syncingId !== null) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {syncingAll ? "Syncing..." : "🔄 Resync All"}
            </button>
          )}
          <button 
            onClick={() => handleOpenImporter()}
            disabled={syncingAll || syncingId !== null}
            style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: (syncingAll || syncingId !== null) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            ➕ Import New Deck
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#888' }}>Loading your decks...</div>
      ) : error ? (
        <div style={{ color: '#ef4444' }}>{error}</div>
      ) : decks.length === 0 ? (
        <div style={{ background: '#1c1c1c', padding: '3rem', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <h3 style={{ marginBottom: '0.5rem' }}>No Decks Synced Yet</h3>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>
            Import your first deck from Archidekt to manage your collection and wishlist dynamically.
          </p>
          <button 
            onClick={() => handleOpenImporter()}
            style={{ padding: '0.5rem 1.5rem', background: '#2c2c2c', color: 'white', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer' }}
          >
            Import a Deck
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {visibleDecks.map(deck => (
            <div key={deck.id} style={{ background: '#1c1c1c', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#60a5fa', flex: 1, paddingRight: '1rem', wordBreak: 'break-word' }}>{deck.deck_name}</h3>
                <span style={{ fontSize: '0.8rem', color: '#666', background: '#222', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  ID: {deck.deck_id}
                </span>
              </div>
              
              <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1.5rem', flex: 1 }}>
                Last Synced: {new Date(deck.updated_at).toLocaleString()}
                <br/>
                Status: <strong>{deck.status || "active"}</strong> | Privacy: <strong>{deck.is_public ? "Public" : "Private"}</strong>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => handleQuickResync(deck.deck_id)}
                  disabled={syncingAll || syncingId === deck.deck_id || deck.status === 'disabled'}
                  style={{ flex: 1, padding: '0.5rem', background: '#2c2c2c', color: 'white', border: '1px solid #444', borderRadius: '4px', cursor: (syncingAll || syncingId === deck.deck_id || deck.status === 'disabled') ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}
                  title={deck.status === 'disabled' ? "Disabled decks cannot be quick-resynced." : ""}
                >
                  <span>🔄</span> {(syncingAll || syncingId === deck.deck_id) ? "Syncing..." : "Resync"}
                </button>
                <button 
                  onClick={() => handleOpenImporter(deck)}
                  disabled={syncingAll || syncingId !== null}
                  style={{ flex: 1, padding: '0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: (syncingAll || syncingId !== null) ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}
                >
                  ⚙️ Edit Options
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {archivedDecks.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <button 
            onClick={() => setShowArchived(!showArchived)}
            style={{ width: '100%', padding: '0.75rem', background: '#1c1c1c', color: '#888', border: '1px dashed #444', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>Archived Decks ({archivedDecks.length})</span>
            <span>{showArchived ? '▲' : '▼'}</span>
          </button>
          
          {showArchived && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem', opacity: 0.6 }}>
              {archivedDecks.map(deck => (
                <div key={deck.id} style={{ background: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, color: '#60a5fa', flex: 1, paddingRight: '1rem', wordBreak: 'break-word' }}>{deck.deck_name}</h3>
                    <span style={{ fontSize: '0.8rem', color: '#666', background: '#222', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      ID: {deck.deck_id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleOpenImporter(deck)}
                      style={{ flex: 1, padding: '0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}
                    >
                      ⚙️ Edit Options
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Popup Stats Toast */}
      {popupStats && (
        <div style={{ 
          position: 'fixed', 
          bottom: '2rem', 
          right: '2rem', 
          background: popupStats.error ? '#450a0a' : '#064e3b', 
          border: `1px solid ${popupStats.error ? '#ef4444' : '#10b981'}`,
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 9999,
          minWidth: '250px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, color: popupStats.error ? '#f87171' : '#34d399' }}>{popupStats.title}</h3>
            <button 
              onClick={() => setPopupStats(null)} 
              style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#cbd5e1' }}>{popupStats.message}</p>
          
          {popupStats.stats && (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#a7f3d0' }}>
              <li>Cards Added/Moved: <strong>+{popupStats.stats.added}</strong></li>
              <li>Cards Removed: <strong>-{popupStats.stats.removed}</strong></li>
              <li>Cards Ignored: <strong>{popupStats.stats.ignored}</strong></li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
