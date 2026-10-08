import React, { useState } from 'react';
import ReactDOM from 'react-dom';

const CardMagnifier = ({ cardImageUrl, cardName, children, className = '', style = {} }) => {
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
    const PADDING = 16;

    // Horizontal placement:
    // Place to the right of cursor by default; flip to left if it overflows right edge
    let left = x + OFFSET;
    if (left + POPUP_WIDTH > windowWidth - PADDING) {
      left = x - POPUP_WIDTH - OFFSET;
    }
    // Prevent bleeding off left or right edge of viewport
    left = Math.max(PADDING, Math.min(left, windowWidth - POPUP_WIDTH - PADDING));

    // Vertical placement:
    // Keep aligned alongside the cursor without jumping wildly above content
    // Clamp smoothly so the preview remains fully visible in the viewport
    let top = y - 40;
    if (top + POPUP_HEIGHT > windowHeight - PADDING) {
      top = windowHeight - POPUP_HEIGHT - PADDING;
    }
    top = Math.max(PADDING, top);

    return {
      top: `${top}px`,
      left: `${left}px`
    };
  };

  return (
    <>
      <div
        className={className}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        tabIndex="0"
        role="button"
        aria-label={`Show high quality preview of ${cardName}`}
        style={{ display: 'block', width: '100%', cursor: 'zoom-in', outline: 'none', ...style }}
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
