// frontend/src/pages/NotFound.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon, CubeIcon } from '@heroicons/react/24/solid';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      textAlign: 'center',
      padding: '0 2rem',
      color: '#f8fafc',
      fontFamily: 'Inter, sans-serif'
    }}>
      <ExclamationTriangleIcon style={{ width: '4rem', height: '4rem', color: '#f59e0b', marginBottom: '1.5rem' }} />
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>404 - Page Not Found</h1>
      <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '500px', marginBottom: '2rem' }}>
        The page you are looking for has been tapped, countered, or does not exist.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link
          to="/"
          style={{
            background: '#3b82f6',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <CubeIcon style={{ width: '1.2em', height: '1.2em' }} /> Return Home
        </Link>
        <Link
          to="/builder"
          style={{
            background: '#334155',
            color: '#f8fafc',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600'
          }}
        >
          Open Deckbuilder
        </Link>
      </div>
    </div>
  );
}
