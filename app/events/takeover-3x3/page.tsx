import { redirect } from 'next/navigation';

export default function TakeoverRegistrationRedirect() {
  redirect('/events');
}