import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import "../styles.css";

const MAPPING_OPTIONS = [
  { value: "wishlist", label: "Add to Wishlist (need proxy OR real)" },
  { value: "tradelist", label: "Add to Tradelist (need real)" },
  { value: "ignore", label: "Ignore" },
  { value: "owned", label: "Add to Collection (Others can trade for)" }
];

export default function DecksManager() {
  const { user } = useAuth();
  const [deckId, setDeckId] = useState("");
  const [deckInfo, setDeckInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [tagMappings, setTagMappings] = useState({});
  const [uniqueTags, setUniqueTags] = useState([]);
  
  const [syncStatus, setSyncStatus] = useState(null);

  // Load saved config on mount
  useEffect(() => {
    if (user?.archidekt_tag_mappings) {
      setTagMappings(user.archidekt_tag_mappings);
    }
  }, [user]);

  const handlePreview = async () => {
    if (!deckId) return;
    setLoading(true);
    setError(null);
    setSyncStatus(null);
    try {
      // parse ID if it's a full URL
      let parsedId = deckId.trim();
      if (parsedId.includes('archidekt.com/decks/')) {
        const parts = parsedId.split('archidekt.com/decks/');
        const idPart = parts[1].split('/')[0];
        parsedId = idPart;
        setDeckId(parsedId);
      }
      
      const info = await api.getArchidektDeckInfo(parsedId);
      setDeckInfo(info);
      
      // Extract unique color tags (from label)
      const tags = new Set();
      info.cards?.forEach(item => {
        let labelName = (item.label || "").split(',')[0].trim();
        if (!labelName) labelName = "Default color tag";
        tags.add(labelName);
      });
      setUniqueTags(Array.from(tags).sort());
      
    } catch (err) {
      setError(err.message || "Failed to load deck from Archidekt");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await api.updateArchidektConfig({ tag_mappings: tagMappings });
      alert("Tag mappings saved as default for future syncs!");
    } catch (err) {
      alert("Failed to save config: " + err.message);
    }
  };

  const handleSync = async () => {
    if (!deckInfo) return;
    setLoading(true);
    setSyncStatus(null);
    try {
      const res = await api.syncArchidektDeck(deckInfo.id, tagMappings);
      setSyncStatus({
        success: true,
        message: res.message,
        stats: res.stats
      });
    } catch (err) {
      setSyncStatus({
        success: false,
        message: err.message || "Failed to sync deck"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content" style={{ padding: '2rem' }}>
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <h2>Archidekt Sync Manager</h2>
        <p style={{ color: '#888', marginTop: '0.5rem' }}>
          Import your decks from Archidekt and map custom tags to your Manabase collection lists.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Left Column: Deck Import */}
        <div style={{ background: '#1c1c1c', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333' }}>
          <h3>Import a Deck</h3>
          <p style={{ color: '#888', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Enter an Archidekt Deck ID or URL to preview its cards and tags.
          </p>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input 
              type="text" 
              placeholder="e.g. 21190823 or archidekt.com/decks/..." 
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', background: '#2c2c2c', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
            />
            <button 
              onClick={handlePreview} 
              disabled={loading || !deckId}
              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading && !deckInfo ? "Loading..." : "Preview"}
            </button>
          </div>
          
          {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

          {deckInfo && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '4px' }}>
              <h4 style={{ color: '#60a5fa', marginBottom: '0.5rem' }}>{deckInfo.name}</h4>
              <p style={{ fontSize: '0.9rem', color: '#aaa' }}>
                Found <strong>{deckInfo.cards?.length || 0}</strong> card entries.
                <br/>
                Found <strong>{uniqueTags.length}</strong> unique color tags.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Tag Mappings */}
        <div style={{ background: '#1c1c1c', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Tag Mappings</h3>
            <button 
              onClick={handleSaveConfig}
              style={{ padding: '0.4rem 0.8rem', background: '#2c2c2c', color: 'white', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              💾 Save Defaults
            </button>
          </div>
          <p style={{ color: '#888', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Map the Color Tags from your deck to actions in Manabase.
          </p>

          {!deckInfo ? (
            <div style={{ color: '#666', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>
              Preview a deck first to see its tags.
            </div>
          ) : uniqueTags.length === 0 ? (
            <div style={{ color: '#666', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>
              No color tags found in this deck. All cards will be ignored unless mapped.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
              {uniqueTags.map(tag => (
                <div key={tag} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#252525', padding: '0.75rem', borderRadius: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#e5e5e5' }}>{tag}</span>
                  <select
                    value={tagMappings[tag] || "ignore"}
                    onChange={(e) => setTagMappings(prev => ({ ...prev, [tag]: e.target.value }))}
                    style={{ padding: '0.4rem', background: '#111', color: 'white', border: '1px solid #444', borderRadius: '4px', minWidth: '150px' }}
                  >
                    {MAPPING_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {deckInfo && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
              <button 
                onClick={handleSync}
                disabled={loading}
                style={{ width: '100%', padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? "Syncing..." : "🔄 Sync Deck to Manabase"}
              </button>
            </div>
          )}

          {syncStatus && (
            <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '4px', background: syncStatus.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${syncStatus.success ? '#10b981' : '#ef4444'}` }}>
              <h4 style={{ color: syncStatus.success ? '#10b981' : '#ef4444', marginBottom: '0.5rem' }}>
                {syncStatus.success ? "Sync Complete!" : "Sync Failed"}
              </h4>
              <p style={{ fontSize: '0.9rem', color: '#ccc' }}>{syncStatus.message}</p>
              
              {syncStatus.stats && (
                <ul style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#aaa', paddingLeft: '1.2rem' }}>
                  <li>Added to Collection (Owned): <strong>{syncStatus.stats.ownedAdded}</strong></li>
                  <li>Added to Wishlist: <strong>{syncStatus.stats.wishlistAdded}</strong></li>
                  <li>Added to Tradelist: <strong>{syncStatus.stats.tradelistAdded}</strong></li>
                  <li>Ignored: <strong>{syncStatus.stats.ignored}</strong></li>
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
