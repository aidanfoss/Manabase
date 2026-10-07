import React, { useState } from 'react';
import ReactDOM from 'react-dom';

const CardMagnifier = ({ cardImageUrl, cardName, children }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  const POPUP_WIDTH = 300;
  const POPUP_HEIGHT = 420;
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

  // Calculate smart popup placement based on viewport boundaries
  const getPopupStyle = () => {
    const { x, y } = position;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Horizontal placement: flip to left if too close to right edge
    let left = x + OFFSET;
    if (x + OFFSET + POPUP_WIDTH > windowWidth) {
      left = Math.max(10, x - POPUP_WIDTH - OFFSET);
    }

    // Vertical placement: flip up if in lower half of screen or near bottom
    let top = y + OFFSET;
    if (y + OFFSET + POPUP_HEIGHT > windowHeight) {
      top = Math.max(10, y - POPUP_HEIGHT - 10);
    }

    return {
      top: `${top}px`,
      left: `${left}px`
    };
  };

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
          style={getPopupStyle()}
        >
          <img src={highResUrl} alt={cardName} />
        </div>,
        document.body
      )}
    </>
  );
};

export default CardMagnifier;
