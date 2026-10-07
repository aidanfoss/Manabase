import React, { useState, useEffect } from "react";
import {
  Cog6ToothIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  StarIcon,
  FireIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from "@heroicons/react/24/solid";
import CardMagnifier from "../components/CardMagnifier";
import "./DeckUpdater.css";

export default function DeckUpdater() {
  const [deckAnalyses, setDeckAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDeck, setExpandedDeck] = useState(null);
  
  const [showOptions, setShowOptions] = useState(false);
  const [dismissals, setDismissals] = useState([]);

  useEffect(() => {
    fetchAllDecksAnalysis();
  }, []);

  const fetchAllDecksAnalysis = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/deck-updater/analyze-all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDeckAnalyses(data);
      } else {
        setError(data.error || "Failed to analyze decks");
      }
    } catch (e) {
      setError("Network error while analyzing decks");
    } finally {
      setLoading(false);
    }
  };

  const toggleDeck = (deckId) => {
    if (expandedDeck === deckId) {
      setExpandedDeck(null);
    } else {
      setExpandedDeck(deckId);
    }
  };

  const handleDismiss = async (deckId, suggestionId) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Optimistic UI update for dashboard
    setDeckAnalyses(prev => prev.map(deck => {
      if (String(deck.deck_id) !== String(deckId)) return deck;

      return {
        ...deck,
        strictlyBetter: deck.strictlyBetter.filter(u => `strictly_better:${u.currentCard}` !== suggestionId),
        edhrec: {
          newCards: deck.edhrec.newCards.filter(c => `edhrec_new:${c.name}` !== suggestionId),
          highSynergy: deck.edhrec.highSynergy.filter(c => `edhrec_synergy:${c.name}` !== suggestionId)
        }
      };
    }));

    // Optimistic UI update for the options menu
    setDismissals(prev => {
      // Check if it's already there to avoid duplicates
      if (prev.some(d => String(d.deck_id) === String(deckId) && d.suggestion_id === suggestionId)) return prev;
      return [{ id: Date.now() + Math.random(), deck_id: deckId, suggestion_id: suggestionId }, ...prev];
    });

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
      console.error("Failed to dismiss", e);
      // Ideally we'd rollback state here on failure, but keeping it simple for now
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

  const handleUndismiss = async (deckId, suggestionId) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Optimistic UI for modal
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
      // Need to reload analysis to show the card again
      fetchAllDecksAnalysis();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="deck-updater-container fade-in">
        <div className="updater-header">
          <h1>Deck Upgrades & Analysis</h1>
          <p>Analyzing all your decks across strictlybetter.eu and EDHRec...</p>
        </div>
        <div className="loading-state glass-panel">
          <div className="spinner"></div>
          <p>Please wait, fetching massive data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="deck-updater-container fade-in">
        <div className="error-state glass-panel">
          <h2>Oops!</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="deck-updater-container fade-in">
      <div className="updater-header">
        <h1>Deck Upgrades & Analysis</h1>
        <p>At a glance overview of upgrades and new synergy cards for all your decks.</p>
        <button className="options-btn" onClick={openOptions}>
          <Cog6ToothIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Options & Dismissals
        </button>
      </div>

      {deckAnalyses.length === 0 ? (
        <div className="empty-state glass-panel">
          <div className="empty-icon"><SparklesIcon style={{ width: '2.5rem', height: '2.5rem', color: '#818cf8' }} /></div>
          <h2>No decks found</h2>
          <p>Import decks from Archidekt to see upgrades here.</p>
        </div>
      ) : (
        <div className="dashboard-grid">
          {deckAnalyses.map((analysis, index) => {
            const hasStrictlyBetter = analysis.strictlyBetter?.length > 0;
            const hasNewCards = analysis.edhrec?.newCards?.length > 0;
            const hasSynergy = analysis.edhrec?.highSynergy?.length > 0;
            const isExpanded = expandedDeck === analysis.deck_id;

            return (
              <div
                key={analysis.deck_id}
                className={`dashboard-card glass-panel slide-up ${isExpanded ? 'expanded' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="card-header" onClick={() => toggleDeck(analysis.deck_id)}>
                  <div className="card-header-info">
                    <h2>{analysis.deck_name}</h2>
                    <span className="commander-subtitle">Cmdr: {analysis.commander || 'Unknown'}</span>
                  </div>

                  <div className="card-badges">
                    {hasStrictlyBetter && (
                      <span className="badge warning" title="Powercrept cards or variations detected">
                        <ExclamationTriangleIcon style={{ width: '1.1em', height: '1.1em', verticalAlign: 'middle', marginRight: '3px' }} /> {analysis.strictlyBetter.length} Upgrades
                      </span>
                    )}
                    {hasNewCards && (
                      <span className="badge success" title="New EDHRec cards">
                        <StarIcon style={{ width: '1.1em', height: '1.1em', verticalAlign: 'middle', marginRight: '3px' }} /> {analysis.edhrec.newCards.length} New
                      </span>
                    )}
                    {!hasStrictlyBetter && !hasNewCards && (
                      <span className="badge neutral">
                        <CheckCircleIcon style={{ width: '1.1em', height: '1.1em', verticalAlign: 'middle', marginRight: '3px' }} /> Optimal
                      </span>
                    )}
                    <span className="expand-icon">{isExpanded ? <ChevronDownIcon style={{ width: '1.1em', height: '1.1em' }} /> : <ChevronRightIcon style={{ width: '1.1em', height: '1.1em' }} />}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="card-expanded-content fade-in">

                    {/* Strictly Better Section */}
                    {hasStrictlyBetter && (
                      <section className="analysis-section strictly-better">
                        <div className="section-header">
                          <h3>
                            <ExclamationTriangleIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '6px', color: '#f59e0b' }} />
                            Potential Upgrades / Variations
                          </h3>
                        </div>
                        <div className="upgrade-grid">
                          {analysis.strictlyBetter.map((upgrade, idx) => {
                            const suggestionId = `strictly_better:${upgrade.currentCard}`;
                            return (
                              <div key={idx} className="upgrade-card rich-card">
                                <button className="dismiss-btn" onClick={() => handleDismiss(analysis.deck_id, suggestionId)} title="Dismiss">×</button>

                                <div className="card-visuals">
                                  <div className="inferior-visual">
                                    <span className="label">Current</span>
                                    {upgrade.currentCardData?.image_uri ? (
                                      <CardMagnifier cardImageUrl={upgrade.currentCardData.image_uri} cardName={upgrade.currentCard}>
                                        <img src={upgrade.currentCardData.image_uri} alt={upgrade.currentCard} className="card-art" />
                                      </CardMagnifier>
                                    ) : (
                                      <div className="card-art-placeholder">{upgrade.currentCard}</div>
                                    )}
                                    <div className="card-price">{upgrade.currentCardData?.price ? `$${upgrade.currentCardData.price}` : '--'}</div>
                                  </div>

                                  <div className="upgrade-arrow">→</div>

                                  <div className="superior-visuals">
                                    <span className="label">Better Options</span>
                                    <div className="superior-list">
                                      {upgrade.strictlyBetterCardsData.map((sup, sIdx) => (
                                        <div key={sIdx} className="superior-visual">
                                          {sup.image_uri ? (
                                            <CardMagnifier cardImageUrl={sup.image_uri} cardName={sup.name}>
                                              <img src={sup.image_uri} alt={sup.name} className="card-art" />
                                            </CardMagnifier>
                                          ) : (
                                            <div className="card-art-placeholder">{sup.name}</div>
                                          )}
                                          <div className="card-price">{sup.price ? `$${sup.price}` : '--'}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* EDHRec New Cards Section */}
                    {hasNewCards && (
                      <section className="analysis-section edhrec-new">
                        <div className="section-header">
                          <h3>
                            <StarIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '6px', color: '#38bdf8' }} />
                            New Additions
                          </h3>
                        </div>
                        <div className="suggestion-grid">
                          {analysis.edhrec.newCards.slice(0, 12).map((card, idx) => {
                            const suggestionId = `edhrec_new:${card.name}`;
                            return (
                              <div key={idx} className="suggestion-card">
                                <button className="dismiss-btn-small" onClick={() => handleDismiss(analysis.deck_id, suggestionId)} title="Dismiss">×</button>
                                {card.image_uri ? (
                                  <CardMagnifier cardImageUrl={card.image_uri} cardName={card.name}>
                                    <img src={card.image_uri} alt={card.name} className="card-art" />
                                  </CardMagnifier>
                                ) : (
                                  <div className="card-art-placeholder">{card.name}</div>
                                )}
                                <div className="card-info-row">
                                  <span className="card-price">{card.price ? `$${card.price}` : '--'}</span>
                                  <span className="card-synergy">{Math.round((card.synergy || 0) * 100)}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* EDHRec High Synergy Section */}
                    {hasSynergy && (
                      <section className="analysis-section edhrec-synergy">
                        <div className="section-header">
                          <h3>
                            <FireIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '6px', color: '#f87171' }} />
                            High Synergy Missing
                          </h3>
                        </div>
                        <div className="suggestion-grid">
                          {analysis.edhrec.highSynergy.slice(0, 12).map((card, idx) => {
                            const suggestionId = `edhrec_synergy:${card.name}`;
                            return (
                              <div key={idx} className="suggestion-card">
                                <button className="dismiss-btn-small" onClick={() => handleDismiss(analysis.deck_id, suggestionId)} title="Dismiss">×</button>
                                {card.image_uri ? (
                                  <CardMagnifier cardImageUrl={card.image_uri} cardName={card.name}>
                                    <img src={card.image_uri} alt={card.name} className="card-art" />
                                  </CardMagnifier>
                                ) : (
                                  <div className="card-art-placeholder">{card.name}</div>
                                )}
                                <div className="card-info-row">
                                  <span className="card-price">{card.price ? `$${card.price}` : '--'}</span>
                                  <span className="card-synergy">{Math.round((card.synergy || 0) * 100)}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Options Modal */}
      {showOptions && (
        <div className="modal-overlay" onClick={() => setShowOptions(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Dismissed Suggestions</h2>
              <button className="modal-close" onClick={() => setShowOptions(false)}>×</button>
            </div>
            <div className="modal-body">
              {dismissals.length === 0 ? (
                <p>No dismissed suggestions.</p>
              ) : (
                <ul className="dismissals-list">
                  {dismissals.map(d => (
                    <li key={d.id} className="dismissal-item">
                      <div className="dismissal-info">
                        <span className="dismissal-deck">{deckAnalyses.find(da => String(da.deck_id) === String(d.deck_id))?.deck_name || d.deck_id}</span>
                        <span className="dismissal-id">{d.suggestion_id.replace('strictly_better:', 'Upgrade: ').replace('edhrec_new:', 'New: ').replace('edhrec_synergy:', 'Synergy: ')}</span>
                      </div>
                      <button className="restore-btn" onClick={() => handleUndismiss(d.deck_id, d.suggestion_id)}>Restore</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
