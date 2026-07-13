import { useState, useEffect, useRef } from 'react';
import { sendEarlyAccessEmail } from '@/lib/auth';
import { apiWaitlist } from '@/lib/api';

export default function Waitlist() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  async function handleSubmit() {
    const val = email.trim();
    if (!val || !val.includes('@')) { setError('Please enter a valid email.'); return; }
    setSending(true); setError('');
    try {
      const result = await apiWaitlist.signup(val);
      if (!result.success) { setError(result.message); setSending(false); return; }
    } catch { setError('Failed to sign up.'); setSending(false); return; }
    try { await sendEarlyAccessEmail(val); } catch { /* silent */ }
    setSending(false); setSubmitted(true);
  }

  useEffect(() => {
    const el = sectionRef.current; if (!el) return;
    const reveals = el.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }); }, { threshold: 0.1 });
    reveals.forEach((r) => observer.observe(r)); return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 px-5 text-center relative transition-colors duration-350" style={{ background: 'var(--how-bg)' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-12" style={{ background: 'linear-gradient(to bottom, transparent, var(--muted))' }} />
      <div className="reveal">
        <p className="text-[clamp(9px,2.5vw,10px)] tracking-[4px] uppercase font-medium mb-3.5" style={{ color: 'var(--amber)' }}>Early Access</p>
        <h2 className="font-display font-light mb-2.5" style={{ fontSize: 'clamp(26px, 5vw, 46px)', color: 'var(--text)' }}>Be first to shoot differently.</h2>
        <p className="font-light mb-2 leading-[1.7]" style={{ fontSize: 'clamp(13px, 3vw, 15px)', color: 'var(--subtext)' }}>Opening to creators first.<br />Free premium LUTs + founding member badge included.</p>
        <p className="font-light mb-8 leading-[1.7]" style={{ fontSize: 'clamp(12px, 2.8vw, 14px)', color: 'var(--amber)' }}>A selection of premium LUTs will be available for free to all early access members.</p>
        {!submitted ? (
          <>
            <div className="flex w-full mx-auto mb-3 overflow-hidden" style={{ maxWidth: 'min(460px, 92vw)', border: '1px solid var(--amber-dim)', borderRadius: '3px' }}>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} placeholder="your@email.com" className="flex-1 border-none outline-none font-light" style={{ background: 'var(--input-bg)', padding: '13px 16px', color: 'var(--text)', fontSize: 'clamp(13px, 3.5vw, 14px)', fontFamily: "'DM Sans', sans-serif" }} />
              <button onClick={handleSubmit} disabled={sending} className="border-none cursor-pointer font-medium tracking-[1.5px] uppercase transition-colors duration-200 whitespace-nowrap disabled:opacity-60" style={{ background: 'var(--amber)', color: '#080808', padding: '13px clamp(14px, 4vw, 22px)', fontSize: 'clamp(10px, 2.5vw, 12px)', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => { if (!sending) e.currentTarget.style.background = '#daa85a'; }} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)' }>{sending ? '...' : 'Get Early Access'}</button>
            </div>
            {error && <p className="text-[12px] mb-2" style={{ color: 'var(--error)' }}>{error}</p>}
            <p className="text-[clamp(10px,2.5vw,11px)] tracking-[1px]" style={{ color: 'var(--muted)' }}>One signup per email. No spam. No noise. Just the drop.</p>
          </>
        ) : (
          <div>
            <p className="font-display italic mb-3.5" style={{ fontSize: 'clamp(16px, 3.5vw, 18px)', color: 'var(--amber)' }}>You&apos;re on the list. We&apos;ll be in touch. 🎞️</p>
          </div>
        )}
      </div>
    </section>
  );
}
