import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    error: 'Secure tournament checkout is not configured. No player details were saved and no payment was taken. Connect Supabase Auth, the tournament database, Stripe Checkout and the payment webhook before accepting registrations.',
  }, { status: 503 });
}