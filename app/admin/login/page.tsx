'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setMessage('Enter your admin email and password.');
      return;
    }

    setLoading(true);
    setMessage('');
    const client = getSupabaseBrowserClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setMessage(error?.message ?? 'Unable to sign in.');
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile || !['admin', 'super_admin'].includes(profile.role)) {
      await client.auth.signOut();
      setMessage('This account does not have admin access.');
      setLoading(false);
      return;
    }

    router.replace('/admin');
    router.refresh();
  };

  return (
    <main className="container">
      <div className="hero">
        <div className="eyebrow">CDVRS SPORTS · ADMIN</div>
        <h1 className="h1">Admin sign in.</h1>
        <div className="form section">
          <input className="input" type="email" autoComplete="username" placeholder="Admin email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="input" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button type="button" className="btn primary" onClick={() => void submit()} disabled={loading}>{loading ? 'Signing in…' : 'Admin sign in'}</button>
          <Link href="/admin/reset-password">Forgot password?</Link>
          {message ? <p role="alert" className="sub">{message}</p> : null}
        </div>
      </div>
    </main>
  );
}