'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function Signup() {
	const router = useRouter();
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [message, setMessage] = useState('');
	const [loading, setLoading] = useState(false);

	const submit = async () => {
		if (!name.trim() || !email.trim() || password.length < 8) {
			setMessage('Enter your name and email, and use a password of at least 8 characters.');
			return;
		}
		setLoading(true);
		const { data, error } = await getSupabaseBrowserClient().auth.signUp({
			email,
			password,
			options: { data: { full_name: name.trim() } },
		});
		if (error) {
			setMessage(error.message);
			setLoading(false);
			return;
		}
		if (data.session) {
			router.push('/dashboard');
			router.refresh();
			return;
		}
		setMessage('Check your email to confirm your account, then log in.');
		setLoading(false);
	};

	return <main className="container"><div className="hero"><div className="eyebrow">CREATE ACCOUNT</div><h1 className="h1">Join CD4Q.</h1><div className="form section"><input className="input" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} /><input className="input" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} /><input className="input" type="password" placeholder="Password · minimum 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="btn primary" onClick={submit} disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>{message ? <p className="muted" role="status">{message}</p> : null}</div><p className="muted">Email verification is required before booking or paying.</p></div></main>;
}