'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type DashboardBooking = {
  id: string;
  status: 'pending_payment' | 'booked' | 'waitlist';
  sessions: {
    title: string;
    starts_at: string;
    venue_name: string;
    address: string;
  } | {
    title: string;
    starts_at: string;
    venue_name: string;
    address: string;
  }[] | null;
};

type DashboardData = {
  bookings: DashboardBooking[];
  membership: {
    name: string;
    status: string;
    periodStartsAt: string | null;
    periodEndsAt: string | null;
  } | null;
  credits: { available: number; paygRefundAvailable: number; held: number; used: number };
};

export default function Dashboard() {
  const [mapsApp, setMapsApp] = useState<'Google Maps' | 'Apple Maps'>('Google Maps');
  const [data, setData] = useState<DashboardData | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        if (!active) return;
        if (!session?.access_token) {
          setMessage('Sign in to view your membership and bookings.');
          setLoading(false);
          return;
        }

        setEmail(session.user.email ?? '');
        const checkoutReturned = new URLSearchParams(window.location.search).get('membership') === 'success';
        const attempts = checkoutReturned ? 8 : 1;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const response = await fetch('/api/bookings', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: 'no-store',
          });
          const result = await response.json() as DashboardData & { error?: string };
          if (!response.ok) throw new Error(result.error || 'Unable to load your dashboard.');
          if (!active) return;
          setData(result);
          const membershipReady = Boolean(result.membership?.periodEndsAt && result.credits.available > 0);
          if (!checkoutReturned || membershipReady || attempt === attempts - 1) {
            if (checkoutReturned && !membershipReady) setMessage('Payment received. Membership and credits are still being confirmed. Refresh this page shortly.');
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to load your dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const upcoming = (data?.bookings ?? []).flatMap((booking) => {
    const session = Array.isArray(booking.sessions) ? booking.sessions[0] : booking.sessions;
    return session ? [{ ...booking, session }] : [];
  }).sort((left, right) => new Date(left.session.starts_at).getTime() - new Date(right.session.starts_at).getTime());

  return (
    <div className="wrap">
      <div className="banner">
        <b>CD4Q is back</b>
        <br />
        Fortnightly runs start soon. Book early, spaces go fast.
      </div>

      <h2>Your dashboard</h2>
      {loading ? <div className="card mute">Loading your account…</div> : null}
      {!loading && !data ? <div className="banner" role="status">{message} <Link href="/login" style={{ color: 'var(--blue)' }}>Log in</Link></div> : null}

      {data ? <>
        <div className="card">
          <div className="row">
            <div className="big">{data.membership?.name ?? 'No membership'}</div>
            <span className={`pill ${data.membership?.status === 'active' ? 'ok' : 'blue'}`}>{data.membership?.status ?? 'PAYG'}</span>
          </div>
          {data.membership?.periodStartsAt && data.membership.periodEndsAt
            ? <p className="mute" style={{ margin: '6px 0' }}>Billing period: {new Date(data.membership.periodStartsAt).toLocaleDateString('en-GB')} to {new Date(data.membership.periodEndsAt).toLocaleDateString('en-GB')}</p>
            : <p className="mute" style={{ margin: '6px 0' }}>Pay as you go · £7 per session</p>}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: '10px' }}>
            <div><b className="big">{data.credits.available}</b><div className="mute">Available</div></div>
            <div><b className="big">{data.credits.held}</b><div className="mute">Held</div></div>
            <div><b className="big">{data.credits.used}</b><div className="mute">Used</div></div>
          </div>
          <p className="mute" style={{ margin: '8px 0 0' }}>PAYG refund credits: {data.credits.paygRefundAvailable} · each covers one eligible run.</p>
          <p className="mute" style={{ margin: '8px 0 0' }}>If CDVRS cancels a run, a replacement credit is valid until the later of the original billing-period end or 30 days after cancellation.</p>
        </div>

        <div className="row">
          <h2>Upcoming bookings</h2>
          <Link className="btn ghost small" href="/sessions">Find a run</Link>
        </div>
        {upcoming.length ? upcoming.map((booking) => {
          const mapHref = mapsApp === 'Apple Maps'
            ? `https://maps.apple.com/?q=${encodeURIComponent(booking.session.address)}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.session.address)}`;
          const status = booking.status === 'waitlist' ? 'Waitlist' : booking.status === 'pending_payment' ? 'Payment pending' : 'Booked';
          return <div key={booking.id} className="card">
            <div className="row">
              <div>
                <b>{new Date(booking.session.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {booking.session.title}</b>
                <div className="mute">{booking.session.venue_name} · {booking.session.address}</div>
                <a className="mute" href={mapHref} target="_blank" rel="noreferrer">Open location in {mapsApp}</a>
              </div>
              <span className={`pill ${booking.status === 'booked' ? 'ok' : 'blue'}`}>{status}</span>
            </div>
          </div>;
        }) : <div className="card mute">You do not have any upcoming bookings yet.</div>}
      </> : null}

      <h2>Settings</h2>
      <div className="card">
        <div className="mute">Maps app for directions</div>
        <div className="seg" style={{ width: 'max-content', margin: '6px 0' }}>
          <button type="button" className={mapsApp === 'Google Maps' ? 'on' : ''} aria-pressed={mapsApp === 'Google Maps'} onClick={() => setMapsApp('Google Maps')}>Google Maps</button>
          <button type="button" className={mapsApp === 'Apple Maps' ? 'on' : ''} aria-pressed={mapsApp === 'Apple Maps'} onClick={() => setMapsApp('Apple Maps')}>Apple Maps</button>
        </div>
        <div className="mute" aria-live="polite">Selected: {mapsApp}</div>
        {email ? <p className="mute" style={{ margin: 0 }}>Signed in as {email}</p> : null}
      </div>

      <p className="mute">
        Questions?{' '}
        <Link href="/profile" style={{ color: 'var(--blue)' }}>View profile</Link>
      </p>
    </div>
  );
}