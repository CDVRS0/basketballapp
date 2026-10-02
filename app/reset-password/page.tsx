'use client';

import { useState } from 'react';

export default function Reset() {
	const [email, setEmail] = useState('');
	const [message, setMessage] = useState('');

	const submit = () => {
		setMessage(email.trim() ? 'Password reset email is not connected in this demo.' : 'Enter your email address.');
	};

	return <main className="container"><div className="hero"><div className="eyebrow">ACCOUNT</div><h1 className="h1">Reset password.</h1><p className="sub">Request a password reset link.</p><div className="form section"><input className="input" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} /><button type="button" className="btn primary" onClick={submit}>Send reset link</button>{message ? <p className="sub" role="status">{message}</p> : null}</div></div></main>;
}