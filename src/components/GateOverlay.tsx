import { useState, useEffect, useCallback } from 'react';
import {
  sha256,
  saveUser,
  findUser,
  updateUser,
  setSession,
  getSession,
  getUsers,
  getPendingUser,
  setPendingUser,
  clearPendingUser,
  generateVerificationCode,
  sendVerificationEmail,
} from '@/lib/auth';
import type { User } from '@/lib/auth';
import { GOOGLE_CLIENT_ID } from '@/lib/config';
import { validateEmail } from '@/lib/emailValidate';
import GoogleSignInButton from './GoogleSignInButton';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: Record<string, unknown>) => void;
            error_callback?: (error: unknown) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

interface GateOverlayProps {
  onAuthenticated: () => void;
  forceLogin?: boolean;
  kickedOut?: boolean;
}

type GateView = 'signup' | 'login' | 'verify' | 'success';

export default function GateOverlay({ onAuthenticated, forceLogin = false, kickedOut = false }: GateOverlayProps) {
  const [view, setView] = useState<GateView>(forceLogin ? 'login' : 'signup');
  const [isVisible, setIsVisible] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  // Loading states
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Errors
  const [signupError, setSignupError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [googleError, setGoogleError] = useState('');

  // Verification
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    // Kicked out by admin
    if (kickedOut) {
      clearPendingUser();
      setView('signup');
      setIsVisible(true);
      setTimeout(() => document.getElementById('gateFirstName')?.focus(), 600);
      return;
    }

    // Just logged out — show login form so they can log back in
    if (forceLogin) {
      clearPendingUser();
      setView('login');
      setIsVisible(true);
      setTimeout(() => document.getElementById('loginEmail')?.focus(), 600);
      return;
    }

    // Already logged in (session in localStorage) — auto-enter
    const session = getSession();
    if (session && session.email) {
      setWelcomeName(session.firstName);
      setView('success');
      setIsVisible(true);
      setTimeout(() => onAuthenticated(), 1500);
      return;
    }

    // New visitor — show signup
    setIsVisible(true);
    setTimeout(() => document.getElementById('gateFirstName')?.focus(), 600);
  }, [onAuthenticated, forceLogin, kickedOut]);

  const clearErrors = useCallback(() => {
    setSignupError('');
    setLoginError('');
    setVerifyError('');
    setGoogleError('');
    setEmailError('');
  }, []);

  const showSignup = useCallback(() => {
    clearErrors();
    setView('signup');
    clearPendingUser();
    setVerifyCode('');
    setEmailSent(false);
    setEmailError('');
    setTimeout(() => document.getElementById('gateFirstName')?.focus(), 100);
  }, [clearErrors]);

  const showLogin = useCallback(() => {
    clearErrors();
    setView('login');
    clearPendingUser();
    setVerifyCode('');
    setEmailSent(false);
    setEmailError('');
    setTimeout(() => document.getElementById('loginEmail')?.focus(), 100);
  }, [clearErrors]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    document.body.classList.remove('locked');
    onAuthenticated();
  }, [onAuthenticated]);

  // ─── GOOGLE OAUTH ───
  const handleGoogleSignIn = useCallback(() => {
    clearErrors();
    setGoogleLoading(true);

    if (!window.google?.accounts?.oauth2) {
      setGoogleError('Google Sign-In library is loading. Please refresh and try again.');
      setGoogleLoading(false);
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: async (response) => {
          if (response.error || !response.access_token) {
            setGoogleError('Google sign-in was cancelled or failed.');
            setGoogleLoading(false);
            return;
          }
          try {
            const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token as string}` },
            });
            if (!res.ok) { setGoogleError('Failed to retrieve account info from Google.'); setGoogleLoading(false); return; }
            const userInfo = await res.json();
            if (!userInfo.email) { setGoogleError('Could not retrieve email from Google account.'); setGoogleLoading(false); return; }

            const googleEmail = userInfo.email as string;
            const googleFirstName = (userInfo.given_name as string) || (userInfo.name as string)?.split(' ')[0] || 'User';
            const googleLastName = (userInfo.family_name as string) || '';
            const googleId = (userInfo.sub as string) || (userInfo.id as string);
            const googleAvatar = userInfo.picture as string | undefined;

            let user = findUser(googleEmail);
            if (!user) {
              const newUser: User = {
                firstName: googleFirstName, lastName: googleLastName, email: googleEmail,
                googleId, googleAvatar, joinedAt: new Date().toISOString(),
                memberNumber: getUsers().length + 1, verified: true,
              };
              saveUser(newUser);
              user = newUser;
            } else if (!user.googleId) {
              updateUser(googleEmail, { googleId, googleAvatar, verified: true });
              user = findUser(googleEmail)!;
            }
            setSession(user);
            setWelcomeName(user.firstName);
            setView('success');
          } catch { setGoogleError('Failed to complete Google sign-in.'); }
          setGoogleLoading(false);
        },
        error_callback: () => { setGoogleError('Google Sign-In failed. Please try again.'); setGoogleLoading(false); },
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch { setGoogleError('Google Sign-In initialization failed.'); setGoogleLoading(false); }
  }, [clearErrors]);

  // ─── SIGNUP WITH EMAIL VALIDATION ───
  const handleSignup = useCallback(async () => {
    clearErrors();
    if (!firstName.trim()) { setSignupError('Please enter your first name.'); return; }
    if (!email.trim() || !email.includes('@')) { setSignupError('Please enter a valid email address.'); return; }
    if (password.length < 8) { setSignupError('Password must be at least 8 characters.'); return; }

    const existing = findUser(email);
    if (existing) { setSignupError('An account with this email already exists. Sign in instead.'); return; }

    setSignupLoading(true);

    const validation = await validateEmail(email.trim());
    if (!validation.valid) { setSignupError(validation.reason || 'Please enter a real, deliverable email address.'); setSignupLoading(false); return; }

    const pwHash = await sha256(password + email.toLowerCase());
    const code = generateVerificationCode();

    const pending = { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), pwHash, code, createdAt: Date.now() };
    setPendingUser(pending);

    const result = await sendVerificationEmail(pending.email, pending.firstName, code);
    setEmailSent(result.success);
    if (!result.success && result.error) setEmailError(result.error);

    setSignupLoading(false);
    setView('verify');
    setTimeout(() => document.getElementById('verifyCode')?.focus(), 100);
  }, [clearErrors, firstName, lastName, email, password]);

  // ─── VERIFY CODE ───
  const handleVerify = useCallback(() => {
    clearErrors();
    if (!verifyCode || verifyCode.length !== 6) { setVerifyError('Please enter the 6-digit verification code.'); return; }
    if (!/^\d{6}$/.test(verifyCode)) { setVerifyError('Code must be exactly 6 digits.'); return; }

    setVerifyLoading(true);
    const pending = getPendingUser();
    if (!pending) { setVerifyError('Verification session expired. Please start over.'); setVerifyLoading(false); return; }
    if (Date.now() - pending.createdAt > 10 * 60 * 1000) { setVerifyError('Code expired. Please request a new one.'); clearPendingUser(); setVerifyLoading(false); return; }
    if (verifyCode !== pending.code) { setVerifyError('Incorrect code. Please check and try again.'); setVerifyLoading(false); return; }

    const newUser: User = { firstName: pending.firstName, lastName: pending.lastName, email: pending.email, pwHash: pending.pwHash, joinedAt: new Date().toISOString(), memberNumber: getUsers().length + 1, verified: true };
    saveUser(newUser);
    setSession(newUser);
    clearPendingUser();
    setWelcomeName(newUser.firstName);
    setView('success');
    setVerifyLoading(false);
  }, [clearErrors, verifyCode]);

  const handleResendCode = useCallback(async () => {
    const pending = getPendingUser();
    if (!pending) { setVerifyError('Session expired. Please start over.'); return; }
    const newCode = generateVerificationCode();
    const updated = { ...pending, code: newCode, createdAt: Date.now() };
    setPendingUser(updated);

    const result = await sendVerificationEmail(updated.email, updated.firstName, newCode);
    setEmailSent(result.success);
    if (!result.success && result.error) setEmailError(result.error);

    setVerifyCode('');
    setVerifyError('');
    setTimeout(() => document.getElementById('verifyCode')?.focus(), 100);
  }, []);

  // ─── LOGIN ───
  const handleLogin = useCallback(async () => {
    clearErrors();
    if (!loginEmail.trim() || !loginEmail.includes('@')) { setLoginError('Please enter your email.'); return; }
    if (!loginPassword) { setLoginError('Please enter your password.'); return; }

    setLoginLoading(true);
    const user = findUser(loginEmail);
    if (!user) { setLoginLoading(false); setLoginError('No account found with that email. Create one instead.'); return; }
    if (user.googleId && !user.pwHash) { setLoginLoading(false); setLoginError('This account uses Google Sign-In. Use the Google button below.'); return; }

    const pwHash = await sha256(loginPassword + loginEmail.toLowerCase());
    if (pwHash !== user.pwHash) { setLoginLoading(false); setLoginError('Incorrect password. Please try again.'); return; }

    setSession(user);
    setWelcomeName(user.firstName);
    setView('success');
    setLoginLoading(false);
  }, [clearErrors, loginEmail, loginPassword]);

  // Prevent escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (isVisible && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
    }
    if (isVisible) { document.addEventListener('keydown', handleKey); document.body.classList.add('locked'); }
    return () => { document.removeEventListener('keydown', handleKey); if (!isVisible) document.body.classList.remove('locked'); };
  }, [isVisible]);

  useEffect(() => { if (googleError) { const t = setTimeout(() => setGoogleError(''), 6000); return () => clearTimeout(t); } }, [googleError]);

  const iStyle = (hasErr: boolean) => ({
    background: 'var(--input-bg)' as string,
    border: hasErr ? '1px solid var(--error)' : '1px solid var(--border)',
    color: 'var(--text)' as string,
    fontFamily: "'DM Sans', sans-serif",
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4 transition-all duration-500" style={{ background: 'rgba(4,3,2,0.97)', backdropFilter: 'blur(12px)', zIndex: 800, opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? 'all' : 'none' }}>
      <div className="w-full max-w-[460px] text-center relative transition-transform duration-500" style={{ background: 'var(--popup-bg)', border: '1px solid var(--popup-border)', borderRadius: '10px', padding: 'clamp(32px, 6vw, 52px) clamp(28px, 5vw, 48px)', boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,146,74,0.08)', transform: isVisible ? 'translateY(0)' : 'translateY(24px)' }}>
        <span className="font-display text-[20px] font-semibold tracking-[3px] uppercase block mb-7" style={{ color: 'var(--text)' }}>Lens<span style={{ color: 'var(--amber)' }}>Coach</span></span>

        {kickedOut && (
          <div className="mb-4 p-3 rounded-[4px] text-center text-[12px]" style={{ background: 'rgba(224,85,85,0.15)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}>
            <p className="font-medium">Your account has been removed by the admin.</p>
            <p>Please register again to continue.</p>
          </div>
        )}

        {googleError && (
          <div className="mb-4 p-3 rounded-[4px] text-[12px] text-left" style={{ background: 'rgba(224,85,85,0.15)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}>{googleError}</div>
        )}

        {/* ─── SIGN UP ─── */}
        {view === 'signup' && (
          <div>
            <p className="text-[10px] tracking-[3px] uppercase font-medium mb-3" style={{ color: 'var(--amber)' }}>Free Access · Founding Member</p>
            <h2 className="font-display text-[clamp(24px,5vw,32px)] font-light mb-2" style={{ color: 'var(--text)' }}>Create your account</h2>
            <p className="text-[clamp(12px,3vw,14px)] font-light mb-5" style={{ color: 'var(--subtext)', lineHeight: 1.65 }}>Join founding creators. Get free premium LUTs and early access.</p>

            <GoogleSignInButton onClick={handleGoogleSignIn} label="Continue with Google" disabled={googleLoading} />

            <div className="flex items-center gap-3 my-4" style={{ color: 'var(--muted)' }}>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} /><span className="text-[10px] tracking-[1px] uppercase">or</span><div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <input id="gateFirstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSignup()} placeholder="First name *" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 placeholder:opacity-60" style={iStyle(!!signupError)} onFocus={(e) => { if (!signupError) e.currentTarget.style.borderColor = 'var(--amber)'; }} onBlur={(e) => { if (!signupError) e.currentTarget.style.borderColor = 'var(--border)'; }} />
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSignup()} placeholder="Last name" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 placeholder:opacity-60" style={iStyle(false)} onFocus={(e) => e.currentTarget.style.borderColor = 'var(--amber)'} onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'} />
            </div>

            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSignup()} placeholder="Email address *" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 mb-2.5 placeholder:opacity-60" style={iStyle(!!signupError)} onFocus={(e) => { if (!signupError) e.currentTarget.style.borderColor = 'var(--amber)'; }} onBlur={(e) => { if (!signupError) e.currentTarget.style.borderColor = 'var(--border)'; }} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSignup()} placeholder="Password (min 8 chars) *" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 mb-1 placeholder:opacity-60" style={iStyle(!!signupError)} onFocus={(e) => { if (!signupError) e.currentTarget.style.borderColor = 'var(--amber)'; }} onBlur={(e) => { if (!signupError) e.currentTarget.style.borderColor = 'var(--border)'; }} />

            {signupError && <p className="text-[12px] mt-2" style={{ color: 'var(--error)' }}>{signupError}</p>}

            <button onClick={handleSignup} disabled={signupLoading} className="w-full rounded-[4px] mt-3 py-3.5 text-[12px] font-medium tracking-[2px] uppercase cursor-pointer transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed" style={{ background: 'var(--amber)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => { if (!signupLoading) e.currentTarget.style.background = '#daa85a'; }} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)' }>
              {signupLoading ? <><span className="gate-spinner" />Validating email…</> : 'Continue'}
            </button>

            <p className="text-[11px] mt-3.5" style={{ color: 'var(--muted)', letterSpacing: '0.3px', lineHeight: 1.5 }}>
              By signing up you agree to our terms. No spam, no noise.<br />Already have an account?{' '}
              <button onClick={showLogin} className="bg-transparent border-none cursor-pointer underline p-0" style={{ color: 'var(--amber)' }}>Sign in</button>
            </p>
          </div>
        )}

        {/* ─── LOGIN ─── */}
        {view === 'login' && (
          <div>
            <p className="text-[10px] tracking-[3px] uppercase font-medium mb-3" style={{ color: 'var(--amber)' }}>Welcome Back</p>
            <h2 className="font-display text-[clamp(24px,5vw,32px)] font-light mb-2" style={{ color: 'var(--text)' }}>Sign in</h2>
            <p className="text-[clamp(12px,3vw,14px)] font-light mb-5" style={{ color: 'var(--subtext)', lineHeight: 1.65 }}>Enter your credentials to access the library.</p>

            <GoogleSignInButton onClick={handleGoogleSignIn} label="Sign in with Google" disabled={googleLoading} />

            <div className="flex items-center gap-3 my-4" style={{ color: 'var(--muted)' }}>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} /><span className="text-[10px] tracking-[1px] uppercase">or</span><div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <input id="loginEmail" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="Email address" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 mb-2.5 placeholder:opacity-60" style={iStyle(!!loginError)} onFocus={(e) => { if (!loginError) e.currentTarget.style.borderColor = 'var(--amber)'; }} onBlur={(e) => { if (!loginError) e.currentTarget.style.borderColor = 'var(--border)'; }} />
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="Password" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 mb-1 placeholder:opacity-60" style={iStyle(!!loginError)} onFocus={(e) => { if (!loginError) e.currentTarget.style.borderColor = 'var(--amber)'; }} onBlur={(e) => { if (!loginError) e.currentTarget.style.borderColor = 'var(--border)'; }} />

            {loginError && <p className="text-[12px] mt-2" style={{ color: 'var(--error)' }}>{loginError}</p>}

            <button onClick={handleLogin} disabled={loginLoading} className="w-full rounded-[4px] mt-3 py-3.5 text-[12px] font-medium tracking-[2px] uppercase cursor-pointer transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed" style={{ background: 'var(--amber)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => { if (!loginLoading) e.currentTarget.style.background = '#daa85a'; }} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)' }>
              {loginLoading ? <><span className="gate-spinner" />Signing in…</> : 'Sign In'}
            </button>

            <p className="text-[11px] mt-3.5" style={{ color: 'var(--muted)', letterSpacing: '0.3px', lineHeight: 1.5 }}>
              No account yet?{' '}
              <button onClick={showSignup} className="bg-transparent border-none cursor-pointer underline p-0" style={{ color: 'var(--amber)' }}>Create one free</button>
            </p>
          </div>
        )}

        {/* ─── VERIFY ─── */}
        {view === 'verify' && (
          <div>
            <p className="text-[10px] tracking-[3px] uppercase font-medium mb-3" style={{ color: 'var(--amber)' }}>Verify Your Email</p>
            <h2 className="font-display text-[clamp(24px,5vw,32px)] font-light mb-2" style={{ color: 'var(--text)' }}>Check your inbox</h2>
            <p className="text-[clamp(12px,3vw,14px)] font-light mb-5" style={{ color: 'var(--subtext)', lineHeight: 1.65 }}>
              We sent a 6-digit verification code to <strong style={{ color: 'var(--text)' }}>{getPendingUser()?.email}</strong>.<br />Enter it below to complete your registration.
            </p>

            {emailSent && (
              <div className="mb-4 p-3 rounded-[4px] text-center" style={{ background: 'rgba(106,184,122,0.1)', border: '1px solid rgba(106,184,122,0.3)' }}>
                <p className="text-[12px]" style={{ color: '#6ab87a' }}>✓ Code sent to your Gmail inbox</p>
              </div>
            )}

            {emailError && (
              <div className="mb-4 p-3 rounded-[4px] text-left" style={{ background: 'rgba(224,85,85,0.15)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}>
                <p className="text-[11px]">{emailError}</p>
              </div>
            )}

            <input id="verifyCode" type="text" value={verifyCode} onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); if (verifyError) setVerifyError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleVerify()} placeholder="6-digit code" maxLength={6} className="w-full rounded-[4px] px-3.5 py-3 text-[16px] font-light outline-none transition-colors duration-200 mb-1 text-center tracking-[8px] placeholder:tracking-normal placeholder:opacity-60" style={iStyle(!!verifyError)} onFocus={(e) => { if (!verifyError) e.currentTarget.style.borderColor = 'var(--amber)'; }} onBlur={(e) => { if (!verifyError) e.currentTarget.style.borderColor = 'var(--border)'; }} />

            {verifyError && <p className="text-[12px] mt-2" style={{ color: 'var(--error)' }}>{verifyError}</p>}

            <button onClick={handleVerify} disabled={verifyLoading} className="w-full rounded-[4px] mt-3 py-3.5 text-[12px] font-medium tracking-[2px] uppercase cursor-pointer transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed" style={{ background: 'var(--amber)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => { if (!verifyLoading) e.currentTarget.style.background = '#daa85a'; }} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)' }>
              {verifyLoading ? <><span className="gate-spinner" />Verifying…</> : 'Verify & Create Account'}
            </button>

            <p className="text-[11px] mt-3.5" style={{ color: 'var(--muted)', letterSpacing: '0.3px', lineHeight: 1.5 }}>
              Didn't receive it?{' '}<button onClick={handleResendCode} className="bg-transparent border-none cursor-pointer underline p-0" style={{ color: 'var(--amber)' }}>Resend code</button><br />
              <button onClick={showSignup} className="bg-transparent border-none cursor-pointer underline p-0 mt-1" style={{ color: 'var(--amber)' }}>← Back to signup</button>
            </p>
          </div>
        )}

        {/* ─── SUCCESS ─── */}
        {view === 'success' && (
          <div className="py-5">
            <div className="text-[40px] mb-4">🎞️</div>
            <h2 className="font-display text-[clamp(22px,4vw,28px)] font-light mb-2" style={{ color: 'var(--text)' }}>You're in.</h2>
            <p className="text-[13px] mb-6" style={{ color: 'var(--subtext)', lineHeight: 1.65 }}>
              Welcome to the library, {welcomeName}.<br />Your founding member badge is reserved.
            </p>
            <button onClick={handleDismiss} className="rounded-[4px] px-8 py-3 text-[12px] font-medium tracking-[2px] uppercase cursor-pointer transition-colors duration-200" style={{ background: 'var(--amber)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => e.currentTarget.style.background = '#daa85a'} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)' }>
              Enter the Library →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
