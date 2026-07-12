export default function Footer() {
  return (
    <footer
      className="flex items-center justify-between flex-wrap gap-3 px-6 py-7 transition-colors duration-350"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <span
        className="font-display font-semibold tracking-[3px] uppercase"
        style={{ fontSize: 'clamp(15px, 3.5vw, 18px)', color: 'var(--text)' }}
      >
        Lens<span style={{ color: 'var(--amber)' }}>Coach</span>
      </span>
      <span
        className="text-[clamp(11px,2.5vw,12px)]"
        style={{ color: 'var(--muted)', letterSpacing: '0.5px' }}
      >
        © 2026 LensCoach · Built for creators who care about the frame.
      </span>
    </footer>
  );
}
