export type NotificationChannel = "in_app" | "email" | "push";

export interface DemoNotification {
  id: string;
  message: string;
  createdAt: string;
}

const demoNotificationsKey = 'cd4q-demo-notifications';
const demoNotificationsEvent = 'cd4q-demo-notifications-updated';

export function readDemoNotifications(): DemoNotification[] {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(demoNotificationsKey);
    return saved ? JSON.parse(saved) as DemoNotification[] : [];
  } catch {
    return [];
  }
}

export function addDemoNotification(message: string): void {
  if (typeof window === 'undefined') return;

  const notification: DemoNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    message,
    createdAt: new Date().toISOString(),
  };
  const notifications = [notification, ...readDemoNotifications()].slice(0, 30);

  window.localStorage.setItem(demoNotificationsKey, JSON.stringify(notifications));
  window.dispatchEvent(new Event(demoNotificationsEvent));
}

export const demoNotificationsUpdatedEvent = demoNotificationsEvent;

export type NotificationEvent =
  | "booking_confirmed"
  | "payment_confirmed"
  | "waitlist_offer"
  | "space_opened"
  | "run_cancelled"
  | "payment_failed"
  | "payment_recovered"
  | "takeover_confirmed";

export function notificationChannels(event: NotificationEvent): NotificationChannel[] {
  // Production rule: all booking/payment confirmations create in-app + email.
  // Push is added when the player has granted browser/native notification permission.
  const always: NotificationChannel[] = ["in_app", "email"];
  return always;
}
