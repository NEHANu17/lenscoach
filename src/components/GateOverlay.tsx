import { useState, useEffect, useCallback } from 'react';
import {
  sha256, setSession, getSession, getPendingUser, setPendingUser,
  clearPendingUser, generateVerificationCode, sendVerificationEmail,
} from '@/lib/auth';
import { apiUsers } from '@/lib/api';
import { useMutation } from '@/hooks/useData';
import { GOOGLE_CLIENT_ID } from '@/lib/config';
import { validateEmail } from '@/lib/emailValidate';
import GoogleSignInButton from './GoogleSignInButton';

type GateView = 'signup' | 'login' | 'verify' | 'success';

interface Props { onAuthenticated: () => void; forceLogin?: boolean; kickedOut?: boolean; }

export default function GateOverlay({ onAuthenticated, forceLogin = false, kickedOut = false }: Props) {
  const [view, setView] = useState<GateView>(forceLogin ? 'login' : 'signup');
  const [isVisible, setIsVisible] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  const [signupLoading, setSignupLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [signupError, setSignupError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  const createUserMut = useMutation((user: Record<string, unknown>) => apiUsers.create(user));

  useEffect(() => {
    if (kickedOut) { clearPendingUser(); setView('signup'); setIsVisible(true); return; }
    if (forceLogin) { clearPendingUser(); setView('login'); setIsVisible(true); return; }
    const session = getSession();
    if (session?.email) { setWelcomeName(session.firstName); setView('success'); setIsVisible(true); setTimeout(() => onAuthenticated(), 1500); return; }
    setIsVisible(true);
  }, [onAuthenticated, forceLogin, kickedOut]);

  const clearErrors = useCallback(() => { setSignupError(''); setLoginError(''); setVerifyError(''); setGoogleError(''); setEmailError(''); }, []);
  const showSignup = useCallback(() => { clearErrors(); setView('signup'); clearPendingUser(); setVerifyCode(''); setEmailSent(false); setEmailError(''); }, [clearErrors]);
  const showLogin = useCallback(() => { clearErrors(); setView('login'); clearPendingUser(); setVerifyCode(''); setEmailSent(false); setEmailError(''); }, [clearErrors]);

  // Google Sign-In
  const handleGoogleSignIn = useCallback(() => {
    clearErrors(); setGoogleLoading(true);
    if (!window.google?.accounts?.oauth2) { setGoogleError('Google Sign-In library is loading. Please refresh.'); setGoogleLoading(false); return; }
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: 'openid email profile',
        callback: async (response) => {
          if (response.error || !response.access_token) { setGoogleError('Google sign-in failed.'); setGoogleLoading(false); return; }
          try {
            const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${response.access_token}` } });
            if (!res.ok) { setGoogleError('Failed to get Google account info.'); setGoogleLoading(false); return; }
            const userInfo = await res.json();
            if (!userInfo.email) { setGoogleError('No email from Google.'); setGoogleLoading(false); return; }
            // Get member count
            const countRes = await fetch('/api/users/count');
            const countData = await countRes.json();
            const memberNumber = (countData?.count ?? 0) + 1;
            await createUserMut.mutate({
              firstName: userInfo.given_name || 'User', lastName: userInfo.family_name || '',
              email: userInfo.email, googleId: String(userInfo.sub), googleAvatar: userInfo.picture,
              memberNumber, verified: true,
            });
            setSession({ email: userInfo.email, firstName: userInfo.given_name || 'User', googleAvatar: userInfo.picture });
            setWelcomeName(userInfo.given_name || 'User'); setView('success');
          } catch { setGoogleError('Google sign-in failed.'); }
          setGoogleLoading(false);
        },
        error_callback: () => { setGoogleError('Google Sign-In failed.'); setGoogleLoading(false); },
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch { setGoogleError('Google Sign-In initialization failed.'); setGoogleLoading(false); }
  }, [clearErrors, createUserMut]);

  // Signup
  const handleSignup = useCallback(async () => {
    clearErrors();
    if (!firstName.trim()) { setSignupError('Please enter your first name.'); return; }
    if (!email.trim() || !email.includes('@')) { setSignupError('Please enter a valid email.'); return; }
    if (password.length < 8) { setSignupError('Password must be at least 8 characters.'); return; }
    setSignupLoading(true);
    const validation = await validateEmail(email.trim());
    if (!validation.valid) { setSignupError(validation.reason || 'Invalid email.'); setSignupLoading(false); return; }
    const pwHash = await sha256(password + email.toLowerCase());
    const code = generateVerificationCode();
    setPendingUser({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), pwHash, code, createdAt: Date.now() });
    const result = await sendVerificationEmail(email.trim(), firstName.trim(), code);
    setEmailSent(result.success); if (!result.success && result.error) setEmailError(result.error);
    setSignupLoading(false); setView('verify');
  }, [clearErrors, firstName, lastName, email, password]);

  // Verify
  const handleVerify = useCallback(async () => {
    clearErrors();
    if (!verifyCode || verifyCode.length !== 6 || !/^\d{6}$/.test(verifyCode)) { setVerifyError('Enter the 6-digit code.'); return; }
    setVerifyLoading(true);
    const pending = getPendingUser();
    if (!pending) { setVerifyError('Session expired.'); setVerifyLoading(false); return; }
    if (Date.now() - pending.createdAt > 10 * 60 * 1000) { setVerifyError('Code expired.'); clearPendingUser(); setVerifyLoading(false); return; }
    if (verifyCode !== pending.code) { setVerifyError('Incorrect code.'); setVerifyLoading(false); return; }
    // Get count
    const countRes = await fetch('/api/users/count');
    const countData = await countRes.json();
    const memberNumber = (countData?.count ?? 0) + 1;
    await createUserMut.mutate({ firstName: pending.firstName, lastName: pending.lastName, email: pending.email, pwHash: pending.pwHash, memberNumber, verified: true });
    setSession({ email: pending.email, firstName: pending.firstName });
    clearPendingUser(); setWelcomeName(pending.firstName); setView('success'); setVerifyLoading(false);
  }, [clearErrors, verifyCode, createUserMut]);

  const handleResendCode = useCallback(async () => {
    const pending = getPendingUser();
    if (!pending) { setVerifyError('Session expired.'); return; }
    const newCode = generateVerificationCode();
    setPendingUser({ ...pending, code: newCode, createdAt: Date.now() });
    const result = await sendVerificationEmail(pending.email, pending.firstName, newCode);
    setEmailSent(result.success); setVerifyCode(''); setVerifyError('');
  }, []);

  // Login
  const handleLogin = useCallback(async () => {
    clearErrors();
    if (!loginEmail.trim() || !loginEmail.includes('@')) { setLoginError('Enter your email.'); return; }
    if (!loginPassword) { setLoginError('Enter your password.'); return; }
    setLoginLoading(true);
    try {
      const res = await fetch(`/api/users/find?email=${encodeURIComponent(loginEmail.trim())}`);
      const user = await res.json();
      if (!user) { setLoginLoading(false); setLoginError('No account found.'); return; }
      if (user.google_id && !user.pw_hash) { setLoginLoading(false); setLoginError('Use Google Sign-In for this account.'); return; }
      const pwHash = await sha256(loginPassword + loginEmail.toLowerCase());
      if (pwHash !== user.pw_hash) { setLoginLoading(false); setLoginError('Incorrect password.'); return; }
      setSession({ email: user.email, firstName: user.first_name, googleAvatar: user.google_avatar });
      setWelcomeName(user.first_name); setView('success');
    } catch { setLoginError('Login failed.'); }
    setLoginLoading(false);
  }, [clearErrors, loginEmail, loginPassword]);

  // Prevent escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (isVisible && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); } }
    if (isVisible) { document.addEventListener('keydown', handleKey); document.body.classList.add('locked'); }
    return () => { document.removeEventListener('keydown', handleKey); if (!isVisible) document.body.classList.remove('locked'); };
  }, [isVisible]);

  useEffect(() => { if (googleError) { const t = setTimeout(() => setGoogleError(''), 6000); return () => clearTimeout(t); } }, [googleError]);

  const iStyle = (hasErr: boolean) => ({ background: 'var(--input-bg)' as string, border: hasErr ? '1px solid var(--error)' : '1px solid var(--border)', color: 'var(--text)' as string, fontFamily: "'DM Sans', sans-serif" });

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4 transition-all duration-500" style={{ background: 'rgba(4,3,2,0.97)', backdropFilter: 'blur(12px)', zIndex: 800, opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? 'all' : 'none' }}>
      <div className="w-full max-w-[460px] text-center relative transition-transform duration-500" style={{ background: 'var(--popup-bg)', border: '1px solid var(--popup-border)', borderRadius: '10px', padding: 'clamp(32px, 6vw, 52px) clamp(28px, 5vw, 48px)', boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,146,74,0.08)', transform: isVisible ? 'translateY(0)' : 'translateY(24px)' }}>
        <span className="font-display text-[20px] font-semibold tracking-[3px] uppercase block mb-7" style={{ color: 'var(--text)' }}>Lens<span style={{ color: 'var(--amber)' }}>Coach</span></span>

        {kickedOut && <div className="mb-4 p-3 rounded-[4px] text-center text-[12px]" style={{ background: 'rgba(224,85,85,0.15)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}><p className="font-medium">Your account has been removed by the admin.</p><p>Please register again.</p></div>}
        {googleError && <div className="mb-4 p-3 rounded-[4px] text-[12px] text-left" style={{ background: 'rgba(224,85,85,0.15)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}>{googleError}</div>}

        {/* SIGN UP */}
        {view === 'signup' && (
          <div>
            <p className="text-[10px] tracking-[3px] uppercase font-medium mb-3" style={{ color: 'var(--amber)' }}>Free Access · Founding Member</p>
            <h2 className="font-display text-[clamp(24px,5vw,32px)] font-light mb-2" style={{ color: 'var(--text)' }}>Create your account</h2>
            <p className="text-[clamp(12px,3vw,14px)] font-light mb-5" style={{ color: 'var(--subtext)', lineHeight: 1.65 }}>Join founding creators. Get free premium LUTs and early access.</p>
            <GoogleSignInButton onClick={handleGoogleSignIn} label="Continue with Google" disabled={googleLoading} />
            <div className="flex items-center gap-3 my-4" style={{ color: 'var(--muted)' }}><div className="flex-1 h-px" style={{ background: 'var(--border)' }} /><span className="text-[10px] tracking-[1px] uppercase">or</span><div className="flex-1 h-px" style={{ background: 'var(--border)' }} /></div>
            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSignup()} placeholder="First name *" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 placeholder:opacity-60" style={iStyle(!!signupError)} />
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSignup()} placeholder="Last name" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 placeholder:opacity-60" style={iStyle(false)} onFocus={(e) => e.currentTarget.style.borderColor = 'var(--amber)'} onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'} />
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSignup()} placeholder="Email address *" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 mb-2.5 placeholder:opacity-60" style={iStyle(!!signupError)} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSignup()} placeholder="Password (min 8 chars) *" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 mb-1 placeholder:opacity-60" style={iStyle(!!signupError)} />
            {signupError && <p className="text-[12px] mt-2" style={{ color: 'var(--error)' }}>{signupError}</p>}
            <button onClick={handleSignup} disabled={signupLoading} className="w-full rounded-[4px] mt-3 py-3.5 text-[12px] font-medium tracking-[2px] uppercase cursor-pointer transition-colors duration-200 disabled:opacity-60" style={{ background: 'var(--amber)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => { if (!signupLoading) e.currentTarget.style.background = '#daa85a'; }} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)' }>{signupLoading ? 'Validating...' : 'Continue'}</button>
            <p className="text-[11px] mt-3.5" style={{ color: 'var(--muted)', letterSpacing: '0.3px', lineHeight: 1.5 }}>Already have an account? <button onClick={showLogin} className="bg-transparent border-none cursor-pointer underline p-0" style={{ color: 'var(--amber)' }}>Sign in</button></p>
          </div>
        )}

        {/* LOGIN */}
        {view === 'login' && (
          <div>
            <p className="text-[10px] tracking-[3px] uppercase font-medium mb-3" style={{ color: 'var(--amber)' }}>Welcome Back</p>
            <h2 className="font-display text-[clamp(24px,5vw,32px)] font-light mb-2" style={{ color: 'var(--text)' }}>Sign in</h2>
            <p className="text-[clamp(12px,3vw,14px)] font-light mb-5" style={{ color: 'var(--subtext)', lineHeight: 1.65 }}>Enter your credentials to access the library.</p>
            <GoogleSignInButton onClick={handleGoogleSignIn} label="Sign in with Google" disabled={googleLoading} />
            <div className="flex items-center gap-3 my-4" style={{ color: 'var(--muted)' }}><div className="flex-1 h-px" style={{ background: 'var(--border)' }} /><span className="text-[10px] tracking-[1px] uppercase">or</span><div className="flex-1 h-px" style={{ background: 'var(--border)' }} /></div>
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="Email address" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 mb-2.5 placeholder:opacity-60" style={iStyle(!!loginError)} />
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="Password" className="w-full rounded-[4px] px-3.5 py-3 text-[14px] font-light outline-none transition-colors duration-200 mb-1 placeholder:opacity-60" style={iStyle(!!loginError)} />
            {loginError && <p className="text-[12px] mt-2" style={{ color: 'var(--error)' }}>{loginError}</p>}
            <button onClick={handleLogin} disabled={loginLoading} className="w-full rounded-[4px] mt-3 py-3.5 text-[12px] font-medium tracking-[2px] uppercase cursor-pointer transition-colors duration-200 disabled:opacity-60" style={{ background: 'var(--amber)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => { if (!loginLoading) e.currentTarget.style.background = '#daa85a'; }} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)' }>{loginLoading ? 'Signing in...' : 'Sign In'}</button>
            <p className="text-[11px] mt-3.5" style={{ color: 'var(--muted)', letterSpacing: '0.3px', lineHeight: 1.5 }}>No account? <button onClick={showSignup} className="bg-transparent border-none cursor-pointer underline p-0" style={{ color: 'var(--amber)' }}>Create one free</button></p>
          </div>
        )}

        {/* VERIFY */}
        {view === 'verify' && (
          <div>
            <p className="text-[10px] tracking-[3px] uppercase font-medium mb-3" style={{ color: 'var(--amber)' }}>Verify Your Email</p>
            <h2 className="font-display text-[clamp(24px,5vw,32px)] font-light mb-2" style={{ color: 'var(--text)' }}>Check your inbox</h2>
            <p className="text-[clamp(12px,3vw,14px)] font-light mb-5" style={{ color: 'var(--subtext)', lineHeight: 1.65 }}>We sent a 6-digit code to <strong style={{ color: 'var(--text)' }}>{getPendingUser()?.email}</strong>.<br />Enter it below.</p>
            {emailSent && <div className="mb-4 p-3 rounded-[4px] text-center" style={{ background: 'rgba(106,184,122,0.1)', border: '1px solid rgba(106,184,122,0.3)' }}><p className="text-[12px]" style={{ color: '#6ab87a' }}>✓ Code sent to your Gmail</p></div>}
            {emailError && <div className="mb-4 p-3 rounded-[4px]" style={{ background: 'rgba(224,85,85,0.15)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}><p className="text-[11px]">{emailError}</p></div>}
            <input type="text" value={verifyCode} onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); if (verifyError) setVerifyError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleVerify()} placeholder="6-digit code" maxLength={6} className="w-full rounded-[4px] px-3.5 py-3 text-[16px] font-light outline-none transition-colors duration-200 mb-1 text-center tracking-[8px] placeholder:tracking-normal placeholder:opacity-60" style={iStyle(!!verifyError)} />
            {verifyError && <p className="text-[12px] mt-2" style={{ color: 'var(--error)' }}>{verifyError}</p>}
            <button onClick={handleVerify} disabled={verifyLoading} className="w-full rounded-[4px] mt-3 py-3.5 text-[12px] font-medium tracking-[2px] uppercase cursor-pointer transition-colors duration-200 disabled:opacity-60" style={{ background: 'var(--amber)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => { if (!verifyLoading) e.currentTarget.style.background = '#daa85a'; }} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)' }>{verifyLoading ? 'Verifying...' : 'Verify & Create Account'}</button>
            <p className="text-[11px] mt-3.5" style={{ color: 'var(--muted)', letterSpacing: '0.3px', lineHeight: 1.5 }}>Didn't receive it? <button onClick={handleResendCode} className="bg-transparent border-none cursor-pointer underline p-0" style={{ color: 'var(--amber)' }}>Resend code</button><br /><button onClick={showSignup} className="bg-transparent border-none cursor-pointer underline p-0 mt-1" style={{ color: 'var(--amber)' }}>← Back to signup</button></p>
          </div>
        )}

        {/* SUCCESS */}
        {view === 'success' && (
          <div className="py-5">
            <div className="text-[40px] mb-4">🎞️</div>
            <h2 className="font-display text-[clamp(22px,4vw,28px)] font-light mb-2" style={{ color: 'var(--text)' }}>You're in.</h2>
            <p className="text-[13px] mb-6" style={{ color: 'var(--subtext)', lineHeight: 1.65 }}>Welcome to the library, {welcomeName}.<br />Your founding member badge is reserved.</p>
            <button onClick={() => { setIsVisible(false); document.body.classList.remove('locked'); onAuthenticated(); }} className="rounded-[4px] px-8 py-3 text-[12px] font-medium tracking-[2px] uppercase cursor-pointer transition-colors duration-200" style={{ background: 'var(--amber)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => e.currentTarget.style.background = '#daa85a'} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)'}>Enter the Library →</button>
          </div>
        )}
      </div>
    </div>
  );
}
