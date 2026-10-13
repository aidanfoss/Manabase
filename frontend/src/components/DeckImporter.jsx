import React, { useState, useEffect, useMemo } from "react";
import { ArrowPathIcon, DocumentArrowDownIcon, CheckCircleIcon } from "@heroicons/react/24/solid";

import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

import "../styles.css";

const MAPPING_OPTIONS = [
  { value: "wishlist", label: "Add to Wishlist (need proxy OR real)" },
  { value: "tradelist", label: "Add to Tradelist (need real)" },
  { value: "ignore", label: "Ignore" },
  { value: "owned", label: "Add to Collection (Others can trade for)" }
];

export function isCutOrExcludedCategory(categoryName, excludedCategoryNames = null) {
  if (!categoryName || typeof categoryName !== "string") return false;
  const lower = categoryName.trim().toLowerCase();
  if (excludedCategoryNames) {
    if (excludedCategoryNames instanceof Set && excludedCategoryNames.has(lower)) return true;
    if (Array.isArray(excludedCategoryNames) && excludedCategoryNames.some(c => String(c).toLowerCase() === lower)) return true;
  }
  return (
    lower === "cut cards" || lower === "cut" || lower === "cuts" ||
    lower.startsWith("cut ") || lower.endsWith(" cut") ||
    lower.includes("cut cards") || lower.includes("cuts") ||
    lower === "sideboard" || lower === "maybeboard" || lower === "considering"
  );
}

export function isCardCutOrExcluded(item, platform, excludedCategoryNames = null) {
  if (!item) return false;
  if (platform === "moxfield") {
    const board = (item.boardName || "").toLowerCase();
    if (board === "sideboard" || board === "maybeboard" || board === "considering") return true;
    if (Array.isArray(item.categories) && item.categories.some(cat => {
      const lower = String(cat).toLowerCase();
      return lower.includes("cut") || lower === "sideboard" || lower === "maybeboard" || lower === "considering";
    })) return true;
    return false;
  }

  // Archidekt
  const categories = Array.isArray(item.categories)
    ? item.categories.map(c => typeof c === 'string' ? c : c?.name).filter(Boolean)
    : [];

  for (const cat of categories) {
    if (isCutOrExcludedCategory(cat, excludedCategoryNames)) return true;
  }

  let labelName = (item.label || "").split(',')[0].trim();
  if (labelName && isCutOrExcludedCategory(labelName, excludedCategoryNames)) return true;

  return false;
}

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
  const [excludeSideboards, setExcludeSideboards] = useState(initialDeck?.exclude_side_and_maybeboards !== undefined ? !!initialDeck.exclude_side_and_maybeboards : true);
  const [optionsSaving, setOptionsSaving] = useState(false);

  const [syncStatus, setSyncStatus] = useState(null);

  // Compute excluded categories from deck metadata (categories marked includedInDeck: false)
  const excludedCategoryNames = useMemo(() => {
    const set = new Set();
    if (Array.isArray(deckInfo?.categories)) {
      deckInfo.categories.forEach(cat => {
        if (cat && cat.name && cat.includedInDeck === false) {
          set.add(cat.name.toLowerCase());
        }
      });
    }
    return set;
  }, [deckInfo]);

  // Dynamically calculate active vs excluded cards based on toggle state
  const cardStats = useMemo(() => {
    if (!deckInfo || !deckInfo.cards) return { total: 0, active: 0, excluded: 0 };
    const total = deckInfo.cards.length;
    let excluded = 0;
    for (const item of deckInfo.cards) {
      if (isCardCutOrExcluded(item, platform, excludedCategoryNames)) {
        excluded++;
      }
    }
    const active = excludeSideboards ? total - excluded : total;
    return { total, active, excluded };
  }, [deckInfo, platform, excludedCategoryNames, excludeSideboards]);

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
        if (Array.isArray(info.categories)) {
          info.categories.forEach(cat => {
            if (cat && cat.name) tags.add(cat.name);
          });
        }
        info.cards?.forEach(item => {
          let labelName = (item.label || "").split(',')[0].trim();
          if (labelName) tags.add(labelName);
          if (Array.isArray(item.categories)) {
            item.categories.forEach(cat => {
              const name = typeof cat === 'string' ? cat : cat?.name;
              if (name) tags.add(name);
            });
          }
        });
        if (tags.size === 0) tags.add("Default color tag");
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
        await api.updateMoxfieldDeckOptions(deckInfo.id, { is_public: isPublic, status, exclude_side_and_maybeboards: excludeSideboards });
      } else {
        await api.updateArchidektDeckOptions(deckInfo.id, { is_public: isPublic, status, exclude_side_and_maybeboards: excludeSideboards });
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
        ? await api.syncMoxfieldDeck(deckInfo.id, tagMappings, { exclude_side_and_maybeboards: excludeSideboards })
        : await api.syncArchidektDeck(deckInfo.id, tagMappings, { exclude_side_and_maybeboards: excludeSideboards });

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
      <div className="subtabs-segmented">
        <button
          className={`subtab-btn ${platform === "archidekt" ? "active" : ""}`}
          onClick={() => { setPlatform("archidekt"); setDeckInfo(null); }}
        >
          Archidekt
        </button>
        <button
          className={`subtab-btn ${platform === "moxfield" ? "active" : ""}`}
          onClick={() => { setPlatform("moxfield"); setDeckInfo(null); }}
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
              <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0, lineHeight: 1.6 }}>
                {deckInfo.commander && <>Commander: <strong>{deckInfo.commander}</strong><br/></>}
                {excludeSideboards && cardStats.excluded > 0 ? (
                  <>
                    Found <strong style={{ color: '#f8fafc' }}>{cardStats.active}</strong> active deck cards
                    <span style={{ color: '#60a5fa', marginLeft: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                      ({cardStats.excluded} cut / sideboard excluded)
                    </span>
                  </>
                ) : (
                  <>
                    Found <strong style={{ color: '#f8fafc' }}>{cardStats.total}</strong> card entries
                    {cardStats.excluded > 0 && !excludeSideboards && (
                      <span style={{ color: '#9ca3af', marginLeft: '6px', fontSize: '0.85rem' }}>
                        (including {cardStats.excluded} cut / sideboard cards)
                      </span>
                    )}
                  </>
                )}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingTop: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <label style={{ color: '#e5e5e5', display: 'block', fontWeight: '500' }}>Board Filtering</label>
                      <span style={{ color: '#888', fontSize: '0.8rem' }}>
                        Ignore cut cards and non-mainboard cards
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExcludeSideboards(!excludeSideboards)}
                      style={{
                        padding: '0.45rem 0.9rem',
                        background: excludeSideboards ? 'rgba(59, 130, 246, 0.2)' : '#1f1f1f',
                        color: excludeSideboards ? '#60a5fa' : '#888',
                        border: `1px solid ${excludeSideboards ? '#3b82f6' : '#444'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircleIcon style={{ width: '1.1em', height: '1.1em', opacity: excludeSideboards ? 1 : 0.3 }} />
                      Exclude side and maybeboards
                    </button>
                  </div>
                  {cardStats.excluded > 0 && (
                    <div style={{
                      marginTop: '0.25rem',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      background: excludeSideboards ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${excludeSideboards ? 'rgba(59, 130, 246, 0.3)' : '#333'}`,
                      color: excludeSideboards ? '#93c5fd' : '#9ca3af'
                    }}>
                      {excludeSideboards
                        ? `Filtering active: ${cardStats.excluded} cards in cut cards / sideboard / maybeboard categories will be omitted from active deck sync and recommendations.`
                        : `Filtering off: All ${cardStats.total} cards (including ${cardStats.excluded} cut/sideboard cards) will be imported into the active deck.`}
                    </div>
                  )}
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
              {uniqueTags.map(tag => {
                const isExcluded = isCutOrExcludedCategory(tag, excludedCategoryNames);
                return (
                  <div key={tag} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#252525', padding: '0.75rem', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: isExcluded && excludeSideboards ? '#94a3b8' : '#e5e5e5' }}>{tag}</span>
                      {isExcluded && (
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background: excludeSideboards ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          color: excludeSideboards ? '#fca5a5' : '#888',
                          border: `1px solid ${excludeSideboards ? 'rgba(239, 68, 68, 0.4)' : '#444'}`,
                          fontWeight: 500
                        }}>
                          {excludeSideboards ? 'Auto-Excluded Board' : 'Side/Cut Board'}
                        </span>
                      )}
                    </div>
                    <select
                      value={tagMappings[tag] || "ignore"}
                      onChange={(e) => setTagMappings(prev => ({ ...prev, [tag]: e.target.value }))}
                      style={{ padding: '0.4rem', background: '#111', color: 'white', border: '1px solid #444', borderRadius: '4px', minWidth: '150px' }}
                    >
                      {MAPPING_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {isExcluded && excludeSideboards && opt.value === "ignore"
                            ? "Ignore (Auto-Excluded)"
                            : opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
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
