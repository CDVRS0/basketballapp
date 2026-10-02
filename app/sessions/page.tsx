'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import SessionCard from '@/components/SessionCard';
import type { Session } from '@/lib/types';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type PlayerBooking = {
  id: string;
  session_id: string;
  status: 'pending_payment' | 'booked' | 'waitlist' | 'cancelled';
  source: 'member' | 'payg';
  credit_ledger_id: string | null;
};

type BookingResponse = {
  bookings: PlayerBooking[];
  credits: { available: number; paygRefundAvailable: number; held: number; used: number };
};

export default function Sessions() {
  const [member, setMember] = useState(true);
  const [notice, setNotice] = useState('');
  const [sessionList, setSessionList] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<PlayerBooking[]>([]);
  const [credits, setCredits] = useState({ available: 0, paygRefundAvailable: 0, held: 0, used: 0 });
  const [refundChoice, setRefundChoice] = useState<{ bookingId: string; sessionTitle: string } | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingSessionId, setWorkingSessionId] = useState('');

  const refreshData = useCallback(async (token: string) => {
    const headers = { Authorization: `Bearer ${token}` };
    const [sessionsResponse, bookingsResponse] = await Promise.all([
      fetch('/api/sessions', { headers }),
      fetch('/api/bookings', { headers }),
    ]);
    const sessionsData = await sessionsResponse.json() as { sessions?: Session[]; error?: string };
    const bookingsData = await bookingsResponse.json() as BookingResponse & { error?: string };
    if (!sessionsResponse.ok) throw new Error(sessionsData.error || 'Unable to load sessions.');
    if (!bookingsResponse.ok) throw new Error(bookingsData.error || 'Unable to load bookings.');
    setSessionList(sessionsData.sessions ?? []);
    setBookings(bookingsData.bookings ?? []);
    setCredits(bookingsData.credits ?? { available: 0, paygRefundAvailable: 0, held: 0, used: 0 });
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        if (!active) return;
        if (!session?.access_token) {
          setNotice('Sign in to view and book sessions.');
          setLoading(false);
          return;
        }
        setAccessToken(session.access_token);
        await refreshData(session.access_token);
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : 'Unable to load sessions.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [refreshData]);

  const startPaygCheckout = async (bookingId: string, sessionId: string, token: string) => {
    const response = await fetch('/api/stripe/create-payg-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bookingId, sessionId }),
    });
    const data = await response.json() as { url?: string; error?: string };
    if (!response.ok || !data.url) throw new Error(data.error || 'Unable to start PAYG checkout.');
    window.location.assign(data.url);
  };

  const handleBooking = async (session: Session, refundMethod?: 'credit' | 'bank') => {
    if (!accessToken) {
      setNotice('Sign in to book a session.');
      return;
    }

    setWorkingSessionId(session.id);
    setNotice('');
    try {
      const current = bookings.find((booking) => booking.session_id === session.id && booking.status !== 'cancelled');
      if (current?.status === 'booked' && current.source === 'payg' && !refundMethod) {
        setRefundChoice({ bookingId: current.id, sessionTitle: session.title });
        return;
      }
      if (current?.status === 'pending_payment') {
        await startPaygCheckout(current.id, session.id, accessToken);
        return;
      }

      if (current) {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ action: 'cancel', bookingId: current.id, refundMethod }),
        });
        const result = await response.json() as { error?: string; refundStatus?: string | null; credit_refunded?: boolean };
        if (!response.ok) throw new Error(result.error || 'Unable to cancel this booking.');
        setRefundChoice(null);
        setNotice(result.credit_refunded
          ? 'One run credit was added to your account. It is available in your credit balance.'
          : result.refundStatus
          ? 'Refund initiated. The time it takes to appear depends on your payment provider.'
          : current.status === 'waitlist' ? 'You left the waitlist.' : 'Booking cancelled; your member credit was returned if eligible.');
        await refreshData(accessToken);
        return;
      }

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ sessionId: session.id, paymentType: member ? 'member' : 'payg' }),
      });
      const result = await response.json() as { booking_id?: string; status?: string; payment_required?: boolean; error?: string };
      if (!response.ok || !result.booking_id) throw new Error(result.error || 'Unable to create this booking.');

      if (result.status === 'waitlist') {
        setNotice('You have joined the session waitlist. No payment or credit was taken.');
        await refreshData(accessToken);
        return;
      }

      if (result.payment_required) {
        await startPaygCheckout(result.booking_id, session.id, accessToken);
        return;
      }

      setNotice('Your place is booked using one membership credit.');
      await refreshData(accessToken);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to complete this booking.');
      await refreshData(accessToken).catch(() => undefined);
    } finally {
      setWorkingSessionId('');
    }
  };

  return (
    <div className="wrap">
      <h2>Sessions</h2>

      {!accessToken && !loading ? <div className="banner">{notice} <Link href="/login" style={{ color: 'var(--blue)' }}>Log in</Link></div> : null}

      {accessToken ? <>
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <b>Membership credits</b>
            <span className="pill blue">{credits.available} available</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: 12 }}>
            <div><b className="big">{credits.available}</b><div className="mute">Available</div></div>
            <div><b className="big">{credits.held}</b><div className="mute">Held</div></div>
            <div><b className="big">{credits.used}</b><div className="mute">Used</div></div>
          </div>
          <div className="banner" style={{ margin: '0 0 12px' }}>
            PAYG refund credits: <b>{credits.paygRefundAvailable}</b>
            <span className="mute"> · each credit covers one eligible run</span>
          </div>
          <div className="seg" style={{ width: 'max-content' }}>
            <button type="button" className={member ? 'on' : ''} aria-pressed={member} onClick={() => setMember(true)}>Member · {credits.available} credits</button>
            <button type="button" className={!member ? 'on' : ''} aria-pressed={!member} onClick={() => setMember(false)}>PAYG · £7</button>
          </div>
        </div>

        {notice ? <div className="banner" role="status">{notice}</div> : null}
        {loading ? <div className="card mute">Loading sessions…</div> : null}
        {!loading && sessionList.length === 0 ? <div className="card mute">No published sessions are available.</div> : null}

        {sessionList.map((session) => {
          const booking = bookings.find((item) => item.session_id === session.id && item.status !== 'cancelled');
          return <div key={session.id} aria-busy={workingSessionId === session.id}>
            <SessionCard
              session={session}
              member={member}
              bookingStatus={booking?.status === 'waitlist' ? 'waitlisted' : booking?.status === 'booked' || booking?.status === 'pending_payment' ? booking.status : undefined}
              bookingPaymentType={booking?.source}
              onBook={() => void handleBooking(session)}
            />
          </div>;
        })}
      </> : null}

      {refundChoice ? <div className="card" role="dialog" aria-modal="true" aria-labelledby="refund-choice-title">
        <h3 id="refund-choice-title">Choose your PAYG refund</h3>
        <p className="mute">{refundChoice.sessionTitle} · cancellation is within the free-refund window.</p>
        <p>Choose one run credit or a refund to your original payment method. You can’t receive both.</p>
        <div className="row">
          <button type="button" className="btn ghost small" onClick={() => setRefundChoice(null)}>Keep booking</button>
          <button type="button" className="btn ghost small" disabled={workingSessionId !== ''} onClick={() => {
            const session = sessionList.find((item) => item.id === bookings.find((booking) => booking.id === refundChoice.bookingId)?.session_id);
            if (session) void handleBooking(session, 'bank');
          }}>Refund to bank</button>
          <button type="button" className="btn" disabled={workingSessionId !== ''} onClick={() => {
            const session = sessionList.find((item) => item.id === bookings.find((booking) => booking.id === refundChoice.bookingId)?.session_id);
            if (session) void handleBooking(session, 'credit');
          }}>Get 1 run credit</button>
        </div>
      </div> : null}
    </div>
  );
}