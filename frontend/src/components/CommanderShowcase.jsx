import React from 'react';
import { MagnifyingGlassIcon, ChartBarIcon, GlobeAltIcon } from '@heroicons/react/24/solid';

export default function CommanderShowcase({ commander, cards }) {
  // Grab up to 4 companion cards
  const validCards = Array.isArray(cards) ? cards.slice(0, 4) : [];

  // Split into 2 left cards and 2 right cards to flank the commander in the center
  const leftCards = validCards.slice(0, 2);
  const rightCards = validCards.slice(2, 4);

  // Construct arc: [left1, left2, commander (center), right1, right2] -> exactly 5 total cards
  const arcArray = [
    ...leftCards.map(c => ({ ...c, isCommander: false })),
    {
      name: commander?.name || 'Unknown Commander',
      image: commander?.image || '',
      isCommander: true
    },
    ...rightCards.map(c => ({ ...c, isCommander: false }))
  ];

  // URL Helpers
  const getScryfallUrl = (name) => `https://scryfall.com/search?q=!"${encodeURIComponent(name)}"`;
  const getGathererUrl = (name) => `https://gatherer.wizards.com/Pages/Card/Details.aspx?name=${encodeURIComponent(name)}`;
  const getEdhrecUrl = (card) => {
    if (card.url) return `https://edhrec.com${card.url}`;
    return `https://edhrec.com/commanders/${(card.name || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  };

  return (
    <div className="commander-showcase">
      <div className="showcase-grid arc-layout">
        {arcArray.map((item, idx) => (
          <div
            key={`${item.name}-${idx}`}
            className={`card-item arc-card-${idx} ${item.isCommander ? 'commander-featured' : ''}`}
          >
            {!item.isCommander && <span className="new-badge">NEW</span>}
            <a href={getScryfallUrl(item.name)} target="_blank" rel="noopener noreferrer" className="card-image-link" tabIndex="0">
              <img src={item.image} alt={item.name} />
            </a>
            <div className="card-actions">
              <a href={getScryfallUrl(item.name)} target="_blank" rel="noopener noreferrer" className="icon-action" aria-label={`View ${item.name} on Scryfall`}>
                <MagnifyingGlassIcon className="action-icon" />
              </a>
              <a href={getEdhrecUrl(item)} target="_blank" rel="noopener noreferrer" className="icon-action" aria-label={`View ${item.name} on EDHREC`}>
                <ChartBarIcon className="action-icon" />
              </a>
              <a href={getGathererUrl(item.name)} target="_blank" rel="noopener noreferrer" className="icon-action" aria-label={`View ${item.name} on Gatherer`}>
                <GlobeAltIcon className="action-icon" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
