// frontend/src/pages/FAQ.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { QuestionMarkCircleIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

const FAQ_ITEMS = [
  {
    q: "How does Manabase calculate optimal mana bases?",
    a: "Manabase analyzes your deck's color requirements, mana curves, spell color symbols, and land cycles (fetch lands, shocks, duals, basics) using advanced probability heuristics and customizable land presets to ensure maximum color consistency."
  },
  {
    q: "Can I sync decks from Archidekt or Moxfield?",
    a: "Yes! Manabase includes built-in sync support for Archidekt and Moxfield decks so your collection, wishlists, and proxy orders stay automatically up to date."
  },
  {
    q: "How do proxy orders and wishlists work?",
    a: "You can manage your wishlist, track overlap with your physical inventory collection, and organize proxy orders cleanly for printing or order fulfillment."
  },
  {
    q: "Is Manabase free to use?",
    a: "Yes, Manabase core deckbuilding, collection management, and land calculation features are completely free to use."
  },
  {
    q: "Is Manabase affiliated with Wizards of the Coast?",
    a: "No. Manabase is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. Not approved/endorsed by WotC."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div style={{ maxWidth: '900px', margin: '3rem auto', padding: '0 2rem', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <QuestionMarkCircleIcon style={{ width: '2.5rem', height: '2.5rem', color: '#3b82f6' }} />
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>Frequently Asked Questions</h1>
      </div>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Got questions about Manabase? We've got answers.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              style={{
                background: '#1e293b',
                borderRadius: '8px',
                border: '1px solid #334155',
                overflow: 'hidden',
                transition: 'all 0.2s ease'
              }}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                style={{
                  width: '100%',
                  padding: '1.25rem 1.5rem',
                  background: 'none',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{item.q}</span>
                <ChevronDownIcon style={{ width: '1.2rem', height: '1.2rem', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>
              {isOpen && (
                <div style={{ padding: '0 1.5rem 1.25rem 1.5rem', color: '#cbd5e1', lineHeight: '1.6', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '3rem', borderTop: '1px solid #334155', paddingTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <Link to="/" style={{ color: '#60a5fa', textDecoration: 'none' }}>&larr; Back to Home</Link>
        <Link to="/builder" style={{ color: '#60a5fa', textDecoration: 'none' }}>Open Deckbuilder &rarr;</Link>
      </div>
    </div>
  );
}
