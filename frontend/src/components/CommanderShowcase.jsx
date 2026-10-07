import React from 'react';

export default function CommanderShowcase({ commander, cards }) {
  return (
    <div className="commander-showcase">
      <div className="showcase-header">
        <h2 className="showcase-title">Latest Discoveries</h2>
        <span className="showcase-source">Trending on EDHRec</span>
      </div>

      <div className="showcase-grid">
        {/* Featured Commander */}
        <div className="card-item commander-featured">
          <img src={commander.image} alt={commander.name} />
        </div>

        {/* New Cards Cascade */}
        <div className="new-cards-cascade">
          {cards.map((card, i) => (
            <div key={card.name} className={`card-item new-card-${i}`}>
              <span className="new-badge">NEW</span>
              <img src={card.image} alt={card.name} />
              <div className="card-actions">
                <button onClick={() => console.log('Proxy', card.name)}>Proxy</button>
                <button onClick={() => console.log('Update', card.name)}>Update</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
