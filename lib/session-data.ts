import { sessions as demoSessions } from './demo-data';
import type { Session } from './types';

const sessionsKey = 'cd4q-session-data';
export const sessionsUpdatedEvent = 'cd4q-session-data-updated';

export function readSessions(): Session[] {
  if (typeof window === 'undefined') return demoSessions;
  try {
    const raw = window.localStorage.getItem(sessionsKey);
    return raw ? JSON.parse(raw) as Session[] : demoSessions;
  } catch {
    return demoSessions;
  }
}

export function saveSessions(sessions: Session[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(sessionsKey, JSON.stringify(sessions));
  window.dispatchEvent(new Event(sessionsUpdatedEvent));
}