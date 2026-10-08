// frontend/src/pages/PrivacyPolicy.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { CubeIcon, ShieldCheckIcon } from '@heroicons/react/24/solid';

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: '900px', margin: '3rem auto', padding: '0 2rem', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <ShieldCheckIcon style={{ width: '2.5rem', height: '2.5rem', color: '#3b82f6' }} />
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>Privacy Policy</h1>
      </div>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Last updated: October 8, 2026</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', lineHeight: '1.7', color: '#cbd5e1' }}>
        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>1. Introduction</h2>
          <p>
            Welcome to Manabase ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data.
            This Privacy Policy explains how we collect, use, and safeguard your information when you use our web application and services.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>2. Information We Collect</h2>
          <p>
            We may collect information you provide directly to us when creating an account, syncing decks (via Archidekt, Moxfield),
            managing your collection, or communicating with us. This includes your username, email address, authentication credentials,
            and deck lists or card inventories you input.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>3. How We Use Your Information</h2>
          <p>
            We use the information we collect to provide, maintain, and improve our services, authenticate your sessions, sync your decks,
            calculate mana base recommendations, and facilitate community trading and wishlist features.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>4. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your data from unauthorized access, alteration, disclosure, or destruction.
            However, no transmission over the internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>5. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@manabase.com" style={{ color: '#60a5fa' }}>support@manabase.com</a>.
          </p>
        </section>
      </div>

      <div style={{ marginTop: '3rem', borderTop: '1px solid #334155', paddingTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <Link to="/" style={{ color: '#60a5fa', textDecoration: 'none' }}>&larr; Back to Home</Link>
        <Link to="/terms" style={{ color: '#60a5fa', textDecoration: 'none' }}>View Terms of Service</Link>
      </div>
    </div>
  );
}
