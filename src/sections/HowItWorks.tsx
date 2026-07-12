import { useEffect, useRef } from 'react';

const steps = [
  {
    num: 'I',
    title: 'Upload your shot',
    desc: 'Drop in any photo or video clip from your phone — iPhone or Android. Any device, any lighting condition, anywhere.',
  },
  {
    num: 'II',
    title: 'Pick a vibe',
    desc: "Browse our curated LUT library — each named after a mood, era, or place. A feeling, not a filter.",
  },
  {
    num: 'III',
    title: 'AI reads your shot',
    desc: 'Our model analyzes your lighting, composition, and movement — then tells you what works and what to fix.',
  },
  {
    num: 'IV',
    title: 'Learn to recreate it',
    desc: 'Get the exact settings, time of day, and framing guide to shoot this look again — on purpose, every time.',
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);

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

  return (
    <section
      ref={sectionRef}
      className="py-20 px-5 transition-colors duration-350"
      style={{ background: 'var(--how-bg)' }}
    >
      <div className="max-w-[900px] mx-auto">
        <div className="text-center mb-11 reveal">
          <p
            className="text-[clamp(9px,2.5vw,10px)] tracking-[4px] uppercase font-medium mb-3"
            style={{ color: 'var(--amber)' }}
          >
            How it works
          </p>
          <h2
            className="font-display font-light"
            style={{ fontSize: 'clamp(24px, 5vw, 42px)', color: 'var(--text)' }}
          >
            From flat to filmic in seconds
          </h2>
        </div>

        <div
          className="rounded-[6px] overflow-hidden reveal transition-colors duration-350"
          style={{ border: '1px solid var(--how-border)' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className="transition-colors duration-350"
                style={{
                  padding: 'clamp(22px, 4vw, 34px)',
                  borderRight: i % 2 === 0 ? '1px solid var(--how-border)' : 'none',
                  borderBottom: i < 2 ? '1px solid var(--how-border)' : 'none',
                }}
              >
                <div
                  className="font-display font-light leading-none mb-3"
                  style={{ fontSize: 'clamp(34px, 6vw, 48px)', color: 'var(--amber-dim)' }}
                >
                  {step.num}
                </div>
                <h3
                  className="font-display font-normal mb-2"
                  style={{ fontSize: 'clamp(17px, 3.5vw, 22px)', color: 'var(--text)' }}
                >
                  {step.title}
                </h3>
                <p
                  className="font-light leading-[1.75]"
                  style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: 'var(--subtext)' }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
