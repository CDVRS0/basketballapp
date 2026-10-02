'use client';

import { useEffect, useState } from 'react';
import type {Session} from '@/lib/types';
import { sessionCancelCutoff } from '@/lib/demo-credits';
import { runAttendeesBySession } from '@/lib/demo-data';

export default function SessionCard({
  session,
  member = true,
  bookingStatus,
  bookingPaymentType,
  onBook,
}: {
  session: Session;
  member?: boolean;
  bookingStatus?: 'booked' | 'waitlisted' | 'pending_payment';
  bookingPaymentType?: 'member' | 'payg';
  onBook?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [showPlayers, setShowPlayers] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const start = new Date(session.startsAt).getTime();
  const end = new Date(session.endsAt).getTime();
  const live = now >= start && now <= end;
  const finished = now > end;
  const cancelled = session.status === 'cancelled';
  const full = session.booked >= session.capacity;
  const cancelClosed = bookingStatus === 'booked' && now >= sessionCancelCutoff(session);
  const percent = session.capacity > 0 ? Math.min(100, Math.max(0, (session.booked / session.capacity) * 100)) : 0;
  const livePercent = live && end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;
  const minutesPlayed = Math.max(0, Math.floor((now - start) / 60000));
  const minutesRemaining = Math.max(0, Math.ceil((end - now) / 60000));
  const roster = runAttendeesBySession[session.id] ?? [];

  const spaces = Math.max(0, session.capacity - session.booked);
  const label = full ? 'FULL' : `${spaces} ${spaces === 1 ? 'space' : 'spaces'} left`;
  const action = bookingStatus === 'booked'
    ? cancelClosed ? (bookingPaymentType === 'member' ? 'Credit used' : 'Cancellation closed') : 'Cancel booking'
    : bookingStatus === 'pending_payment'
      ? 'Continue payment'
    : bookingStatus === 'waitlisted'
      ? 'Leave waitlist'
      : full
        ? 'Join waitlist'
        : member ? 'Book · 1 credit' : 'Book · £7';

  return (
    <article className="card">
      <div className="row">
        <div>
          <div className="big">{new Date(session.startsAt).toLocaleString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}</div>
          <div className="mute">{session.venue} · {session.address}</div>
          <a className="mute" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.address)}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
        </div>
        <span className={cancelled || full ? 'pill bad' : 'pill blue'}>{cancelled ? 'CANCELLED' : live ? 'LIVE' : finished ? 'Finished' : full ? 'FULL' : label}</span>
      </div>

      <div className={`bar${live ? ' is-live' : ''}`} style={{ marginTop: 12 }}>
        <i style={{ width: `${live ? livePercent : percent}%`, background: live ? 'var(--ok)' : undefined, transition: 'width 1s linear' }} />
      </div>

      <div className="row" style={{ marginTop: '6px' }}>
        <span className="left">
          {live ? `LIVE · ${minutesPlayed} min played · ${minutesRemaining} min left` : bookingStatus === 'booked' ? 'Your place is booked' : bookingStatus === 'pending_payment' ? 'Payment required to confirm your place' : bookingStatus === 'waitlisted' ? 'You are on the waitlist' : finished ? 'Finished' : `${session.booked}/${session.capacity} · ${full ? 'No spaces left' : 'Spaces left'}`}
        </span>
        <button type="button" className="btn" onClick={onBook} disabled={cancelled || finished || cancelClosed}>
          {action}
        </button>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <span className="mute">{session.theme === 'takeover' ? 'Black/orange/white takeover theme' : 'Default CD4Q palette'}</span>
        <span className="mute">
          {bookingStatus === 'booked' && bookingPaymentType === 'member'
            ? cancelClosed ? 'Credit used after cancellation cutoff' : `Credit held until ${new Date(sessionCancelCutoff(session)).toLocaleString('en-GB')}`
            : bookingStatus === 'booked' ? 'PAYG booking' : member ? 'Member booking' : 'Pay as you go'}
        </span>
      </div>

      <button type="button" className="btn ghost small" aria-expanded={showPlayers} onClick={() => setShowPlayers((visible) => !visible)} style={{ marginTop: 12 }}>
        {showPlayers ? 'Hide players' : `View players · ${roster.length}`}
      </button>
      {showPlayers ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 12 }}>
        <span className="mute" style={{ gridColumn: '1 / -1' }}>Sample roster for the demo</span>
        {roster.map((player) => <div key={player.name} style={{ borderTop: '1px solid var(--edge)', padding: '8px 2px' }}>
          <b>{player.name}</b>
          <div className="mute">{player.position}</div>
        </div>)}
        {roster.length === 0 ? <span className="mute">No player list is available for this run yet.</span> : null}
      </div> : null}
    </article>
  );
}
