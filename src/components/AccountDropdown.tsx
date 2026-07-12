import { useState, useRef, useEffect } from 'react';
import { getSession } from '@/lib/auth';

interface AccountDropdownProps {
  onLogOut: () => void;
  onSignOut: () => void;
}

export default function AccountDropdown({ onLogOut, onSignOut }: AccountDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const session = getSession();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!session) return null;

  const initials = `${(session.firstName || 'U')[0]}`.toUpperCase();
  const hasGoogleAvatar = !!session.googleAvatar;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-medium transition-all duration-200 border overflow-hidden"
        style={{ background: hasGoogleAvatar ? 'transparent' : 'var(--amber)', color: '#080808', borderColor: 'var(--amber-dim)', fontFamily: "'DM Sans', sans-serif" }}
        onMouseEnter={(e) => { if (!hasGoogleAvatar) e.currentTarget.style.background = '#daa85a'; e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={(e) => { if (!hasGoogleAvatar) e.currentTarget.style.background = 'var(--amber)'; e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {hasGoogleAvatar ? (
          <img
            src={session.googleAvatar}
            alt={session.firstName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          initials
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-10 w-56 rounded-[8px] overflow-hidden py-1.5 animate-fade-up"
          style={{ background: 'var(--popup-bg)', border: '1px solid var(--popup-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 300 }}
        >
          {/* User info */}
          <div className="px-3.5 py-2.5 mb-1 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            {hasGoogleAvatar && (
              <img
                src={session.googleAvatar}
                alt=""
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{session.firstName}</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>{session.email}</p>
            </div>
          </div>

          {/* Account Settings */}
          <button
            onClick={() => setOpen(false)}
            className="w-full text-left px-3.5 py-2 text-[12px] font-light transition-colors duration-150 flex items-center gap-2"
            style={{ color: 'var(--subtext)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--input-bg)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--subtext)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            Account Settings
          </button>

          {/* Log Out — temporary, user stays in DB */}
          <button
            onClick={() => { setOpen(false); onLogOut(); }}
            className="w-full text-left px-3.5 py-2 text-[12px] font-light transition-colors duration-150 flex items-center gap-2"
            style={{ color: 'var(--subtext)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--input-bg)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--subtext)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log Out
          </button>

          {/* Divider */}
          <div className="my-1 mx-3.5" style={{ borderTop: '1px solid var(--border)' }} />

          {/* Sign Out — permanent, removes from DB */}
          <button
            onClick={() => { setOpen(false); onSignOut(); }}
            className="w-full text-left px-3.5 py-2 text-[12px] font-light transition-colors duration-150 flex items-center gap-2"
            style={{ color: '#e05555' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224,85,85,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              <line x1="18" y1="6" x2="22" y2="6" /><line x1="20" y1="4" x2="20" y2="8" />
            </svg>
            Sign Out (Delete Account)
          </button>
        </div>
      )}
    </div>
  );
}
