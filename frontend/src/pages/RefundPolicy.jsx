// frontend/src/pages/RefundPolicy.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { CurrencyDollarIcon } from '@heroicons/react/24/solid';

export default function RefundPolicy() {
  return (
    <div style={{ maxWidth: '900px', margin: '3rem auto', padding: '0 2rem', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <CurrencyDollarIcon style={{ width: '2.5rem', height: '2.5rem', color: '#3b82f6' }} />
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>Refund Policy</h1>
      </div>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Last updated: October 8, 2026</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', lineHeight: '1.7', color: '#cbd5e1' }}>
        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>1. Digital Services Overview</h2>
          <p>
            Manabase is a free-to-use digital utility for Magic: The Gathering deckbuilding. For any optional donations or digital premium features
            (if introduced in the future), this policy outlines your rights regarding refunds and cancellations.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>2. Subscription or Digital Purchases</h2>
          <p>
            Due to the immediate access nature of digital services, any future optional donations or premium subscriptions are generally non-refundable
            once access is granted. If you experience technical disruptions preventing your use of purchased features, please contact support within 14 days.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>3. Exemptions & Exceptional Circumstances</h2>
          <p>
            Refunds requested due to billing errors or duplicated charges will be processed promptly upon verification (typically within 5-10 business days).
          </p>
        </section>

        <section>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '0.75rem' }}>4. Contact for Billing Inquiries</h2>
          <p>
            Please direct all refund and billing inquiries to <a href="mailto:billing@manabase.com" style={{ color: '#60a5fa' }}>billing@manabase.com</a>.
          </p>
        </section>
      </div>

      <div style={{ marginTop: '3rem', borderTop: '1px solid #334155', paddingTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <Link to="/" style={{ color: '#60a5fa', textDecoration: 'none' }}>&larr; Back to Home</Link>
        <Link to="/terms" style={{ color: '#60a5fa', textDecoration: 'none' }}>Terms of Service</Link>
      </div>
    </div>
  );
}
