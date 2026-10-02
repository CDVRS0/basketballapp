import type { TournamentConfig, TournamentPlayerDetails, TournamentRegistration } from './types';

const configKey = 'cd4q-tournament-config';
export const tournamentConfigEvent = 'cd4q-tournament-config-updated';

const eventDate = (daysAhead: number, hour: number) => {
  const date = new Date(Date.now() + daysAhead * 86400000);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const defaultTournament: TournamentConfig = {
  id: 'takeover-autumn-cup',
  title: 'TAKEOVER 3x3 Autumn Cup',
  startsAt: eventDate(8, 16),
  endsAt: eventDate(8, 22),
  registrationDeadline: eventDate(7, 23),
  venue: 'City Sports Centre',
  address: 'City Sports Centre, London',
  categories: ['Open', 'Under 16', 'Under 18'],
  prices: { 3: 60, 4: 75, 5: 90 },
  pricingStatus: 'illustrative',
  memberDiscountScope: 'tbc',
  memberDiscountPercent: 15,
  maxTeams: 24,
  fields: {
    homeTown: true,
    email: true,
    emergencyContact: true,
    age: true,
    medical: true,
    allergies: true,
    mediaConsent: true,
    position: true,
    skillLevel: true,
  },
};

export const emptyTournamentPlayer = (): TournamentPlayerDetails => ({
  fullName: '',
  homeTown: '',
  email: '',
  emergencyName: '',
  emergencyPhone: '',
  age: '',
  medical: '',
  allergies: '',
  mediaConsent: null,
  position: '',
  skillLevel: '',
  guardianName: '',
  guardianEmail: '',
  guardianPhone: '',
  guardianConsent: false,
  dataProtectionAccepted: false,
  agreements: {
    informationAccuracy: false,
    physicalRisk: false,
    rulesAndRespect: false,
    conductRemoval: false,
    personalBelongings: false,
    emergencyTreatment: false,
  },
});

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function getTournamentConfig(): TournamentConfig {
  const saved = readStored<Partial<TournamentConfig>>(configKey, {});
  return {
    ...defaultTournament,
    ...saved,
    prices: { ...defaultTournament.prices, ...saved.prices },
    fields: { ...defaultTournament.fields, ...saved.fields },
    categories: saved.categories?.length ? saved.categories : defaultTournament.categories,
  };
}

export function saveTournamentConfig(config: TournamentConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(configKey, JSON.stringify(config));
  window.dispatchEvent(new Event(tournamentConfigEvent));
}
