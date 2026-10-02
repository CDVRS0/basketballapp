'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type MembershipPlan = 'monthly_15' | 'every_2_months_30';

export default function Plan() {
  const [loading, setLoading] = useState<MembershipPlan | ''>('');
  const [message, setMessage] = useState('');

  async function handleCheckout(plan: MembershipPlan) {
    setLoading(plan);
    setMessage('');

    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session?.access_token) throw new Error('Sign in before choosing a membership.');

      const response = await fetch('/api/stripe/create-membership-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const responseText = await response.text();
      let data: { url?: string; error?: string };
      try {
        data = responseText ? JSON.parse(responseText) as { url?: string; error?: string } : {};
      } catch {
        throw new Error(`Checkout service returned an invalid response (${response.status}). Try again or contact support.`);
      }
      if (!response.ok) throw new Error(data.error || 'Unable to start membership checkout.');
      if (!data.url) throw new Error('Stripe Checkout URL was not returned.');
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start membership checkout.');
      setLoading('');
    }
  }

  return (
    <div className="wrap">
      <h2>Membership</h2>

      <div className="card plan cur">
        <div className="row">
          <h3 className="big">Pay as you go</h3>
          <b>£7 / session</b>
        </div>
        <p className="mute">Choose the run first. Payment is attached to that booking.</p>
        <Link className="btn" href="/sessions">Choose a session</Link>
      </div>

      <div className="card plan">
        <div className="row">
          <h3 className="big">CD4Q 2</h3>
          <b>£15 / month</b>
        </div>
        <p className="mute">2 credits per billing period. Priority access to future runs and waitlist priority.</p>
        <button type="button" className="btn" onClick={() => handleCheckout('monthly_15')} disabled={Boolean(loading)}>
          {loading === 'monthly_15' ? 'Opening checkout…' : 'Choose CD4Q 2'}
        </button>
      </div>

      <div className="card plan">
        <div className="row">
          <h3 className="big">CD4Q 4</h3>
          <b>£30 / 2 months</b>
        </div>
        <p className="mute">4 credits per billing period and priority waitlist access. Takeover member discount is awaiting confirmation.</p>
        <button type="button" className="btn" onClick={() => handleCheckout('every_2_months_30')} disabled={Boolean(loading)}>
          {loading === 'every_2_months_30' ? 'Opening checkout…' : 'Choose CD4Q 4'}
        </button>
      </div>

      {message ? <div className="banner" role="alert">{message}</div> : null}
    </div>
  );
}