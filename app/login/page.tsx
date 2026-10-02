'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function Login() {
	const router = useRouter();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [message, setMessage] = useState('');
	const [loading, setLoading] = useState(false);

	const submit = async () => {
		if (!email.trim() || !password) {
			setMessage('Enter your email and password.');
			return;
		}
		setLoading(true);
		const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
		if (error) {
			setMessage(error.message);
			setLoading(false);
			return;
		}
		router.push('/dashboard');
		router.refresh();
	};

	return <main className="container"><div className="hero"><div className="eyebrow">CDVRS SPORTS</div><h1 className="h1">Log in.</h1><p className="sub">Sign in to manage bookings and memberships.</p><div className="form section"><input className="input" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} /><input className="input" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="btn primary" onClick={submit} disabled={loading}>{loading ? 'Signing in...' : 'Log in'}</button><a href="/signup">Create account</a><a href="/reset-password">Forgot password?</a>{message ? <p className="sub" role="alert">{message}</p> : null}</div></div></main>;
}