import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/providers/trpc';

export default function Hero() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const autoDone = useRef(false);

  // Load hero images from Supabase
  const { data: heroImages = [] } = trpc.hero.list.useQuery();
  const slide1 = heroImages.find((h) => h.slot === 1);
  const slide2 = heroImages.find((h) => h.slot === 2);

  function handleHeroEmail() {
    const val = email.trim();
    if (!val || !val.includes('@')) return;
    setSubmitted(true);
  }

  // Slider logic
  const setSlider = useCallback((pct: number) => {
    pct = Math.max(0, Math.min(100, pct));
    if (revealRef.current) revealRef.current.style.width = pct + '%';
    if (dividerRef.current) dividerRef.current.style.left = pct + '%';
  }, []);

  useEffect(() => {
    setSlider(50);

    const slider = sliderRef.current;
    if (!slider) return;

    function onMouseDown(e: MouseEvent) {
      dragging.current = true;
      e.preventDefault();
    }
    function onMouseUp() { dragging.current = false; }
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !slider) return;
      const r = slider.getBoundingClientRect();
      setSlider(((e.clientX - r.left) / r.width) * 100);
    }
    function onTouchStart() { dragging.current = true; }
    function onTouchEnd() { dragging.current = false; }
    function onTouchMove(e: TouchEvent) {
      if (!dragging.current || !slider) return;
      const r = slider.getBoundingClientRect();
      setSlider(((e.touches[0].clientX - r.left) / r.width) * 100);
    }

    slider.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    slider.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    // Auto demo
    let autoDir = 1;
    let autoPct = 50;
    const autoDemo = setInterval(() => {
      if (autoDone.current) { clearInterval(autoDemo); return; }
      autoPct += autoDir * 0.35;
      if (autoPct > 72) autoDir = -1;
      if (autoPct < 28) autoDir = 1;
      setSlider(autoPct);
    }, 16);

    const stopAuto = () => { autoDone.current = true; };
    slider.addEventListener('mousedown', stopAuto);
    slider.addEventListener('touchstart', stopAuto, { passive: true });

    return () => {
      clearInterval(autoDemo);
      slider.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      slider.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [setSlider]);

  const hasCustomImages = !!slide1?.imageUrl || !!slide2?.imageUrl;

  return (
    <section
      className="min-h-[100dvh] flex flex-col items-center justify-center relative"
      style={{ padding: '100px 20px 60px', textAlign: 'center' }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(200,146,74,0.05) 0%, transparent 65%)',
        }}
      />

      <p
        className="text-[clamp(10px,2.5vw,11px)] font-medium tracking-[4px] uppercase mb-5 animate-fade-up-delay-1"
        style={{ color: 'var(--amber)' }}
      >
        AI · Cinematography · LUTs
      </p>

      <h1
        className="font-display font-light leading-[0.92] tracking-[-1px] mb-3.5 animate-fade-up-delay-2"
        style={{ fontSize: 'clamp(44px, 11vw, 108px)', color: 'var(--text)' }}
      >
        Shoot like a<br />
        <em style={{ color: 'var(--amber)', fontStyle: 'italic' }}>cinematographer.</em>
      </h1>

      <p
        className="font-display font-light italic mb-8 animate-fade-up-delay-3"
        style={{ fontSize: 'clamp(16px, 3.5vw, 24px)', color: 'var(--subtext)' }}
      >
        Your phone footage, transformed into something unforgettable.
      </p>

      {/* Email row */}
      {!submitted ? (
        <div
          className="flex w-full mx-auto mb-3 overflow-hidden animate-fade-up-delay-4"
          style={{ maxWidth: 'min(460px, 92vw)', border: '1px solid var(--amber-dim)', borderRadius: '3px' }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleHeroEmail()}
            placeholder="your@email.com"
            className="flex-1 border-none outline-none font-light"
            style={{
              background: 'var(--input-bg)',
              padding: '13px 16px',
              color: 'var(--text)',
              fontSize: 'clamp(13px, 3.5vw, 14px)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
          <button
            onClick={handleHeroEmail}
            className="border-none cursor-pointer font-medium tracking-[1.5px] uppercase transition-colors duration-200 whitespace-nowrap"
            style={{
              background: 'var(--amber)',
              color: '#080808',
              padding: '13px clamp(14px, 4vw, 22px)',
              fontSize: 'clamp(10px, 2.5vw, 12px)',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#daa85a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--amber)')}
          >
            Get Early Access
          </button>
        </div>
      ) : (
        <p
          className="text-[clamp(10px,2.5vw,11px)] tracking-[1px] mb-9 animate-fade-up"
          style={{ color: 'var(--amber)' }}
        >
          You're on the list. 🎞️
        </p>
      )}

      {!submitted && (
        <p
          className="text-[clamp(10px,2.5vw,11px)] tracking-[1px] mb-9 animate-fade-up-delay-5"
          style={{ color: 'var(--muted)' }}
        >
          Free to join · No spam
        </p>
      )}

      {/* Slider */}
      <div
        ref={sliderRef}
        className="relative mx-auto mb-3.5 overflow-hidden cursor-ew-resize select-none animate-fade-up-delay-6"
        style={{
          width: 'min(800px, 94vw)',
          aspectRatio: '16/9',
          borderRadius: '4px',
          touchAction: 'none',
          boxShadow: '0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,146,74,0.15)',
        }}
      >
        {/* After layer (Slide 2 or fallback gradient) */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: slide2?.imageUrl
              ? `url(${slide2.imageUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg,#1a0f05 0%,#3d2510 25%,#6b4020 50%,#9a6535 70%,#c4923a 85%,#8a5520 100%)',
            zIndex: 0,
          }}
        >
          {!hasCustomImages && (
            <>
              <div className="absolute w-[260px] h-[260px] rounded-full opacity-25" style={{ background: '#ffaa44', top: '-80px', right: '60px' }} />
              <div className="absolute w-[160px] h-[160px] rounded-full opacity-20" style={{ background: '#ff8822', bottom: '30px', left: '100px' }} />
            </>
          )}
          <span
            className="absolute bottom-3 text-[clamp(9px,2vw,10px)] tracking-[2px] uppercase font-medium rounded-[2px] px-2.5 py-1"
            style={{
              left: '12px',
              background: 'rgba(200,146,74,0.2)',
              color: '#C8924A',
              border: '1px solid rgba(200,146,74,0.3)',
              fontFamily: "'DM Sans', sans-serif",
              zIndex: 5,
            }}
          >
            {slide2?.caption ?? 'After · Tokyo Night LUT'}
          </span>
        </div>

        {/* Reveal half (Slide 1 or fallback gradient) */}
        <div
          ref={revealRef}
          className="absolute top-0 left-0 bottom-0 overflow-hidden"
          style={{ width: '50%', zIndex: 2 }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 flex items-center justify-center"
            style={{
              width: 'min(800px, 94vw)',
              background: slide1?.imageUrl
                ? `url(${slide1.imageUrl}) center/cover no-repeat`
                : 'linear-gradient(135deg,#3a3a3a 0%,#5a5a5a 30%,#4a4040 60%,#383030 100%)',
              filter: slide1?.imageUrl ? 'none' : 'saturate(0.3) brightness(1.1)',
            }}
          >
            {!hasCustomImages && (
              <>
                <div className="absolute w-[200px] h-[200px] rounded-full opacity-15" style={{ background: '#fff', top: '-60px', right: '80px' }} />
                <div className="absolute w-[120px] h-[120px] rounded-full opacity-15" style={{ background: '#ccc', bottom: '40px', left: '120px' }} />
              </>
            )}
            <span
              className="absolute bottom-3 text-[clamp(9px,2vw,10px)] tracking-[2px] uppercase font-medium rounded-[2px] px-2.5 py-1"
              style={{
                right: '12px',
                background: 'rgba(0,0,0,0.6)',
                color: '#999',
                fontFamily: "'DM Sans', sans-serif",
                zIndex: 5,
              }}
            >
              {slide1?.caption ?? 'Before · Raw footage'}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          ref={dividerRef}
          className="absolute top-0 bottom-0"
          style={{ left: '50%', width: '2px', background: '#C8924A', zIndex: 10, transform: 'translateX(-50%)' }}
        >
          <div
            className="absolute top-1/2 left-1/2 flex items-center justify-center rounded-full"
            style={{
              width: '38px',
              height: '38px',
              background: '#C8924A',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 2px 16px rgba(200,146,74,0.5)',
              zIndex: 11,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5l-5 7 5 7M16 5l5 7-5 7" stroke="#080808" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      <p
        className="text-[clamp(10px,2.5vw,12px)] tracking-[1.5px] uppercase animate-fade-up-delay-7"
        style={{ color: 'var(--muted)' }}
      >
        Drag left or right · Raw phone footage vs. AI-graded cinematic
      </p>
    </section>
  );
}
