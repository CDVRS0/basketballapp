import type {RunAttendee, Session, Profile} from './types';

export const demoProfile: Profile = {
  firstName: 'Cam',
  lastName: 'Dankwa',
  avatarColor: '#dbeafe',
  level: 'Advanced',
  aim: 'Compete',
  favouriteTeam: 'Boston Celtics',
  favouritePlayer: 'LeBron James',
  age: 24,
  city: 'Milton Keynes',
  instagram: 'cdvrs',
  tiktok: 'cdvrs',
  profileVisible: true,
  emergencyName: 'Sam Player',
  emergencyPhone: '07700 900123',
  medical: 'No major issues',
  allergies: 'None',
  reConfirmAt: '2026-04-01T00:00:00.000Z',
};

const d = (days: number, h = 18) => {
  const x = new Date(Date.now() + days * 86400000);
  x.setHours(h, 0, 0, 0);
  return x.toISOString();
};

export const sessions: Session[] = [
  { id: 's1', title: 'CD4Q Sunday Run', startsAt: d(3), endsAt: d(3, 20), venue: 'Webber Independent School', address: 'Webber Independent School, Milton Keynes', capacity: 12, booked: 10, status: 'published', theme: 'default' },
  { id: 's2', title: 'CD4Q Sunday Run', startsAt: d(17), endsAt: d(17, 20), venue: 'Webber Independent School', address: 'Webber Independent School, Milton Keynes', capacity: 12, booked: 8, status: 'published', theme: 'default' },
  { id: 's3', title: 'CD4Q Sunday Run', startsAt: d(31), endsAt: d(31, 20), venue: 'Webber Independent School', address: 'Webber Independent School, Milton Keynes', capacity: 12, booked: 12, status: 'published', theme: 'default' },
  { id: 's4', title: 'CD4Q Sunday Run', startsAt: d(45), endsAt: d(45, 20), venue: 'Webber Independent School', address: 'Webber Independent School, Milton Keynes', capacity: 12, booked: 6, status: 'published', theme: 'default' },
  { id: 't1', title: 'Takeover 3x3 – Autumn Cup', startsAt: d(8), endsAt: d(8, 22), venue: 'City Sports Centre', address: 'City Sports Centre, London', capacity: 24, booked: 16, status: 'published', theme: 'takeover' },
];

export const attendees = ['Jordan M.', 'Reuel A.', 'Ayo P.', 'Marcus T.', 'Tyrese B.', 'Daniel K.', 'Player'];

const demoRunRoster: RunAttendee[] = [
  { name: 'Jordan M.', position: 'Point guard' },
  { name: 'Reuel A.', position: 'Shooting guard' },
  { name: 'Ayo P.', position: 'Small forward' },
  { name: 'Marcus T.', position: 'Power forward' },
  { name: 'Tyrese B.', position: 'Centre' },
  { name: 'Daniel K.', position: 'Point guard' },
  { name: 'Player', position: 'Any position' },
];

export const runAttendeesBySession: Record<string, RunAttendee[]> = Object.fromEntries(
  sessions.map((session) => [session.id, demoRunRoster.slice(0, session.booked)]),
);

export const notifications = [
  { id: 'n1', title: 'Booking confirmed', body: 'You are booked for the next CD4Q Sunday Run. A confirmation email has been queued.', time: 'Just now', type: 'booking' },
  { id: 'n2', title: '2 spaces left', body: 'The next run is nearly full. We have also sent a push-style reminder to your device.', time: '2h ago', type: 'availability' },
  { id: 'n3', title: 'Payment recovered', body: 'Your CD4Q 2 membership is active again and your replacement credit validity is still in place.', time: 'Yesterday', type: 'payment' },
];
