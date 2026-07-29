import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import CardGrid from "./CardGrid";
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
        
        // 1. Fetch overlap names from our backend
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
        
        // Combine the objects for the CardGrid
        const fullCards = names.map(name => {
          const details = fullCardsMap[name] || {};
          return {
            name: name,
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
        These are cards that are currently on your Wishlist, but you already have a copy in your Owned collection. 
        You may want to remove them from your Wishlist to avoid buying duplicates!
      </p>

      {loading ? (
        <div>Loading cards...</div>
      ) : error ? (
        <div style={{ color: '#ef4444' }}>{error}</div>
      ) : overlappingCards.length === 0 ? (
        <div>Great job! You have no cards on your wishlist that are already in your collection.</div>
      ) : (
        <CardGrid items={overlappingCards} />
      )}
    </div>
  );
}
