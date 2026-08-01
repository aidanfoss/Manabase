import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon, RectangleStackIcon } from "@heroicons/react/24/solid";
import Card from "./Card";
import { api } from "../api/client";

export default function WishlistOverlap() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overlappingCards, setOverlappingCards] = useState([]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchOverlap = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("You must be logged in to view alerts.");
        }
        
        // 1. Fetch overlap names (now includes source_decks) from our backend
        const res = await fetch("/api/collection/wishlist/overlap", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
          throw new Error("Failed to fetch overlap data");
        }
        
        const data = await res.json();
        
        if (!data.cards || data.cards.length === 0) {
          if (isMounted) setOverlappingCards([]);
          return;
        }

        // 2. Fetch full card details from Scryfall proxy cache
        const names = data.cards.map(c => c.name);
        const fullCardsMap = await api.getCardDetailsBatch(names);
        
        // Combine the objects for the UI
        const fullCards = data.cards.map(backendCard => {
          const details = fullCardsMap[backendCard.name] || {};
          return {
            name: backendCard.name,
            wishlist_qty: backendCard.wishlist_qty,
            owned_qty: backendCard.owned_qty,
            source_decks: backendCard.source_decks || [],
            ...details
          };
        });
        
        if (isMounted) setOverlappingCards(fullCards);
      } catch (err) {
        console.error("Error fetching wishlist overlap:", err);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOverlap();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="collection-view p-6" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <button 
        className="nav-link" 
        style={{ display: 'inline-flex', alignItems: 'center', marginBottom: '1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        onClick={() => navigate(-1)}
      >
        <ArrowLeftIcon style={{ width: '1.2em', height: '1.2em', marginRight: '6px' }} />
        Back
      </button>

      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Wishlist Overlap</h1>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
        These are cards on your Wishlist that you already own a copy of.
        The deck badge shows which synced deck added the card to your wishlist.
      </p>

      {loading ? (
        <div>Loading cards...</div>
      ) : error ? (
        <div style={{ color: '#ef4444' }}>{error}</div>
      ) : overlappingCards.length === 0 ? (
        <div>Great job! You have no cards on your wishlist that are already in your collection.</div>
      ) : (
        <div className="grid">
          {overlappingCards.map((it) => (
            <div key={it.name}>
              <Card item={it} imageOverlay={
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '6px',
                  right: '6px',
                  background: 'rgba(10, 15, 30, 0.88)', 
                  backdropFilter: 'blur(6px)',
                  padding: '6px 10px', 
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  color: '#f8fafc',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
                  pointerEvents: 'none',
                  zIndex: 10
                }}>
                  {/* Quantity row */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: it.source_decks.length > 0 ? '5px' : 0 }}>
                    <span><strong style={{ color: '#818cf8' }}>Wishlist:</strong> {it.wishlist_qty}</span>
                    <span style={{ color: '#334155' }}>|</span>
                    <span><strong style={{ color: '#34d399' }}>Owned:</strong> {it.owned_qty}</span>
                  </div>

                  {/* Source deck pills */}
                  {it.source_decks.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
                      {it.source_decks.map(deck => (
                        <span
                          key={deck.deck_id}
                          title={`This card was added to your wishlist by: ${deck.deck_name}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: 'rgba(99, 102, 241, 0.25)',
                            border: '1px solid rgba(99, 102, 241, 0.5)',
                            color: '#c7d2fe',
                            padding: '1px 6px',
                            borderRadius: '999px',
                            fontSize: '0.7rem',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: '1.4'
                          }}
                        >
                          <RectangleStackIcon style={{ width: '0.7em', height: '0.7em', flexShrink: 0 }} />
                          {deck.deck_name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        background: 'rgba(71, 85, 105, 0.4)',
                        border: '1px solid rgba(71, 85, 105, 0.6)',
                        color: '#94a3b8',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        lineHeight: '1.4'
                      }}>
                        Manually added
                      </span>
                    </div>
                  )}
                </div>
              } />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
