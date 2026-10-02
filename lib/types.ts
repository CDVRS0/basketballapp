export type MembershipStatus='active'|'past_due'|'unpaid'|'ending'|'cancelled'|'none';
export type BookingStatus='pending_payment'|'booked'|'waitlist'|'cancelled'|'attended';
export type CreditState='available'|'held'|'used';
export type SessionStatus='draft'|'published'|'cancelled';
export type EventTheme='default'|'blue'|'takeover'|'black-orange-white';

export interface Session {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string;
  capacity: number;
  booked: number;
  cancelCutoffHours?: number;
  status: SessionStatus;
  theme?: EventTheme;
}

export interface RunAttendee {
  name: string;
  position: string;
}

export interface TournamentFieldConfig {
  homeTown: boolean;
  email: boolean;
  emergencyContact: boolean;
  age: boolean;
  medical: boolean;
  allergies: boolean;
  mediaConsent: boolean | null;
  position: boolean;
  skillLevel: boolean;
}

export interface TournamentConfig {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string;
  venue: string;
  address: string;
  categories: string[];
  prices: Record<3 | 4 | 5, number>;
  pricingStatus: 'illustrative' | 'confirmed';
  memberDiscountScope: 'tbc' | 'player-share' | 'whole-team';
  memberDiscountPercent: number;
  maxTeams: number;
  fields: TournamentFieldConfig;
}

export type TournamentAgreement =
  | 'informationAccuracy'
  | 'physicalRisk'
  | 'rulesAndRespect'
  | 'conductRemoval'
  | 'personalBelongings'
  | 'emergencyTreatment';

export interface TournamentPlayerDetails {
  fullName: string;
  homeTown: string;
  email: string;
  emergencyName: string;
  emergencyPhone: string;
  age: number | '';
  medical: string;
  allergies: string;
  mediaConsent: boolean | null;
  position: string;
  skillLevel: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianConsent: boolean;
  dataProtectionAccepted: boolean;
  agreements: Record<TournamentAgreement, boolean>;
}

export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  teamName: string;
  teamSize: 3 | 4 | 5;
  category: string;
  captainIndex: number;
  players: TournamentPlayerDetails[];
  status: 'pending' | 'confirmed';
  createdAt: string;
}

export interface Profile {
  firstName: string;
  lastName: string;
  avatarColor: string;
  level: string;
  aim: string;
  favouriteTeam: string;
  favouritePlayer: string;
  age: number;
  city: string;
  instagram?: string;
  tiktok?: string;
  profileVisible: boolean;
  emergencyName?: string;
  emergencyPhone?: string;
  medical?: string;
  allergies?: string;
  reConfirmAt?: string;
}
