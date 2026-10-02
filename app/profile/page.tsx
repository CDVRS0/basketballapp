'use client';

import { useState } from 'react';
import { demoProfile } from '@/lib/demo-data';

const palette = ['#dbeafe', '#fcd34d', '#fca5a5', '#bfdbfe', '#c7d2fe', '#bbf7d0', '#fdba74', '#e9d5ff'];

export default function Profile() {
  const [profile, setProfile] = useState(demoProfile);

  return (
    <div className="wrap">
      <h2>My profile</h2>

      <div className="card">
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <div className="profile-badge large" style={{ background: profile.avatarColor }}>{profile.firstName[0]}{profile.lastName[0]}</div>
          <div style={{ marginLeft: 12 }}>
            <b>{profile.firstName} {profile.lastName}</b>
            <div className="mute">Pick an icon, or keep your initials</div>
          </div>
        </div>

        <label className="mute" htmlFor="firstName">First name</label>
        <input id="firstName" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />

        <label className="mute" htmlFor="lastName">Last name</label>
        <input id="lastName" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />

        <div style={{ margin: '10px 0', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {palette.map((color) => (
            <button
              key={color}
              type="button"
              className="btn ghost small"
              style={{ minWidth: 28, padding: '4px 8px', background: color, borderColor: profile.avatarColor === color ? 'var(--blue)' : 'var(--edge)' }}
              onClick={() => setProfile({ ...profile, avatarColor: color })}
              aria-label="Change avatar colour"
            >
              &nbsp;
            </button>
          ))}
        </div>

        <label className="mute" htmlFor="level">Level</label>
        <select id="level" value={profile.level} onChange={(e) => setProfile({ ...profile, level: e.target.value })}>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
          <option>Elite</option>
        </select>

        <label className="mute" htmlFor="aim">Aim</label>
        <select id="aim" value={profile.aim} onChange={(e) => setProfile({ ...profile, aim: e.target.value })}>
          <option>Get better</option>
          <option>Fitness</option>
          <option>Compete</option>
          <option>Meet people</option>
          <option>Have fun</option>
        </select>

        <label className="mute" htmlFor="team">Favourite basketball team</label>
        <input id="team" value={profile.favouriteTeam} onChange={(e) => setProfile({ ...profile, favouriteTeam: e.target.value })} />

        <label className="mute" htmlFor="player">Favourite player</label>
        <input id="player" value={profile.favouritePlayer} onChange={(e) => setProfile({ ...profile, favouritePlayer: e.target.value })} />

        <label className="mute" htmlFor="age">Age</label>
        <input id="age" type="number" value={profile.age} onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })} />

        <label className="mute" htmlFor="city">City you play in</label>
        <input id="city" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />

        <label className="mute" htmlFor="instagram">Instagram</label>
        <input id="instagram" value={profile.instagram ?? ''} onChange={(e) => setProfile({ ...profile, instagram: e.target.value })} />

        <label className="mute" htmlFor="tiktok">TikTok</label>
        <input id="tiktok" value={profile.tiktok ?? ''} onChange={(e) => setProfile({ ...profile, tiktok: e.target.value })} />

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={profile.profileVisible} onChange={(e) => setProfile({ ...profile, profileVisible: e.target.checked })} style={{ width: 'auto', margin: '4px 0 0' }} />
          <span className="mute">Let players on the same run see my profile</span>
        </label>
      </div>

      <h2>Safety details</h2>
      <div className="card">
        <p className="mute">Only organisers see these so they can look after you at runs.</p>
        <label className="mute" htmlFor="emergency">Emergency contact name</label>
        <input id="emergency" value={profile.emergencyName ?? ''} onChange={(e) => setProfile({ ...profile, emergencyName: e.target.value })} />

        <label className="mute" htmlFor="phone">Emergency contact number</label>
        <input id="phone" type="tel" value={profile.emergencyPhone ?? ''} onChange={(e) => setProfile({ ...profile, emergencyPhone: e.target.value })} />

        <label className="mute" htmlFor="medical">Medical information</label>
        <input id="medical" value={profile.medical ?? ''} onChange={(e) => setProfile({ ...profile, medical: e.target.value })} />

        <label className="mute" htmlFor="allergies">Allergies</label>
        <input id="allergies" value={profile.allergies ?? ''} onChange={(e) => setProfile({ ...profile, allergies: e.target.value })} />

        <p className="mute">Run medical and allergy details stay on your player profile until you remove them. We remind you to re-confirm them every 6 months. Organisers use these details for run safety only.</p>
      </div>
    </div>
  );
}
