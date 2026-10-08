// frontend/src/pages/CookiePolicy.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';

export default function CookiePolicy() {
  return (
    <div style={{ maxWidth: '900px', margin: '3rem auto', padding: '0 2rem', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <ShieldCheckIcon style={{ width: '2.5rem', height: '2.5rem', color: '#3b82f6' }} />
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>Cookie Policy</h1>
      </div>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Last updated: October 8, 2026</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', lineHeight: '1.7', color: '#cbd5e1' }}>
        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>1. What Are Cookies</h2>
          <p>
            Cookies are small text files stored on your device when you visit a website. They are widely used to make websites work efficiently
            and provide reporting information to site operators.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>2. How We Use Cookies</h2>
          <p>
            Manabase uses strictly necessary cookies and local storage tokens to maintain your session authentication, remember your preferences
            (such as dark mode and land cycles), and ensure application security. We do not use third-party tracking or advertising cookies.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>3. Managing Cookies</h2>
          <p>
            You can control or delete cookies through your browser settings. Note that disabling essential session cookies may prevent you from
            logging in or using core features of Manabase.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>4. Contact Us</h2>
          <p>
            If you have questions about our cookie usage, contact us at <a href="mailto:support@manabase.com" style={{ color: '#60a5fa' }}>support@manabase.com</a>.
          </p>
        </section>
      </div>

      <div style={{ marginTop: '3rem', borderTop: '1px solid #334155', paddingTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <Link to="/" style={{ color: '#60a5fa', textDecoration: 'none' }}>&larr; Back to Home</Link>
        <Link to="/privacy" style={{ color: '#60a5fa', textDecoration: 'none' }}>Privacy Policy</Link>
      </div>
    </div>
  );
}
