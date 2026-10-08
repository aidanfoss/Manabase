import React from 'react';
import { MagnifyingGlassIcon, ChartBarIcon, GlobeAltIcon } from '@heroicons/react/24/solid';

export default function CommanderShowcase({ commander, cards }) {
  const getScryfallUrl = (name) => `https://scryfall.com/search?q=!"${encodeURIComponent(name)}"`;
  const getGathererUrl = (name) => `https://gatherer.wizards.com/Pages/Card/Details.aspx?name=${encodeURIComponent(name)}`;
  const getEdhrecUrl = (card) => {
    if (card.url) return `https://edhrec.com${card.url}`;
    return `https://edhrec.com/commanders/${card.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  };

  return (
    <div className="commander-showcase">
      <div className="showcase-header">
        <h2 className="showcase-title">Update your decks</h2>
        <span className="showcase-source">Trending on EDHRec</span>
      </div>

      <div className="showcase-grid">
        {/* Featured Commander */}
        <div className="card-item commander-featured">
          <a href={getScryfallUrl(commander.name)} target="_blank" rel="noopener noreferrer" className="card-image-link">
            <img src={commander.image} alt={commander.name} />
          </a>
          <div className="card-actions">
            <a href={getScryfallUrl(commander.name)} target="_blank" rel="noopener noreferrer" className="icon-action" aria-label="Scryfall">
              <MagnifyingGlassIcon className="action-icon" />
            </a>
            <a href={getEdhrecUrl(commander)} target="_blank" rel="noopener noreferrer" className="icon-action" aria-label="EDHRec">
              <ChartBarIcon className="action-icon" />
            </a>
            <a href={getGathererUrl(commander.name)} target="_blank" rel="noopener noreferrer" className="icon-action" aria-label="Gatherer">
              <GlobeAltIcon className="action-icon" />
            </a>
          </div>
        </div>

        {/* New Cards Cascade */}
        <div className="new-cards-cascade">
          {cards.map((card, i) => (
            <div key={card.name} className={`card-item new-card-${i}`}>
              <span className="new-badge">NEW</span>
              <a href={getScryfallUrl(card.name)} target="_blank" rel="noopener noreferrer" className="card-image-link">
                <img src={card.image} alt={card.name} />
              </a>
              <div className="card-actions">
                <a href={getScryfallUrl(card.name)} target="_blank" rel="noopener noreferrer" className="icon-action" aria-label="Scryfall">
                  <MagnifyingGlassIcon className="action-icon" />
                </a>
                <a href={getEdhrecUrl(card)} target="_blank" rel="noopener noreferrer" className="icon-action" aria-label="EDHRec">
                  <ChartBarIcon className="action-icon" />
                </a>
                <a href={getGathererUrl(card.name)} target="_blank" rel="noopener noreferrer" className="icon-action" aria-label="Gatherer">
                  <GlobeAltIcon className="action-icon" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
