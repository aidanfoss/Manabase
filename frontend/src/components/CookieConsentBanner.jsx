// frontend/src/components/CookieConsentBanner.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already consented or declined
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#1e293b',
        borderTop: '1px solid #334155',
        padding: '1.5rem 2rem',
        zIndex: 9999,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        boxShadow: '0 -4px 15px rgba(0,0,0,0.2)'
      }}
    >
      <div style={{ flex: '1 1 500px' }}>
        <p id="cookie-banner-title" style={{ margin: 0, color: '#f8fafc', fontSize: '0.95rem', lineHeight: '1.5' }}>
          We use strictly necessary cookies to keep you logged in and ensure application security. For more details,
          please read our <Link to="/cookie-policy" style={{ color: '#60a5fa', textDecoration: 'underline' }}>Cookie Policy</Link> and <Link to="/privacy" style={{ color: '#60a5fa', textDecoration: 'underline' }}>Privacy Policy</Link>.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleDecline}
          aria-label="Decline Optional Cookies"
          style={{
            background: 'transparent',
            border: '1px solid #475569',
            color: '#cbd5e1',
            padding: '0.5rem 1.25rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#334155'}
          onMouseOut={(e) => e.target.style.background = 'transparent'}
        >
          Decline Optional
        </button>
        <button
          onClick={handleAccept}
          aria-label="Accept Essential Cookies"
          style={{
            background: '#3b82f6',
            border: '1px solid #3b82f6',
            color: 'white',
            padding: '0.5rem 1.25rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#2563eb'}
          onMouseOut={(e) => e.target.style.background = '#3b82f6'}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
