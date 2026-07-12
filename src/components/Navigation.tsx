import { useState } from 'react';
import AccountDropdown from './AccountDropdown';

interface NavigationProps {
  onOpenAdmin: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  onLogOut: () => void;
  onSignOut: () => void;
}

export default function Navigation({ onOpenAdmin, isAuthenticated, isAdmin, onLogOut, onSignOut }: NavigationProps) {
  const [dark, setDark] = useState(true);

  function toggleTheme() {
    const newDark = !dark;
    setDark(newDark);
    document.documentElement.setAttribute('data-theme', newDark ? 'dark' : 'light');
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4 transition-colors duration-350"
      style={{
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border)',
        zIndex: 200,
      }}
    >
      <a
        href="#"
        className="font-display font-semibold tracking-[3px] uppercase no-underline transition-colors duration-200"
        style={{ fontSize: 'clamp(17px, 4vw, 22px)', color: 'var(--text)' }}
      >
        Lens<span style={{ color: 'var(--amber)' }}>Coach</span>
      </a>
      <div className="flex items-center gap-2.5">
        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="rounded-[20px] px-3.5 py-1.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer transition-all duration-200 bg-transparent"
            style={{ border: '1px solid var(--amber-dim)', color: 'var(--amber)', fontFamily: "'DM Sans', sans-serif" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--amber)'; e.currentTarget.style.color = '#080808'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--amber)'; }}
          >
            Admin
          </button>
        )}
        <button
          onClick={toggleTheme}
          className="rounded-[20px] px-3.5 py-1.5 text-[12px] font-normal tracking-[0.5px] cursor-pointer transition-all duration-200 bg-transparent flex items-center gap-1.5"
          style={{ border: '1px solid var(--border)', color: 'var(--subtext)', fontFamily: "'DM Sans', sans-serif" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--subtext)'; }}
        >
          <span>{dark ? '☀️' : '🌙'}</span>
          <span>{dark ? 'Light' : 'Dark'}</span>
        </button>

        {isAuthenticated && <AccountDropdown onLogOut={onLogOut} onSignOut={onSignOut} />}
      </div>
    </nav>
  );
}
