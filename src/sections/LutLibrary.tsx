import { useEffect, useRef, useState, useCallback } from 'react';
import { trpc } from '@/providers/trpc';
import VideoViewer from '@/components/VideoViewer';

const HOLD_DURATION = 600;

interface DisplayLut {
  id: string;
  name: string;
  tag: string;
  desc: string;
  icon: string;
  gradient: string;
  videoUrl?: string | null;
}

export default function LutLibrary() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLut, setViewerLut] = useState<DisplayLut | null>(null);
  const [playingCards, setPlayingCards] = useState<Record<string, boolean>>({});
  const [holdingCards, setHoldingCards] = useState<Record<string, boolean>>({});
  const [videoLoaded, setVideoLoaded] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isHolding = useRef<Record<string, boolean>>({});
  const didHold = useRef<Record<string, boolean>>({});

  // Load LUTs from Supabase via tRPC
  const { data: dbLuts = [] } = trpc.lut.list.useQuery();

  // Map DB LUTs to display format
  const luts: DisplayLut[] = dbLuts.map((lut) => ({
    id: lut.lutId,
    name: lut.name,
    tag: lut.tag,
    desc: lut.description,
    icon: lut.icon,
    gradient: lut.gradient,
    videoUrl: lut.videoUrl,
  }));

  const hasVideo = useCallback((lutId: string): boolean => {
    return !!dbLuts.find((l) => l.lutId === lutId)?.videoUrl;
  }, [dbLuts]);

  const getVideoUrl = useCallback((lutId: string): string | undefined => {
    return dbLuts.find((l) => l.lutId === lutId)?.videoUrl ?? undefined;
  }, [dbLuts]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const reveals = el.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('visible'), i * 70);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    reveals.forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  }, []);

  // Set video sources when LUTs load
  useEffect(() => {
    dbLuts.forEach((lut) => {
      if (lut.videoUrl) {
        const vid = document.getElementById('card-vid-' + lut.lutId) as HTMLVideoElement | null;
        if (vid && !vid.src) {
          vid.src = lut.videoUrl;
          vid.load();
          setVideoLoaded((prev) => ({ ...prev, [lut.lutId]: true }));
        }
      }
    });
  }, [dbLuts]);

  function startHold(lutId: string) {
    if (!hasVideo(lutId)) return;
    didHold.current[lutId] = false;
    clearTimeout(timers.current[lutId]);
    timers.current[lutId] = setTimeout(() => {
      isHolding.current[lutId] = true;
      didHold.current[lutId] = true;
      setHoldingCards((prev) => ({ ...prev, [lutId]: true }));
      setPlayingCards((prev) => ({ ...prev, [lutId]: true }));
      const vid = document.getElementById('card-vid-' + lutId) as HTMLVideoElement | null;
      if (vid) {
        vid.muted = false;
        vid.volume = 0.85;
        vid.play().catch(() => { vid.muted = true; vid.play(); });
      }
    }, HOLD_DURATION);
  }

  function endHold(lutId: string) {
    clearTimeout(timers.current[lutId]);
    if (isHolding.current[lutId]) {
      const vid = document.getElementById('card-vid-' + lutId) as HTMLVideoElement | null;
      if (vid) { vid.pause(); vid.currentTime = 0; vid.muted = true; }
      setPlayingCards((prev) => ({ ...prev, [lutId]: false }));
    }
    isHolding.current[lutId] = false;
    setHoldingCards((prev) => ({ ...prev, [lutId]: false }));
  }

  function handleTap(lut: DisplayLut) {
    if (didHold.current[lut.id]) { didHold.current[lut.id] = false; return; }
    if (!hasVideo(lut.id)) return;
    setViewerLut(lut);
    setViewerOpen(true);
  }

  return (
    <>
      <VideoViewer
        isOpen={viewerOpen}
        onClose={() => { setViewerOpen(false); setViewerLut(null); }}
        videoUrl={viewerLut ? getVideoUrl(viewerLut.id) : undefined}
        name={viewerLut?.name}
        tag={viewerLut?.tag}
      />

      <section ref={sectionRef} className="py-20 px-5">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-11 reveal">
            <p className="text-[clamp(9px,2.5vw,10px)] tracking-[4px] uppercase font-medium mb-3" style={{ color: 'var(--amber)' }}>The Library</p>
            <h2 className="font-display font-light" style={{ fontSize: 'clamp(24px, 5vw, 42px)', color: 'var(--text)' }}>Every LUT is a memory</h2>
          </div>

          <div className="flex flex-col gap-[3px]">
            {luts.map((lut) => {
              const videoAvailable = hasVideo(lut.id);
              const isPlaying = playingCards[lut.id];
              const isHoldingLocal = holdingCards[lut.id];
              const isLoaded = videoLoaded[lut.id];

              return (
                <div
                  key={lut.id}
                  className="reveal relative rounded-[5px] overflow-hidden transition-all duration-150 select-none"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', cursor: videoAvailable ? 'pointer' : 'default', transform: isHoldingLocal ? 'scale(0.985)' : 'scale(1)' }}
                  data-lut={lut.id}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--amber-dim)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                  onMouseDown={() => startHold(lut.id)}
                  onMouseUp={() => endHold(lut.id)}
                  onClick={() => handleTap(lut)}
                  onTouchStart={() => startHold(lut.id)}
                  onTouchEnd={() => { endHold(lut.id); if (!isHolding.current[lut.id] && !didHold.current[lut.id] && videoAvailable) handleTap(lut); }}
                  onTouchCancel={() => endHold(lut.id)}
                >
                  <div className="flex flex-col sm:flex-row items-stretch" style={{ minHeight: 'clamp(130px, 20vw, 170px)' }}>
                    {/* Video box */}
                    <div className="relative overflow-hidden flex-shrink-0" style={{ width: '100%', height: 'clamp(140px, 40vw, 180px)' }}>
                      <style>{`@media(min-width:640px){.lut-vid-box-${lut.id}{width:clamp(160px,32%,240px)!important;height:100%!important;}}`}</style>
                      <div className={`relative overflow-hidden flex-shrink-0 lut-vid-box-${lut.id}`} style={{ width: '100%', height: 'clamp(140px, 40vw, 180px)', background: '#0a0808' }}>
                        <video
                          id={`card-vid-${lut.id}`}
                          loop playsInline preload="metadata"
                          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-400"
                          style={{ opacity: isLoaded ? 1 : 0 }}
                          onLoadedData={() => setVideoLoaded((prev) => ({ ...prev, [lut.id]: true }))}
                        />

                        {/* Placeholder */}
                        <div
                          className="lut-placeholder absolute inset-0 flex flex-col items-center justify-center gap-2 transition-opacity duration-300"
                          style={{ background: lut.gradient, opacity: isLoaded ? 0 : 1, pointerEvents: 'none' }}
                        >
                          <span className="text-[clamp(20px,4vw,28px)] opacity-50">{lut.icon}</span>
                          <span className="text-[9px] tracking-[2px] uppercase text-center px-2.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans', sans-serif" }}>Video coming soon</span>
                        </div>

                        {/* Noise overlay */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.07]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '100px' }} />

                        {/* Play indicator */}
                        {!isPlaying && videoAvailable && (
                          <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 hover:opacity-100 opacity-0" style={{ background: 'rgba(0,0,0,0.35)', zIndex: 9, pointerEvents: 'none' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="#C8924A" style={{ opacity: 0.9 }}><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        )}

                        {/* Hold bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] transition-transform" style={{ background: 'var(--amber)', transform: isHoldingLocal ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: isHoldingLocal ? 'transform 0.6s linear' : 'none', zIndex: 10 }} />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 flex flex-col justify-center" style={{ padding: 'clamp(18px, 4vw, 28px)' }}>
                      <p className="text-[9px] tracking-[3px] uppercase font-medium mb-2" style={{ color: 'var(--amber)', fontFamily: "'DM Sans', sans-serif" }}>{lut.tag}</p>
                      <h3 className="font-display font-light mb-2" style={{ fontSize: 'clamp(20px, 4vw, 28px)', color: 'var(--text)' }}>{lut.name}</h3>
                      <p className="font-light leading-[1.7] max-w-[340px]" style={{ fontSize: 'clamp(12px, 2.8vw, 13px)', color: 'var(--subtext)' }}>{lut.desc}</p>
                    </div>
                  </div>

                  {/* Hint */}
                  {videoAvailable && (
                    <p className="absolute bottom-2.5 right-3.5 text-[9px] tracking-[1.5px] uppercase opacity-0 hover:opacity-100 transition-opacity duration-300" style={{ color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif" }}>Hold to preview · Tap to open</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
