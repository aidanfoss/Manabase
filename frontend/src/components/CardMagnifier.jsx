import React, { useState } from 'react';
import ReactDOM from 'react-dom';

const CardMagnifier = ({ cardImageUrl, cardName, children }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  const OFFSET = 20;

  // Upgrade Scryfall image URLs from small/normal to high-res large images
  const getHighResUrl = (url) => {
    if (!url) return '';
    return url.replace('/normal/', '/large/').replace('/small/', '/large/');
  };

  const handleMouseMove = (e) => {
    setPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);

  // Keyboard accessibility
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsVisible(!isVisible);
    }
  };

  const highResUrl = getHighResUrl(cardImageUrl);

  return (
    <>
      <div
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        tabIndex="0"
        role="button"
        aria-label={`Show high quality preview of ${cardName}`}
        style={{ display: 'inline-block', cursor: 'zoom-in', outline: 'none' }}
      >
        {children}
      </div>

      {isVisible && highResUrl && ReactDOM.createPortal(
        <div
          className="card-magnifier-popup"
          style={{
            top: `${Math.max(10, Math.min(position.y + OFFSET, window.innerHeight - 440))}px`,
            left: `${Math.max(10, Math.min(position.x + OFFSET, window.innerWidth - 320))}px`
          }}
        >
          <img src={highResUrl} alt={cardName} />
        </div>,
        document.body
      )}
    </>
  );
};

export default CardMagnifier;
