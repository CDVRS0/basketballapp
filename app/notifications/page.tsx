'use client';

import { useEffect, useState } from 'react';
import { demoNotificationsUpdatedEvent, readDemoNotifications, type DemoNotification } from '@/lib/notifications';

const notes = [
  'Only 2 spaces left for this weekend\'s CD4Q.',
  'Membership credit cancellation rules apply up to 12 hours before a run.',
  'A waitlist place becomes available when a booked player cancels.',
];

export default function Notifications() {
  const [push, setPush] = useState(true);
  const [activity, setActivity] = useState<DemoNotification[]>([]);

  useEffect(() => {
    const refreshActivity = () => setActivity(readDemoNotifications());
    refreshActivity();
    window.addEventListener(demoNotificationsUpdatedEvent, refreshActivity);
    return () => window.removeEventListener(demoNotificationsUpdatedEvent, refreshActivity);
  }, []);

  return (
    <div className="wrap">
      <h2>Notifications</h2>

      <div className="card">
        <div className="row">
          <div>
            <b>Phone push notifications</b>
            <p className="mute">Preference preview only. Device push and email delivery are not connected.</p>
          </div>
          <button type="button" className={push ? 'pill ok' : 'pill bad'} onClick={() => setPush(!push)}>
            {push ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <h2>Recent activity</h2>
      {activity.length ? activity.map((item) => (
        <div key={item.id} className="card">
          <div>{item.message}</div>
          <div className="mute">{new Date(item.createdAt).toLocaleString('en-GB')}</div>
        </div>
      )) : <div className="card mute">No recent booking activity.</div>}

      <h2>Updates</h2>
      {notes.map((note, index) => (
        <div key={index} className="card">
          {note}
        </div>
      ))}
    </div>
  );
}
