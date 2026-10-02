'use client';

import { useEffect, useState } from 'react';
import './registration.css';
import { defaultTournament, emptyTournamentPlayer, getTournamentConfig, tournamentConfigEvent } from '@/lib/tournament-data';
import type { TournamentConfig, TournamentPlayerDetails, TournamentAgreement } from '@/lib/types';

const agreements: { key: TournamentAgreement; text: string }[] = [
  { key: 'informationAccuracy', text: 'I confirm the information I have provided is accurate.' },
  { key: 'physicalRisk', text: 'I understand basketball is a physical sport and I participate at my own risk.' },
  { key: 'rulesAndRespect', text: 'I agree to follow the tournament rules and respect referees, staff and other players.' },
  { key: 'conductRemoval', text: 'I understand that poor behaviour, abuse of officials or fighting may result in me or my team being removed from the tournament.' },
  { key: 'personalBelongings', text: 'I understand the organisers are not responsible for any lost, stolen or damaged personal belongings.' },
  { key: 'emergencyTreatment', text: 'I consent to emergency medical treatment being sought if required.' },
];

const skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Elite'];

export default function Events() {
  const [tournament, setTournament] = useState<TournamentConfig>(defaultTournament);
  const [now, setNow] = useState(Date.now());
  const [teamName, setTeamName] = useState('');
  const [teamSize, setTeamSize] = useState<3 | 4 | 5>(3);
  const [category, setCategory] = useState(defaultTournament.categories[0]);
  const [captainIndex, setCaptainIndex] = useState(0);
  const [players, setPlayers] = useState<TournamentPlayerDetails[]>(Array.from({ length: 3 }, emptyTournamentPlayer));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const updateConfig = () => {
      const config = getTournamentConfig();
      setTournament(config);
      setCategory((current) => config.categories.includes(current) ? current : config.categories[0] ?? 'Open');
    };
    updateConfig();
    window.addEventListener(tournamentConfigEvent, updateConfig);
    return () => window.removeEventListener(tournamentConfigEvent, updateConfig);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const updatePlayer = (index: number, update: Partial<TournamentPlayerDetails>) => {
    setPlayers((current) => current.map((player, playerIndex) => playerIndex === index ? { ...player, ...update } : player));
  };

  const setSize = (size: 3 | 4 | 5) => {
    setTeamSize(size);
    setPlayers((current) => Array.from({ length: size }, (_, index) => current[index] ?? emptyTournamentPlayer()));
    setCaptainIndex((current) => Math.min(current, size - 1));
  };

  const validate = (): string => {
    if (!teamName.trim()) return 'Enter your team name.';
    if (!tournament.categories.includes(category)) return 'Choose an available age category.';
    for (const [index, player] of players.entries()) {
      const label = `Player ${index + 1}`;
      if (!player.fullName.trim() || (tournament.fields.email && !player.email.trim())) return `${label}: enter the required name and email details.`;
      if (tournament.fields.homeTown && !player.homeTown.trim()) return `${label}: enter a home town.`;
      if (tournament.fields.age && (player.age === '' || player.age < 5 || player.age > 99)) return `${label}: enter a valid age.`;
      if (tournament.fields.emergencyContact && (!player.emergencyName.trim() || !player.emergencyPhone.trim())) return `${label}: enter an emergency contact name and number.`;
      if (tournament.fields.position && !player.position) return `${label}: choose a playing position.`;
      if (tournament.fields.skillLevel && !player.skillLevel) return `${label}: choose a skill level.`;
      if (tournament.fields.mediaConsent && player.mediaConsent === null) return `${label}: answer the media consent question.`;
      const requiresGuardian = under18Category || (typeof player.age === 'number' && player.age < 18);
      if (requiresGuardian
        && (!player.guardianName.trim() || !player.guardianEmail.trim() || !player.guardianPhone.trim() || !player.guardianConsent)) {
        return `${label}: under-18 players need guardian details and consent.`;
      }
      if (!player.dataProtectionAccepted) return `${label}: accept the data protection notice.`;
      if (agreements.some(({ key }) => !player.agreements[key])) return `${label}: accept all tournament agreements.`;
    }
    if (Date.now() > new Date(tournament.registrationDeadline).getTime()) return 'Registration for this tournament has closed.';
    return '';
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/tournament-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id, teamName: teamName.trim(), teamSize, category, captainIndex, players }),
      });
      const result = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error || 'Secure checkout is unavailable.');
      window.location.assign(result.checkoutUrl);
    } catch (submitError) {
      setNotice(submitError instanceof Error ? submitError.message : 'Secure checkout is unavailable.');
    } finally {
      setSubmitting(false);
    }
  };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tournament.address)}`;
  const formatPrice = (amount: number) => amount.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
  const price = formatPrice(tournament.prices[teamSize]);
  const startsAt = new Date(tournament.startsAt).getTime();
  const endsAt = new Date(tournament.endsAt).getTime();
  const isLive = now >= startsAt && now < endsAt;
  const isFinished = now >= endsAt;
  const liveProgress = isLive && endsAt > startsAt ? Math.min(100, ((now - startsAt) / (endsAt - startsAt)) * 100) : isFinished ? 100 : 0;
  const under18Category = /under[\s-]?(16|18)|u[\s-]?(16|18)/i.test(category);

  return (
    <div className="wrap">
      <h2>{tournament.title}</h2>
      <div className="card takeover-card">
        <div className="row">
          <div>
            <b>{new Date(tournament.startsAt).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</b>
            <div className="mute">{tournament.venue} · {tournament.address}</div>
            <a href={mapsUrl} target="_blank" rel="noreferrer">Open tournament location in Google Maps</a>
          </div>
          <span className={isLive ? 'pill ok' : 'pill blue'}>{isLive ? 'LIVE' : isFinished ? 'Finished' : `${price} team fee`}</span>
        </div>
        <div className={`bar${isLive ? ' is-live' : ''}`} style={{ marginTop: 14 }}>
          <i style={{ width: `${liveProgress}%`, background: isLive ? 'var(--ok)' : undefined, transition: 'width 1s linear' }} />
        </div>
        {isLive ? <div className="mute">LIVE · {Math.floor((now - startsAt) / 60000)} min played · {Math.max(0, Math.ceil((endsAt - now) / 60000))} min left</div> : null}
        {tournament.pricingStatus !== 'confirmed' ? <p className="mute">Team prices are illustrative and awaiting confirmation. Member discount scope is TBC.</p> : null}
        <p className="mute">Tournament medical and allergy details are removed when the event ends. Run medical details stay on the player profile until the player removes them.</p>
        <p className="mute">Member discount scope is {tournament.memberDiscountScope === 'tbc' ? 'TBC and is not applied' : tournament.memberDiscountScope === 'player-share' ? 'set to the member’s own share' : 'set to the whole team'}.</p>
      </div>

      <h2>Team registration</h2>
      <div className="card">
        <label className="mute" htmlFor="teamName">Team name</label>
        <input id="teamName" value={teamName} onChange={(event) => setTeamName(event.target.value)} required />

        <label className="mute" htmlFor="teamSize">Team size</label>
        <select id="teamSize" value={teamSize} onChange={(event) => setSize(Number(event.target.value) as 3 | 4 | 5)}>
          {([3, 4, 5] as const).map((size) => <option key={size} value={size}>{size} players · {formatPrice(tournament.prices[size])}</option>)}
        </select>

        <label className="mute" htmlFor="ageCategory">Age category</label>
        <select id="ageCategory" value={category} onChange={(event) => setCategory(event.target.value)}>
          {tournament.categories.map((option) => <option key={option}>{option}</option>)}
        </select>

        <label className="mute" htmlFor="teamCaptain">Team captain</label>
        <select id="teamCaptain" value={captainIndex} onChange={(event) => setCaptainIndex(Number(event.target.value))}>
          {players.map((player, index) => <option key={index} value={index}>{player.fullName.trim() || `Player ${index + 1}`}</option>)}
        </select>

        {players.map((player, index) => {
          const isMinor = under18Category || (typeof player.age === 'number' && player.age < 18);
          return (
            <section className="player-form" key={index} aria-labelledby={`player-heading-${index}`}>
              <h3 id={`player-heading-${index}`}>Player {index + 1}{captainIndex === index ? ' · Captain' : ''}</h3>
              <label className="mute" htmlFor={`player-name-${index}`}>Full name</label>
              <input id={`player-name-${index}`} value={player.fullName} onChange={(event) => updatePlayer(index, { fullName: event.target.value })} required />

              {tournament.fields.email ? <>
                <label className="mute" htmlFor={`player-email-${index}`}>Email</label>
                <input id={`player-email-${index}`} type="email" value={player.email} onChange={(event) => updatePlayer(index, { email: event.target.value })} required />
              </> : null}

              {tournament.fields.homeTown ? <Field label="Home town" id={`home-${index}`} value={player.homeTown} onChange={(value) => updatePlayer(index, { homeTown: value })} /> : null}
              {tournament.fields.age ? <label className="mute" htmlFor={`age-${index}`}>Age</label> : null}
              {tournament.fields.age ? <input id={`age-${index}`} type="number" min="5" max="99" value={player.age} onChange={(event) => updatePlayer(index, { age: event.target.value ? Number(event.target.value) : '' })} required /> : null}

              {tournament.fields.emergencyContact ? <>
                <Field label="Emergency contact name" id={`emergency-name-${index}`} value={player.emergencyName} onChange={(value) => updatePlayer(index, { emergencyName: value })} />
                <label className="mute" htmlFor={`emergency-phone-${index}`}>Emergency contact number</label>
                <input id={`emergency-phone-${index}`} type="tel" value={player.emergencyPhone} onChange={(event) => updatePlayer(index, { emergencyPhone: event.target.value })} required />
              </> : null}

              {tournament.fields.position ? <SelectField label="Playing position" id={`position-${index}`} value={player.position} options={['Point guard', 'Shooting guard', 'Small forward', 'Power forward', 'Centre', 'Any']} onChange={(value) => updatePlayer(index, { position: value })} /> : null}
              {tournament.fields.skillLevel ? <SelectField label="Skill level" id={`skill-${index}`} value={player.skillLevel} options={skillLevels} onChange={(value) => updatePlayer(index, { skillLevel: value })} /> : null}
              {tournament.fields.medical ? <Field label="Medical information" id={`medical-${index}`} value={player.medical} onChange={(value) => updatePlayer(index, { medical: value })} /> : null}
              {tournament.fields.allergies ? <Field label="Allergies" id={`allergies-${index}`} value={player.allergies} onChange={(value) => updatePlayer(index, { allergies: value })} /> : null}

              {tournament.fields.mediaConsent ? <SelectField label="Media consent" id={`media-${index}`} value={player.mediaConsent === null ? '' : player.mediaConsent ? 'yes' : 'no'} options={['yes', 'no']} optionLabels={['Yes, I consent', 'No, I do not consent']} onChange={(value) => updatePlayer(index, { mediaConsent: value === 'yes' })} /> : null}

              {isMinor ? <div className="guardian-fields">
                <h3>Parent or guardian details</h3>
                <Field label="Guardian full name" id={`guardian-name-${index}`} value={player.guardianName} onChange={(value) => updatePlayer(index, { guardianName: value })} />
                <label className="mute" htmlFor={`guardian-email-${index}`}>Guardian email</label>
                <input id={`guardian-email-${index}`} type="email" value={player.guardianEmail} onChange={(event) => updatePlayer(index, { guardianEmail: event.target.value })} required />
                <label className="mute" htmlFor={`guardian-phone-${index}`}>Guardian phone</label>
                <input id={`guardian-phone-${index}`} type="tel" value={player.guardianPhone} onChange={(event) => updatePlayer(index, { guardianPhone: event.target.value })} required />
                <label className="check-row"><input type="checkbox" checked={player.guardianConsent} onChange={(event) => updatePlayer(index, { guardianConsent: event.target.checked })} /><span>Guardian confirms consent for this player to enter.</span></label>
              </div> : null}

              <label className="check-row"><input type="checkbox" checked={player.dataProtectionAccepted} onChange={(event) => updatePlayer(index, { dataProtectionAccepted: event.target.checked })} /><span>I have read the data protection notice and agree to the use of this information to administer this tournament. Health details are restricted and removed after the event under the stated retention policy.</span></label>

              <h3 style={{ marginTop: 14 }}>Tournament agreements</h3>
              {agreements.map(({ key, text }) => <label className="check-row" key={key}>
                <input type="checkbox" checked={player.agreements[key]} onChange={(event) => updatePlayer(index, { agreements: { ...player.agreements, [key]: event.target.checked } })} />
                <span>{text}</span>
              </label>)}
            </section>
          );
        })}

        {error ? <p role="alert" style={{ color: 'var(--bad)' }}>{error}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}
        <div className="row">
          <span><b>{price}</b><span className="mute"> · charged through Stripe after secure setup</span></span>
          <button type="button" className="btn" onClick={submit} disabled={submitting}>{submitting ? 'Preparing checkout…' : 'Continue to secure payment'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, id, value, onChange }: { label: string; id: string; value: string; onChange: (value: string) => void }) {
  return <>
    <label className="mute" htmlFor={id}>{label}</label>
    <input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
  </>;
}

function SelectField({ label, id, value, options, optionLabels, onChange }: { label: string; id: string; value: string; options: string[]; optionLabels?: string[]; onChange: (value: string) => void }) {
  return <>
    <label className="mute" htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose</option>
      {options.map((option, index) => <option key={option} value={option}>{optionLabels?.[index] ?? option}</option>)}
    </select>
  </>;
}