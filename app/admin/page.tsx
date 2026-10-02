'use client';

import { useEffect, useState } from 'react';
import { defaultTournament, getTournamentConfig, saveTournamentConfig } from '@/lib/tournament-data';
import type { Session, TournamentConfig, TournamentFieldConfig } from '@/lib/types';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type AdminPlayer = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  disabled: boolean;
  tier: string;
  memberships: { id: string; status: string; product: string; paymentFailed: boolean; period?: { ends_at: string; payment_status: string } }[];
};

export default function Admin() {
  const [list, setList] = useState<Session[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [tournament, setTournament] = useState<TournamentConfig>(defaultTournament);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [accessToken, setAccessToken] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadAdminData = async () => {
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        if (!session?.access_token) return;
        const token = session.access_token;
        const headers = { Authorization: `Bearer ${token}` };
        const [sessionsResponse, playersResponse] = await Promise.all([
          fetch('/api/admin/sessions', { headers }),
          fetch('/api/admin/users', { headers }),
        ]);
        const sessionData = await sessionsResponse.json() as { sessions?: Session[]; error?: string };
        const playerData = await playersResponse.json() as { users?: AdminPlayer[]; error?: string };
        if (!sessionsResponse.ok) throw new Error(sessionData.error || 'Unable to load runs.');
        if (!playersResponse.ok) throw new Error(playerData.error || 'Unable to load players.');
        if (!active) return;
        setAccessToken(token);
        setList(sessionData.sessions ?? []);
        setPlayers(playerData.users ?? []);
        setTournament(getTournamentConfig());
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to load admin data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadAdminData();
    return () => { active = false; };
  }, []);

  const startSession = async () => {
    setMessage('');
    const token = accessToken;
    if (!token) return setMessage('Admin sign-in is required.');
    try {
      const response = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
      title: 'New CD4Q Run',
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 + 7200000).toISOString(),
      venue: 'New venue',
      address: 'Address to be confirmed',
      capacity: 12,
      booked: 0,
      cancelCutoffHours: 12,
      status: 'draft' as const,
      theme: 'default' as const,
        }),
      });
      const result = await response.json() as { session?: Session; error?: string };
      if (!response.ok || !result.session) throw new Error(result.error || 'Unable to create run.');
      setList((current) => [result.session!, ...current]);
      setEditingId(result.session.id);
      setMessage('Draft run created in the database. Add the details and publish when ready.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create run.');
    }
  };

  const saveSession = async (updated: Session) => {
    try {
      const response = await fetch(`/api/admin/sessions/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(updated),
      });
      const result = await response.json() as { session?: Session; error?: string };
      if (!response.ok || !result.session) throw new Error(result.error || 'Unable to update run.');
      setList((current) => current.map((row) => row.id === updated.id ? { ...updated, booked: result.session!.booked } : row));
      setEditingId(null);
      setMessage('Run changes saved to the database.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update run.');
    }
  };

  const cancelSession = async (session: Session) => {
    await saveSession({ ...session, status: 'cancelled' });
  };

  const invitePlayer = async () => {
    setMessage('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ email: playerEmail, fullName: playerName }),
      });
      const result = await response.json() as { userId?: string; error?: string };
      if (!response.ok || !result.userId) throw new Error(result.error || 'Unable to invite player.');
      setPlayers((current) => [{ id: result.userId!, full_name: playerName || playerEmail.split('@')[0], email: playerEmail, role: 'player', disabled: false, tier: 'Free / PAYG', memberships: [] }, ...current]);
      setPlayerEmail('');
      setPlayerName('');
      setMessage('Player invitation sent. They will appear as free/PAYG until they purchase a membership.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to invite player.');
    }
  };

  const togglePlayerAccess = async (player: AdminPlayer) => {
    try {
      const action = player.disabled ? 'restore' : 'disable';
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId: player.id, action }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to update player access.');
      setPlayers((current) => current.map((item) => item.id === player.id ? { ...item, disabled: !player.disabled } : item));
      setMessage(action === 'disable' ? 'Player sign-in disabled; booking and payment history retained.' : 'Player sign-in restored.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update player access.');
    }
  };

  return (
    <div className="wrap">
      <h2>Overview</h2>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="card stat">
          <b>{players.length}</b>
          <span className="mute">Registered</span>
        </div>
        <div className="card stat">
          <b>{players.filter((player) => player.memberships.some((membership) => ['active', 'trialing'].includes(membership.status))).length}</b>
          <span className="mute">Active members</span>
        </div>
        <div className="card stat">
          <b>{players.filter((player) => player.memberships.some((membership) => membership.paymentFailed)).length}</b>
          <span className="mute">Payment failed</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="row">
          <div>
            <b>Admin controls</b>
            <div className="mute">Create or edit runs, update themes, and send booking updates.</div>
          </div>
          <button type="button" className="btn" onClick={startSession}>Create run</button>
        </div>
      </div>

      {message ? <div className="banner" style={{ borderLeftColor: 'var(--ok)' }}>{message}</div> : null}
      {loading ? <div className="card mute">Loading admin data…</div> : null}

      <h2 id="sessions">Sessions</h2>
      {list.map((item) => (
        <div className="card" key={item.id}>
          {editingId === item.id ? (
            <EditSession
              session={item}
              onSave={(updated) => {
                void saveSession(updated);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className="row">
              <div>
                <div className="big" style={{ fontSize: 24 }}>{item.title}</div>
                <div className="mute">{new Date(item.startsAt).toLocaleString('en-GB')} · {item.venue}</div>
                <a className="mute" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`} target="_blank" rel="noreferrer">{item.address} · Open in Google Maps</a>
                <div className="mute">{item.booked}/{item.capacity} booked · {item.theme === 'takeover' ? 'Takeover theme' : 'Default theme'} · {item.status}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn ghost small" onClick={() => setEditingId(item.id)}>Edit</button>
                <button
                  type="button"
                  className="btn ghost small"
                  disabled={item.status === 'cancelled'}
                  onClick={() => void cancelSession(item)}
                >
                  {item.status === 'cancelled' ? 'Cancelled' : 'Cancel run'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <h2 id="players">Players and memberships</h2>
      <div className="card">
        <b>Invite player</b>
        <label className="mute" htmlFor="newPlayerName">Full name</label>
        <input id="newPlayerName" value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
        <label className="mute" htmlFor="newPlayerEmail">Email</label>
        <input id="newPlayerEmail" type="email" value={playerEmail} onChange={(event) => setPlayerEmail(event.target.value)} />
        <button type="button" className="btn" onClick={() => void invitePlayer()}>Invite player</button>
      </div>

      {players.map((player) => {
        const failed = player.memberships.some((membership) => membership.paymentFailed);
        return <div className="card" key={player.id}>
          <div className="row">
            <div>
              <b>{player.full_name || 'Player'}</b>
              <div className="mute">{player.email} · {player.tier}</div>
              {player.memberships.map((membership) => <div className="mute" key={membership.id}>
                {membership.product} · {membership.status}{membership.period?.ends_at ? ` · renews ${new Date(membership.period.ends_at).toLocaleDateString('en-GB')}` : ''}
              </div>)}
              {failed ? <span className="pill bad">Payment failed · {player.memberships.find((membership) => membership.paymentFailed)?.status}</span> : null}
              {player.disabled ? <span className="pill bad">Access disabled</span> : null}
            </div>
            <button type="button" className="btn ghost small" disabled={player.role === 'admin' || player.role === 'super_admin'} onClick={() => void togglePlayerAccess(player)}>
              {player.disabled ? 'Restore access' : 'Remove access'}
            </button>
          </div>
        </div>;
      })}

      <h2 id="events">Takeover tournament</h2>
      <div className="card">
        <label className="mute" htmlFor="tournamentTitle">Tournament name</label>
        <input id="tournamentTitle" value={tournament.title} onChange={(event) => setTournament({ ...tournament, title: event.target.value })} />

        <label className="mute" htmlFor="tournamentStart">Start date and time</label>
        <input id="tournamentStart" type="datetime-local" value={toLocalInput(tournament.startsAt)} onChange={(event) => setTournament({ ...tournament, startsAt: new Date(event.target.value).toISOString() })} />

        <label className="mute" htmlFor="tournamentEnd">End date and time</label>
        <input id="tournamentEnd" type="datetime-local" value={toLocalInput(tournament.endsAt)} onChange={(event) => setTournament({ ...tournament, endsAt: new Date(event.target.value).toISOString() })} />

        <label className="mute" htmlFor="registrationDeadline">Registration deadline</label>
        <input id="registrationDeadline" type="datetime-local" value={toLocalInput(tournament.registrationDeadline)} onChange={(event) => setTournament({ ...tournament, registrationDeadline: new Date(event.target.value).toISOString() })} />

        <label className="mute" htmlFor="tournamentVenue">Venue name</label>
        <input id="tournamentVenue" value={tournament.venue} onChange={(event) => setTournament({ ...tournament, venue: event.target.value })} />

        <label className="mute" htmlFor="tournamentAddress">Full address for Google Maps</label>
        <input id="tournamentAddress" value={tournament.address} onChange={(event) => setTournament({ ...tournament, address: event.target.value })} />

        <label className="mute" htmlFor="tournamentCategories">Age categories, comma separated</label>
        <input id="tournamentCategories" value={tournament.categories.join(', ')} onChange={(event) => setTournament({ ...tournament, categories: event.target.value.split(',').map((category) => category.trim()).filter(Boolean) })} />

        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {([3, 4, 5] as const).map((size) => (
            <div key={size}>
              <label className="mute" htmlFor={`price-${size}`}>{size} player team price (£)</label>
              <input id={`price-${size}`} type="number" min="0" step="0.01" value={tournament.prices[size]} onChange={(event) => setTournament({ ...tournament, prices: { ...tournament.prices, [size]: Number(event.target.value) } })} />
            </div>
          ))}
        </div>

        <label className="mute" htmlFor="pricingStatus">Price confirmation</label>
        <select id="pricingStatus" value={tournament.pricingStatus} onChange={(event) => setTournament({ ...tournament, pricingStatus: event.target.value as TournamentConfig['pricingStatus'] })}>
          <option value="illustrative">Illustrative prices · awaiting confirmation</option>
          <option value="confirmed">Confirmed prices</option>
        </select>

        <label className="mute" htmlFor="memberDiscountPercent">Member discount percentage (TBC)</label>
        <input id="memberDiscountPercent" type="number" min="0" max="100" value={tournament.memberDiscountPercent} onChange={(event) => setTournament({ ...tournament, memberDiscountPercent: Number(event.target.value) })} />

        <label className="mute" htmlFor="memberDiscountScope">Apply member discount to</label>
        <select id="memberDiscountScope" value={tournament.memberDiscountScope} onChange={(event) => setTournament({ ...tournament, memberDiscountScope: event.target.value as TournamentConfig['memberDiscountScope'] })}>
          <option value="tbc">TBC · not applied until confirmed</option>
          <option value="player-share">Member's own share</option>
          <option value="whole-team">Whole team price</option>
        </select>

        <label className="mute" htmlFor="maxTeams">Maximum teams</label>
        <input id="maxTeams" type="number" min="1" value={tournament.maxTeams} onChange={(event) => setTournament({ ...tournament, maxTeams: Number(event.target.value) })} />

        <h3 style={{ marginTop: 20 }}>Player details to collect</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {(Object.entries(tournament.fields) as [keyof TournamentFieldConfig, boolean][]).map(([field, enabled]) => (
            <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={enabled} onChange={(event) => setTournament({ ...tournament, fields: { ...tournament.fields, [field]: event.target.checked } })} style={{ width: 'auto' }} />
              <span className="mute">{fieldLabels[field]}</span>
            </label>
          ))}
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <span className="mute">Changes save in this browser demo; database publishing needs Supabase configuration.</span>
          <button type="button" className="btn" onClick={() => { saveTournamentConfig(tournament); setMessage('Tournament settings saved in this browser.'); }}>Save tournament</button>
        </div>
      </div>
    </div>
  );
}

const fieldLabels: Record<keyof TournamentFieldConfig, string> = {
  homeTown: 'Home town',
  email: 'Player email',
  emergencyContact: 'Emergency contact name and number',
  age: 'Age and under-18 guardian fields',
  medical: 'Medical information',
  allergies: 'Allergies',
  mediaConsent: 'Media consent',
  position: 'Playing position',
  skillLevel: 'Skill level',
};

function toLocalInput(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function EditSession({ session, onSave, onCancel }: { session: Session; onSave: (session: Session) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(session);
  const formatDateTime = (value: string) => {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  return (
    <div>
      <label className="mute" htmlFor="title">Title</label>
      <input id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />

      <label className="mute" htmlFor="startsAt">Start date and time</label>
      <input id="startsAt" type="datetime-local" value={formatDateTime(draft.startsAt)} onChange={(e) => setDraft({ ...draft, startsAt: new Date(e.target.value).toISOString() })} />

      <label className="mute" htmlFor="endsAt">End date and time</label>
      <input id="endsAt" type="datetime-local" value={formatDateTime(draft.endsAt)} onChange={(e) => setDraft({ ...draft, endsAt: new Date(e.target.value).toISOString() })} />

      <label className="mute" htmlFor="venue">Venue</label>
      <input id="venue" value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} />

      <label className="mute" htmlFor="address">Address</label>
      <input id="address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />

      <label className="mute" htmlFor="capacity">Capacity</label>
      <input id="capacity" type="number" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })} />

      <label className="mute" htmlFor="cancelCutoffHours">Free cancellation window (hours)</label>
      <input id="cancelCutoffHours" type="number" min="0" value={draft.cancelCutoffHours ?? 12} onChange={(e) => setDraft({ ...draft, cancelCutoffHours: Number(e.target.value) })} />

      <label className="mute" htmlFor="status">Run status</label>
      <select id="status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as typeof draft.status })}>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="cancelled">Cancelled</option>
      </select>

      <label className="mute" htmlFor="theme">Theme</label>
      <select id="theme" value={draft.theme || 'default'} onChange={(e) => setDraft({ ...draft, theme: e.target.value as typeof draft.theme })}>
        <option value="default">Default</option>
        <option value="blue">Blue</option>
        <option value="takeover">Takeover black/orange/white</option>
      </select>

      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn ghost small" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn" onClick={() => onSave(draft)}>Save</button>
      </div>
    </div>
  );
}
