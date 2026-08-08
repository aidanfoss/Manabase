import React, { useState, useEffect } from "react";
import { ArrowPathIcon, DocumentArrowDownIcon } from "@heroicons/react/24/solid";

import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

import "../styles.css";

const MAPPING_OPTIONS = [
  { value: "wishlist", label: "Add to Wishlist (need proxy OR real)" },
  { value: "tradelist", label: "Add to Tradelist (need real)" },
  { value: "ignore", label: "Ignore" },
  { value: "owned", label: "Add to Collection (Others can trade for)" }
];

export default function DeckImporter({ initialDeck = null, onBack }) {
  const { user } = useAuth();
  const [platform, setPlatform] = useState(initialDeck ? (initialDeck.source || "archidekt") : "archidekt");
  const [deckId, setDeckId] = useState(initialDeck ? initialDeck.deck_id : "");
  const [deckInfo, setDeckInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [tagMappings, setTagMappings] = useState({});
  const [uniqueTags, setUniqueTags] = useState([]);

  // Options state
  const [isPublic, setIsPublic] = useState(initialDeck ? !!initialDeck.is_public : false);
  const [status, setStatus] = useState(initialDeck ? initialDeck.status || "active" : "active");
  const [optionsSaving, setOptionsSaving] = useState(false);

  const [syncStatus, setSyncStatus] = useState(null);

  // Load saved config when platform or user changes
  useEffect(() => {
    if (platform === "moxfield") {
      if (user?.moxfield_tag_mappings) {
        setTagMappings(user.moxfield_tag_mappings);
      } else {
        setTagMappings({});
      }
    } else {
      if (user?.archidekt_tag_mappings) {
        setTagMappings(user.archidekt_tag_mappings);
      } else {
        setTagMappings({});
      }
    }
  }, [user, platform]);

  // Handle deck URL input change with auto-platform detection
  const handleInputChange = (e) => {
    const val = e.target.value;
    setDeckId(val);
    if (val.includes("moxfield.com/decks/")) {
      setPlatform("moxfield");
    } else if (val.includes("archidekt.com/decks/")) {
      setPlatform("archidekt");
    }
  };

  // Auto-preview if initialDeck is provided
  useEffect(() => {
    if (initialDeck) {
      handlePreview();
    }
  }, [initialDeck]);

  const handlePreview = async () => {
    if (!deckId) return;
    setLoading(true);
    setError(null);
    setSyncStatus(null);
    try {
      let parsedId = deckId.trim();

      if (platform === "moxfield") {
        if (parsedId.includes("moxfield.com/decks/")) {
          parsedId = parsedId.split("moxfield.com/decks/")[1].split("/")[0].split("?")[0];
          setDeckId(parsedId);
        }
        const info = await api.getMoxfieldDeckInfo(parsedId);
        setDeckInfo(info);
        setUniqueTags(info.uniqueTags || []);
      } else {
        if (parsedId.includes("archidekt.com/decks/")) {
          parsedId = parsedId.split("archidekt.com/decks/")[1].split("/")[0];
          setDeckId(parsedId);
        }
        const info = await api.getArchidektDeckInfo(parsedId);
        setDeckInfo(info);

        const tags = new Set();
        info.cards?.forEach(item => {
          let labelName = (item.label || "").split(',')[0].trim();
          if (!labelName) labelName = "Default color tag";
          tags.add(labelName);
        });
        setUniqueTags(Array.from(tags).sort());
      }
    } catch (err) {
      setError(err.message || `Failed to load deck from ${platform === "moxfield" ? "Moxfield" : "Archidekt"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      if (platform === "moxfield") {
        await api.updateMoxfieldConfig({ tag_mappings: tagMappings });
      } else {
        await api.updateArchidektConfig({ tag_mappings: tagMappings });
      }
      alert(`${platform === "moxfield" ? "Moxfield" : "Archidekt"} tag mappings saved as default for future syncs!`);
    } catch (err) {
      alert("Failed to save config: " + err.message);
    }
  };

  const handleSaveOptions = async () => {
    if (!deckInfo) return;
    setOptionsSaving(true);
    try {
      if (platform === "moxfield") {
        await api.updateMoxfieldDeckOptions(deckInfo.id, { is_public: isPublic, status });
      } else {
        await api.updateArchidektDeckOptions(deckInfo.id, { is_public: isPublic, status });
      }
      alert("Deck options saved!");
    } catch (err) {
      alert("Failed to save options: " + err.message);
    } finally {
      setOptionsSaving(false);
    }
  };

  const handleSync = async () => {
    if (!deckInfo) return;
    setLoading(true);
    setSyncStatus(null);
    try {
      const res = platform === "moxfield"
        ? await api.syncMoxfieldDeck(deckInfo.id, tagMappings)
        : await api.syncArchidektDeck(deckInfo.id, tagMappings);

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
      <div className="section-header" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={onBack} style={{ padding: '0.5rem 1rem', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          ← Back to Hub
        </button>
        <div>
          <h2>Deck Sync Importer</h2>
          <p style={{ color: '#888', marginTop: '0.2rem' }}>
            Import a deck from Archidekt or Moxfield and map custom tags to your Manabase collection lists.
          </p>
        </div>
      </div>

      {/* Platform Selector Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => { setPlatform("archidekt"); setDeckInfo(null); }}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: platform === 'archidekt' ? '#3b82f6' : '#444',
            background: platform === 'archidekt' ? 'rgba(59, 130, 246, 0.2)' : '#1c1c1c',
            color: platform === 'archidekt' ? '#60a5fa' : '#aaa',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Archidekt
        </button>
        <button
          onClick={() => { setPlatform("moxfield"); setDeckInfo(null); }}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: platform === 'moxfield' ? '#10b981' : '#444',
            background: platform === 'moxfield' ? 'rgba(16, 185, 129, 0.2)' : '#1c1c1c',
            color: platform === 'moxfield' ? '#34d399' : '#aaa',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Moxfield
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Left Column: Deck Import */}
        <div style={{ background: '#1c1c1c', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333' }}>
          <h3>Import a {platform === 'moxfield' ? 'Moxfield' : 'Archidekt'} Deck</h3>
          <p style={{ color: '#888', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Enter a {platform === 'moxfield' ? 'Moxfield' : 'Archidekt'} Deck ID or paste URL to preview cards and categories.
          </p>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input 
              type="text" 
              placeholder={platform === 'moxfield' ? "e.g. oEWXWHM5eEGMmopExLWRCA or moxfield.com/decks/..." : "e.g. 21190823 or archidekt.com/decks/..."} 
              value={deckId}
              onChange={handleInputChange}
              style={{ flex: 1, padding: '0.5rem', background: '#2c2c2c', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
            />
            <button 
              onClick={handlePreview} 
              disabled={loading || !deckId}
              style={{ padding: '0.5rem 1rem', background: platform === 'moxfield' ? '#10b981' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading && !deckInfo ? "Loading..." : "Preview"}
            </button>
          </div>
          
          {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

          {deckInfo && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ color: platform === 'moxfield' ? '#34d399' : '#60a5fa', margin: 0 }}>{deckInfo.name}</h4>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: platform === 'moxfield' ? '#065f46' : '#1e3a8a', color: 'white' }}>
                  {platform === 'moxfield' ? 'Moxfield' : 'Archidekt'}
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0 }}>
                {deckInfo.commander && <>Commander: <strong>{deckInfo.commander}</strong><br/></>}
                Found <strong>{deckInfo.cards?.length || 0}</strong> card entries.
                <br/>
                Found <strong>{uniqueTags.length}</strong> unique tags/categories.
              </p>
            </div>
          )}

          {deckInfo && (
            <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#2a2a2a', borderRadius: '4px', border: '1px solid #333' }}>
              <h3 style={{ marginBottom: '1rem' }}>Deck Options</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ color: '#e5e5e5' }}>Privacy</label>
                  <select 
                    value={isPublic ? "public" : "private"} 
                    onChange={e => setIsPublic(e.target.value === "public")}
                    style={{ padding: '0.4rem', background: '#111', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
                  >
                    <option value="private">Private</option>
                    <option value="public">Public (Future Feature)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ color: '#e5e5e5' }}>Status</label>
                  <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value)}
                    style={{ padding: '0.4rem', background: '#111', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled (No Sync)</option>
                    <option value="archived">Archived (Hidden)</option>
                  </select>
                </div>
                <button 
                  onClick={handleSaveOptions}
                  disabled={optionsSaving}
                  style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: optionsSaving ? 'not-allowed' : 'pointer' }}
                >
                  {optionsSaving ? "Saving..." : "Save Options"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Tag Mappings */}
        <div style={{ background: '#1c1c1c', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Tag Mappings ({platform === 'moxfield' ? 'Moxfield' : 'Archidekt'})</h3>
            <button 
              onClick={handleSaveConfig}
              style={{ padding: '0.4rem 0.8rem', background: '#2c2c2c', color: 'white', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              <DocumentArrowDownIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Save Defaults
            </button>
          </div>
          <p style={{ color: '#888', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Map the tags/categories from your {platform === 'moxfield' ? 'Moxfield' : 'Archidekt'} deck to actions in Manabase.
          </p>

          {!deckInfo ? (
            <div style={{ color: '#666', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>
              Preview a deck first to see its tags.
            </div>
          ) : uniqueTags.length === 0 ? (
            <div style={{ color: '#666', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>
              No tags or categories found in this deck. All cards will be ignored unless mapped.
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
                {loading ? "Syncing..." : <><ArrowPathIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Sync Deck to Manabase</>}
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
                  <li>Cards Added/Moved: <strong style={{ color: '#10b981' }}>+{syncStatus.stats.added}</strong></li>
                  <li>Cards Removed: <strong style={{ color: '#ef4444' }}>-{syncStatus.stats.removed}</strong></li>
                  <li>Cards Ignored: <strong>{syncStatus.stats.ignored}</strong></li>
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
