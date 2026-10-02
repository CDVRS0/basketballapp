'use client';

import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {Bell, CalendarDays, Home, LogOut, UserRound, Trophy, WalletCards} from 'lucide-react';
import {getSupabaseBrowserClient} from '@/lib/supabase-browser';

const nav = [
  ['/dashboard', 'Home', Home],
  ['/sessions', 'Sessions', CalendarDays],
  ['/events', 'Events', Trophy],
  ['/plan', 'Plan', WalletCards],
  ['/notifications', 'Alerts', Bell],
  ['/profile', 'Profile', UserRound],
] as const;

export default function AppShell({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdminLogin = pathname === '/admin/login';
  const isAdminRecovery = pathname === '/admin/reset-password';
  const isAdminPublicAuth = isAdminLogin || isAdminRecovery;
  const isAdminRoute = pathname.startsWith('/admin/') || pathname === '/admin';
  const [adminAccess, setAdminAccess] = useState<'checking' | 'allowed' | 'denied'>(isAdminRoute && !isAdminPublicAuth ? 'checking' : 'denied');
  const activeNav = isAdminRoute && !isAdminLogin
    ? [
        ['/admin', 'Overview', Home],
        ['/admin#sessions', 'Run manager', CalendarDays],
        ['/admin#events', 'Events', Trophy],
      ] as const
    : nav;

  useEffect(() => {
    if (!isAdminRoute || isAdminPublicAuth) {
      setAdminAccess('denied');
      return;
    }

    let active = true;
    setAdminAccess('checking');
    const verifyAdmin = async () => {
      try {
        const client = getSupabaseBrowserClient();
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
          if (active) router.replace('/admin/login');
          return;
        }
        const { data: profile, error } = await client
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!active) return;
        if (error || !profile || !['admin', 'super_admin'].includes(profile.role)) {
          setAdminAccess('denied');
          await client.auth.signOut();
          router.replace('/admin/login');
          return;
        }
        setAdminAccess('allowed');
      } catch {
        if (active) {
          setAdminAccess('denied');
          router.replace('/admin/login');
        }
      }
    };
    void verifyAdmin();
    return () => { active = false; };
  }, [isAdminPublicAuth, isAdminRoute, router]);

  const logout = async () => {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace(isAdminRoute ? '/admin/login' : '/login');
  };

  const canShowAdmin = !isAdminRoute || isAdminLogin || adminAccess === 'allowed';

  return (
    <div className="shell">
      <header className="topbar">
        <div className="logo">CD4Q<span>.</span>Runs</div>

        {isAdminRoute && !isAdminLogin ? <span className="mute">Admin dashboard</span> : null}
        {isAdminLogin ? <span className="mute">Admin sign in</span> : null}
        {isAdminRecovery ? <span className="mute">Admin password recovery</span> : null}
        {!isAdminPublicAuth ? <button type="button" className="btn ghost small" onClick={() => void logout()} title="Log out" aria-label="Log out"><LogOut size={16} /></button> : null}
      </header>

      <main className="page-shell">
        {!canShowAdmin ? <div className="wrap"><div className="card mute">{adminAccess === 'checking' ? 'Verifying admin access…' : 'Admin access required.'}</div></div> : children}
      </main>

      {!isAdminPublicAuth ? <nav className="mobileNav" aria-label="Main navigation">
        {activeNav.map(([href, label, Icon]) => (
          <Link key={href} href={href} className={pathname === href.split('#')[0] ? 'active' : ''}>
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </nav> : null}
    </div>
  );
}
