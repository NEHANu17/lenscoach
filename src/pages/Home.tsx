import { useState, useCallback, useEffect } from 'react';
import {
  getSession,
  clearSession,
  signOutUser,
  KICKOUT_EVENT,
  clearLogoutFlag,
  hasLogoutFlag,
  clearAdminPin,
} from '@/lib/auth';
import { trpc } from '@/providers/trpc';
import GateOverlay from '@/components/GateOverlay';
import Navigation from '@/components/Navigation';
import AdminPanel from '@/components/AdminPanel';
import Hero from '@/sections/Hero';
import HowItWorks from '@/sections/HowItWorks';
import LutLibrary from '@/sections/LutLibrary';
import Waitlist from '@/sections/Waitlist';
import Footer from '@/sections/Footer';

export default function Home() {
  const [gateDismissed, setGateDismissed] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [authKey, setAuthKey] = useState(0);
  const [kickedOut, setKickedOut] = useState(false);

  const justLoggedOut = hasLogoutFlag();

  const session = getSession();
  const isAuthenticated = !!session?.email;
  const isAdmin = session?.email === 'nehan.apex@gmail.com';

  // Validate session against database
  const { data: dbUser } = trpc.user.findByEmail.useQuery(
    { email: session?.email ?? '' },
    { enabled: !!session?.email }
  );
  const removeUser = trpc.user.remove.useMutation();

  // Kick out if user was removed from DB
  useEffect(() => {
    if (session?.email && dbUser === null) {
      clearSession();
      clearLogoutFlag();
      setKickedOut(true);
      setGateDismissed(false);
      setAuthKey((k) => k + 1);
    }
  }, [dbUser, session?.email]);

  const handleAuthenticated = useCallback(() => {
    clearLogoutFlag();
    setKickedOut(false);
    setGateDismissed(true);
    setAuthKey((k) => k + 1);
  }, []);

  // Log Out: clear session, set flag to show login form on return
  const handleLogOut = useCallback(() => {
    clearSession();
    clearAdminPin();
    localStorage.setItem('lc_logout', '1');
    window.location.reload();
  }, []);

  // Sign Out: remove user from DB entirely
  const handleSignOut = useCallback(async () => {
    const currentSession = getSession();
    if (currentSession?.email) {
      // Remove from Supabase DB
      try { await removeUser.mutateAsync({ email: currentSession.email }); } catch { /* ignore */ }
      signOutUser(currentSession.email);
    } else {
      clearSession();
    }
    clearAdminPin();
    localStorage.removeItem('lc_logout');
    window.location.reload();
  }, [removeUser]);

  // ── Real-time kick-out: listen for admin removal across tabs ──
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === KICKOUT_EVENT && e.newValue) {
        const removedEmail = e.newValue;
        const currentSession = getSession();
        if (
          currentSession &&
          currentSession.email.toLowerCase() === removedEmail.toLowerCase()
        ) {
          clearSession();
          clearAdminPin();
          localStorage.removeItem('lc_logout');
          setKickedOut(true);
          setGateDismissed(false);
          setAuthKey((k) => k + 1);
        }
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Auto-dismiss gate if session exists and user is in DB
  useEffect(() => {
    if (session?.email && dbUser && !gateDismissed && !kickedOut) {
      setGateDismissed(true);
    }
  }, [session?.email, dbUser, gateDismissed, kickedOut]);

  return (
    <>
      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 9999,
          opacity: 'var(--grain-op)',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '180px',
        }}
      />

      {/* Vignette */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 9998,
          background:
            'radial-gradient(ellipse at center, transparent 55%, var(--vignette) 100%)',
        }}
      />

      {/* Gate Overlay */}
      {(!gateDismissed || kickedOut) && (
        <GateOverlay
          onAuthenticated={handleAuthenticated}
          forceLogin={justLoggedOut}
          kickedOut={kickedOut}
        />
      )}

      {/* Admin Panel */}
      <AdminPanel isOpen={adminOpen} onClose={() => setAdminOpen(false)} />

      {/* Main Content */}
      <div
        style={{
          opacity: gateDismissed && !kickedOut ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      >
        <Navigation
          key={authKey}
          onOpenAdmin={() => setAdminOpen(true)}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          onLogOut={handleLogOut}
          onSignOut={handleSignOut}
        />
        <Hero />
        <HowItWorks />
        <LutLibrary />
        <Waitlist />
        <Footer />
      </div>
    </>
  );
}
