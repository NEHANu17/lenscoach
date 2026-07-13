import { useEffect, useRef, useState, useCallback } from 'react';
import { apiLuts } from '@/lib/api';
import { useQuery } from '@/hooks/useData';
import VideoViewer from '@/components/VideoViewer';

const HOLD_DURATION = 600;

export default function LutLibrary() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLut, setViewerLut] = useState<Record<string, unknown> | null>(null);
  const [playingCards, setPlayingCards] = useState<Record<string, boolean>>({});
  const [holdingCards, setHoldingCards] = useState<Record<string, boolean>>({});
  const [videoLoaded, setVideoLoaded] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isHolding = useRef<Record<string, boolean>>({});
  const didHold = useRef<Record<string, boolean>>({});

  const { data: luts = [] } = useQuery(() => apiLuts.list(), []);

  const hasVideo = useCallback((lutId: string) => !!luts.find((l: Record<string, unknown>) => l.lut_id === lutId)?.video_url, [luts]);
  const getVideoUrl = useCallback((lutId: string) => (luts as Record<string, unknown>[]).find((l: Record<string, unknown>) => l.lut_id === lutId)?.video_url as string | undefined, [luts]);

  useEffect(() => {
    const el = sectionRef.current; if (!el) return;
    const reveals = el.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => { entries.forEach((entry, i) => { if (entry.isIntersecting) { setTimeout(() => entry.target.classList.add('visible'), i * 70); observer.unobserve(entry.target); } }); }, { threshold: 0.1 });
    reveals.forEach((r) => observer.observe(r)); return () => observer.disconnect();
  }, []);

  useEffect(() => {
    (luts as Record<string, unknown>[]).forEach((lut: Record<string, unknown>) => {
      if (lut.video_url) { const vid = document.getElementById('card-vid-' + lut.lut_id) as HTMLVideoElement | null; if (vid && !vid.src) { vid.src = lut.video_url as string; vid.load(); setVideoLoaded(prev => ({ ...prev, [lut.lut_id as string]: true })); } }
    });
  }, [luts]);

  function startHold(lutId: string) {
    if (!hasVideo(lutId)) return; didHold.current[lutId] = false; clearTimeout(timers.current[lutId]);
    timers.current[lutId] = setTimeout(() => { isHolding.current[lutId] = true; didHold.current[lutId] = true; setHoldingCards(prev => ({ ...prev, [lutId]: true })); setPlayingCards(prev => ({ ...prev, [lutId]: true })); const vid = document.getElementById('card-vid-' + lutId) as HTMLVideoElement | null; if (vid) { vid.muted = false; vid.volume = 0.85; vid.play().catch(() => { vid.muted = true; vid.play(); }); } }, HOLD_DURATION);
  }
  function endHold(lutId: string) {
    clearTimeout(timers.current[lutId]);
    if (isHolding.current[lutId]) { const vid = document.getElementById('card-vid-' + lutId) as HTMLVideoElement | null; if (vid) { vid.pause(); vid.currentTime = 0; vid.muted = true; } setPlayingCards(prev => ({ ...prev, [lutId]: false })); }
    isHolding.current[lutId] = false; setHoldingCards(prev => ({ ...prev, [lutId]: false }));
  }
  function handleTap(lut: Record<string, unknown>) { if (didHold.current[lut.lut_id as string]) { didHold.current[lut.lut_id as string] = false; return; } if (!hasVideo(lut.lut_id as string)) return; setViewerLut(lut); setViewerOpen(true); }

  return (
    <>
      <VideoViewer isOpen={viewerOpen} onClose={() => { setViewerOpen(false); setViewerLut(null); }} videoUrl={viewerLut ? getVideoUrl(viewerLut.lut_id as string) : undefined} name={viewerLut?.name as string} tag={viewerLut?.tag as string} />
      <section ref={sectionRef} className="py-20 px-5">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-11 reveal"><p className="text-[clamp(9px,2.5vw,10px)] tracking-[4px] uppercase font-medium mb-3" style={{ color: 'var(--amber)' }}>The Library</p><h2 className="font-display font-light" style={{ fontSize: 'clamp(24px, 5vw, 42px)', color: 'var(--text)' }}>Every LUT is a memory</h2></div>
          <div className="flex flex-col gap-[3px]">
            {(luts as Record<string, unknown>[]).map((lut: Record<string, unknown>) => {
              const videoAvailable = hasVideo(lut.lut_id as string);
              const isPlaying = playingCards[lut.lut_id as string];
              const isHoldingLocal = holdingCards[lut.lut_id as string];
              const isLoaded = videoLoaded[lut.lut_id as string];
              return (
                <div key={lut.id as number} className="reveal relative rounded-[5px] overflow-hidden transition-all duration-150 select-none" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', cursor: videoAvailable ? 'pointer' : 'default', transform: isHoldingLocal ? 'scale(0.985)' : 'scale(1)' }} onMouseDown={() => startHold(lut.lut_id as string)} onMouseUp={() => endHold(lut.lut_id as string)} onClick={() => handleTap(lut)} onTouchStart={() => startHold(lut.lut_id as string)} onTouchEnd={() => { endHold(lut.lut_id as string); if (!isHolding.current[lut.lut_id as string] && !didHold.current[lut.lut_id as string] && videoAvailable) handleTap(lut); }} onTouchCancel={() => endHold(lut.lut_id as string)}>
                  <div className="flex flex-col sm:flex-row items-stretch" style={{ minHeight: 'clamp(130px, 20vw, 170px)' }}>
                    <div className="relative overflow-hidden flex-shrink-0" style={{ width: '100%', height: 'clamp(140px, 40vw, 180px)' }}>
                      <div className="relative overflow-hidden flex-shrink-0" style={{ width: '100%', height: 'clamp(140px, 40vw, 180px)', background: '#0a0808' }}>
                        <video id={`card-vid-${lut.lut_id}`} loop playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-400" style={{ opacity: isLoaded ? 1 : 0 }} onLoadedData={() => setVideoLoaded(prev => ({ ...prev, [lut.lut_id as string]: true }))} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 transition-opacity duration-300" style={{ background: lut.gradient as string, opacity: isLoaded ? 0 : 1, pointerEvents: 'none' }}><span className="text-[clamp(20px,4vw,28px)] opacity-50">{lut.icon as string}</span><span className="text-[9px] tracking-[2px] uppercase text-center px-2.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans', sans-serif" }}>Video coming soon</span></div>
                        <div className="absolute inset-0 pointer-events-none opacity-[0.07]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '100px' }} />
                        {!isPlaying && videoAvailable && <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-0 hover:opacity-100" style={{ background: 'rgba(0,0,0,0.35)', zIndex: 9, pointerEvents: 'none' }}><svg width="32" height="32" viewBox="0 0 24 24" fill="#C8924A" style={{ opacity: 0.9 }}><path d="M8 5v14l11-7z" /></svg></div>}
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] transition-transform" style={{ background: 'var(--amber)', transform: isHoldingLocal ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: isHoldingLocal ? 'transform 0.6s linear' : 'none', zIndex: 10 }} />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center" style={{ padding: 'clamp(18px, 4vw, 28px)' }}>
                      <p className="text-[9px] tracking-[3px] uppercase font-medium mb-2" style={{ color: 'var(--amber)', fontFamily: "'DM Sans', sans-serif" }}>{lut.tag as string}</p>
                      <h3 className="font-display font-light mb-2" style={{ fontSize: 'clamp(20px, 4vw, 28px)', color: 'var(--text)' }}>{lut.name as string}</h3>
                      <p className="font-light leading-[1.7] max-w-[340px]" style={{ fontSize: 'clamp(12px, 2.8vw, 13px)', color: 'var(--subtext)' }}>{lut.description as string}</p>
                    </div>
                  </div>
                  {videoAvailable && <p className="absolute bottom-2.5 right-3.5 text-[9px] tracking-[1.5px] uppercase opacity-0 hover:opacity-100 transition-opacity duration-300" style={{ color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif" }}>Hold to preview · Tap to open</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
