import type { Session } from './types';

export type DemoBooking = {
  id: string;
  sessionId: string;
  status: 'booked' | 'waitlisted' | 'cancelled';
  paymentType: 'member' | 'payg';
  cancelCutoffAt: string;
  createdAt: string;
};

export type CreditSummary = { available: number; held: number; used: number; total: number };

const bookingsKey = 'cd4q-demo-bookings';
export const demoBookingsEvent = 'cd4q-demo-bookings-updated';
export const demoCreditAllowance = 2;

export function readDemoBookings(): DemoBooking[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(bookingsKey);
    return raw ? JSON.parse(raw) as DemoBooking[] : [];
  } catch {
    return [];
  }
}

export function saveDemoBookings(bookings: DemoBooking[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(bookingsKey, JSON.stringify(bookings));
  window.dispatchEvent(new Event(demoBookingsEvent));
}

export function getCreditSummary(bookings: DemoBooking[], now = Date.now()): CreditSummary {
  const memberBookings = bookings.filter((booking) => booking.status === 'booked' && booking.paymentType === 'member');
  const held = memberBookings.filter((booking) => now < new Date(booking.cancelCutoffAt).getTime()).length;
  const used = memberBookings.length - held;
  return {
    available: Math.max(0, demoCreditAllowance - memberBookings.length),
    held,
    used,
    total: demoCreditAllowance,
  };
}

export function sessionCancelCutoff(session: Session): number {
  return new Date(session.startsAt).getTime() - (session.cancelCutoffHours ?? 12) * 60 * 60 * 1000;
}