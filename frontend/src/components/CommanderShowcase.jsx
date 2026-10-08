import React from 'react';
import { MagnifyingGlassIcon, ChartBarIcon, GlobeAltIcon } from '@heroicons/react/24/solid';

const FALLBACK_COMPANIONS = [
  {
    name: "Sol Ring",
    image: "https://cards.scryfall.io/normal/front/4/c/4cbc6901-6a4a-4d0a-83ea-7eefa3b35021.jpg",
    synergy: 0.95
  },
  {
    name: "Arcane Signet",
    image: "https://cards.scryfall.io/normal/front/9/8/9886178b-5928-4aa7-9205-561ce977013a.jpg",
    synergy: 0.92
  },
  {
    name: "Command Tower",
    image: "https://cards.scryfall.io/normal/front/0/5/0536ec26-384e-4e44-b26a-9f5b248fcae5.jpg",
    synergy: 0.90
  },
  {
    name: "Lightning Greaves",
    image: "https://cards.scryfall.io/normal/front/d/a/da9a4949-9fec-4adc-bee2-9777bc0d5a47.jpg",
    synergy: 0.88
  },
  {
    name: "Cyclonic Rift",
    image: "https://cards.scryfall.io/normal/front/f/5/f51121d2-0690-4c31-9257-238d21c0ad1d.jpg",
    synergy: 0.85
  }
];

export default function CommanderShowcase({ commander, cards }) {
  // Grab companion cards from props
  const validCards = Array.isArray(cards) ? cards.filter(c => c && c.name) : [];

  // Guarantee at least 4 companion cards so there are always 5 cards total (1 commander + 4 companions)
  const companionList = [...validCards];
  for (const fallback of FALLBACK_COMPANIONS) {
    if (companionList.length >= 4) break;
    const isAlreadyPresent = companionList.some(c => c.name?.toLowerCase() === fallback.name.toLowerCase());
    const isCommanderName = commander?.name?.toLowerCase() === fallback.name.toLowerCase();
    if (!isAlreadyPresent && !isCommanderName) {
      companionList.push(fallback);
    }
  }

  // Construct arc: [commander (left), card1, card2, card3, card4] -> strictly 5 total cards
  const arcArray = [
    {
      name: commander?.name || 'Unknown Commander',
      image: commander?.image || '',
      isCommander: true
    },
    ...companionList.slice(0, 4).map(c => ({ ...c, isCommander: false }))
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
