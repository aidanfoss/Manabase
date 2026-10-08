// frontend/src/pages/TermsPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { DocumentTextIcon } from '@heroicons/react/24/solid';

export default function TermsPage() {
  return (
    <div style={{ maxWidth: '900px', margin: '3rem auto', padding: '0 2rem', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <DocumentTextIcon style={{ width: '2.5rem', height: '2.5rem', color: '#3b82f6' }} />
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>Terms of Service</h1>
      </div>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Last updated: October 8, 2026</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', lineHeight: '1.7', color: '#cbd5e1' }}>
        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Manabase, you agree to be bound by these Terms of Service. If you do not agree to all of these terms,
            do not use our application or services.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>2. Use of Service</h2>
          <p>
            Manabase provides deckbuilding, land calculation, proxy management, and collection tools for Magic: The Gathering.
            You agree to use the service only for lawful purposes and in accordance with these Terms.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>3. Intellectual Property</h2>
          <p>
            Magic: The Gathering is a trademark of Wizards of the Coast LLC, a subsidiary of Hasbro, Inc. Manabase is unofficial Fan Content
            permitted under the Fan Content Policy. Card data, images, and symbols are copyright Wizards of the Coast.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>4. Limitation of Liability</h2>
          <p>
            Manabase is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied.
            We do not guarantee uninterrupted availability or absolute accuracy of pricing and card data.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>5. Changes to Terms</h2>
          <p>
            We reserve the right to modify or replace these Terms at any time. Continued use of Manabase after any changes constitutes
            acceptance of those changes.
          </p>
        </section>
      </div>

      <div style={{ marginTop: '3rem', borderTop: '1px solid #334155', paddingTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <Link to="/" style={{ color: '#60a5fa', textDecoration: 'none' }}>&larr; Back to Home</Link>
        <Link to="/privacy" style={{ color: '#60a5fa', textDecoration: 'none' }}>View Privacy Policy</Link>
      </div>
    </div>
  );
}
