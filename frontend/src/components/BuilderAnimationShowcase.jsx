import React, { useState, useEffect } from 'react';
import '../styles/builder-animation.css';

const INITIAL_CARDS = [
  { id: 'c1', name: 'Island', img: 'https://api.scryfall.com/cards/named?exact=Island&format=image', isBad: false },
  { id: 'c2', name: 'Mountain', img: 'https://api.scryfall.com/cards/named?exact=Mountain&format=image', isBad: false },
  { id: 'c3', name: 'Izzet Guildgate', img: 'https://api.scryfall.com/cards/named?exact=Izzet+Guildgate&format=image', isBad: true, upgradedImg: 'https://api.scryfall.com/cards/named?exact=Steam+Vents&format=image' },
  { id: 'c4', name: 'Highland Lake', img: 'https://api.scryfall.com/cards/named?exact=Highland+Lake&format=image', isBad: true, upgradedImg: 'https://api.scryfall.com/cards/named?exact=Scalding+Tarn&format=image' },
];

export default function BuilderAnimationShowcase() {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'scanning' | 'upgraded'

  useEffect(() => {
    // Loop the animation
    const interval = setInterval(() => {
      setPhase('idle');

      setTimeout(() => {
        setPhase('scanning');
      }, 1000); // Wait 1s, then scan & target

      setTimeout(() => {
        setPhase('upgraded');
      }, 3000); // 2s after scanning starts, do the upgrade flip

    }, 6000); // Full loop takes 6 seconds

    // Initial Start
    setTimeout(() => setPhase('scanning'), 1000);
    setTimeout(() => setPhase('upgraded'), 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="builder-anim-container">
      <div className="builder-anim-stage">
        {/* Scanner Line */}
        <div className={`scanner-line ${phase === 'scanning' ? 'active' : ''}`}></div>

        <div className="anim-cards-row">
          {INITIAL_CARDS.map((card, idx) => {
            const isTargeted = card.isBad && phase !== 'idle';
            const isFlipped = card.isBad && phase === 'upgraded';

            return (
              <div
                key={card.id}
                className={`anim-card-wrapper ${isTargeted ? 'targeted' : ''} ${isFlipped ? 'upgraded' : ''}`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="anim-card-inner">
                  {/* Front (Original Card) */}
                  <div className="anim-card-front">
                    <img src={card.img} alt={card.name} />
                  </div>

                  {/* Back (Upgraded Card) */}
                  <div className="anim-card-back">
                    {card.isBad && <img src={card.upgradedImg} alt={`${card.name} upgraded`} />}
                  </div>
                </div>

                {/* Target reticle/glow for bad cards */}
                {card.isBad && <div className="target-reticle"></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
