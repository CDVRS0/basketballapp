'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function AdminResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRecovery = searchParams.get('mode') === 'update';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isRecovery) return;
    let active = true;
    void getSupabaseBrowserClient().auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setReady(Boolean(data.session) && !error);
      if (!data.session || error) setMessage('This recovery link is invalid or expired. Request a new one.');
    });
    return () => { active = false; };
  }, [isRecovery]);

  const requestReset = async () => {
    if (!email.trim()) {
      setMessage('Enter your admin email address.');
      return;
    }

    setLoading(true);
    setMessage('');
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/reset-password?mode=update`,
    });
    setMessage(error
      ? 'Unable to send the reset email. Check the Supabase Auth redirect URL configuration and try again.'
      : 'If this email belongs to an account, a password reset link has been sent.');
    setLoading(false);
  };

  const updatePassword = async () => {
    if (password.length < 8) {
      setMessage('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('The passwords do not match.');
      return;
    }

    setLoading(true);
    setMessage('');
    const client = getSupabaseBrowserClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    await client.auth.signOut();
    router.replace('/admin/login?password=updated');
    router.refresh();
  };

  return (
    <main className="container">
      <div className="hero">
        <div className="eyebrow">CDVRS SPORTS · ADMIN</div>
        <h1 className="h1">{isRecovery ? 'Choose a new password.' : 'Reset admin password.'}</h1>
        <p className="sub">Password recovery does not grant admin access. The account must still have an admin role.</p>

        {isRecovery ? (
          <div className="form section">
            {ready ? <>
              <input className="input" type="password" autoComplete="new-password" placeholder="New password · at least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} />
              <input className="input" type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              <button type="button" className="btn primary" onClick={() => void updatePassword()} disabled={loading}>{loading ? 'Updating…' : 'Update password'}</button>
            </> : null}
            {message ? <p role="status" className="sub">{message}</p> : null}
            <Link href="/admin/login">Back to admin sign in</Link>
          </div>
        ) : (
          <div className="form section">
            <input className="input" type="email" autoComplete="username" placeholder="Admin email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <button type="button" className="btn primary" onClick={() => void requestReset()} disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
            {message ? <p role="status" className="sub">{message}</p> : null}
            <Link href="/admin/login">Back to admin sign in</Link>
          </div>
        )}
      </div>
    </main>
  );
}