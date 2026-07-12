import { useState, useRef, useEffect, useCallback } from 'react';
import {
  sha256,
  getUsers,
  removeUser,
  getWaitlist,
  getLuts,
  updateLut,
  saveLuts,
  saveVideo,
  removeVideo,
  DEFAULT_LUTS,
  type User,
  type LutData,
  type VideoEntry,
} from '@/lib/auth';
import { getAllVideosDB, getVideoStorageSizeMB } from '@/lib/videoStore';

const ADMIN_HASH = 'f6fd73d07ce373f3936bfebcce8c2318dab09207c063d68feb670a0595ddbec2';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [waitlist, setWaitlist] = useState<string[]>([]);
  const [luts, setLuts] = useState<LutData[]>(getLuts());
  const [videos, setVideos] = useState<Record<string, VideoEntry>>({});
  const [storageSize, setStorageSize] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'luts' | 'members' | 'waitlist'>('luts');
  const [editingLut, setEditingLut] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LutData>>({});
  const [uploadError, setUploadError] = useState<string>('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadMembers = useCallback(() => {
    setMembers(getUsers());
  }, []);

  const loadWaitlist = useCallback(() => {
    setWaitlist(getWaitlist());
  }, []);

  const loadVideos = useCallback(async () => {
    try {
      const all = await getAllVideosDB();
      setVideos(all);
      const size = await getVideoStorageSizeMB();
      setStorageSize(size);
    } catch {
      setVideos({});
    }
  }, []);

  // Load data when panel opens/unlocks
  useEffect(() => {
    if (isOpen && !unlocked) {
      setPin('');
      setPinError(false);
      setUploadError('');
      setTimeout(() => pinInputRef.current?.focus(), 300);
    }
    if (isOpen && unlocked) {
      loadMembers();
      loadWaitlist();
      setLuts(getLuts());
      loadVideos();
    }
  }, [isOpen, unlocked, loadMembers, loadWaitlist, loadVideos]);

  // Refresh members when switching TO members tab
  useEffect(() => {
    if (isOpen && unlocked && activeTab === 'members') {
      loadMembers();
    }
  }, [isOpen, unlocked, activeTab, loadMembers]);

  // Refresh waitlist when switching TO waitlist tab
  useEffect(() => {
    if (isOpen && unlocked && activeTab === 'waitlist') {
      loadWaitlist();
    }
  }, [isOpen, unlocked, activeTab, loadWaitlist]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.classList.add('locked');
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      if (!isOpen) document.body.classList.remove('locked');
    };
  }, [isOpen, onClose]);

  async function checkPin() {
    if (!pin) return;
    const hash = await sha256(pin);
    if (hash === ADMIN_HASH) {
      setUnlocked(true);
      setPinError(false);
      loadMembers();
      loadWaitlist();
      setLuts(getLuts());
      loadVideos();
    } else {
      setPinError(true);
      setPin('');
    }
  }

  // ── Upload video as base64 data URL (persists across devices) ──
  function handleUpload(lutId: string, file: File) {
    setUploadError('');

    // Warn about large files — localStorage typically has 5-10MB total quota
    if (file.size > 2 * 1024 * 1024) {
      if (!window.confirm(`This video is ${(file.size / 1024 / 1024).toFixed(1)}MB. Large videos may fail to save due to browser storage limits. Continue anyway?`)) {
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        try {
          saveVideo(lutId, dataUrl, file.name);
          // Refresh from IndexedDB (async) to update UI
          loadVideos();
          // Reset file input so the same file can be selected again
          const inputEl = fileInputRefs.current[lutId];
          if (inputEl) inputEl.value = '';
        } catch (err) {
          setUploadError(`Failed to save video: ${err instanceof Error ? err.message : 'Storage quota exceeded. Try a smaller video.'}`);
        }
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read video file. Please try again.');
    };
    reader.readAsDataURL(file);
  }

  function handleDeleteVideo(lutId: string) {
    if (window.confirm('Remove this video?')) {
      removeVideo(lutId);
      loadVideos();
    }
  }

  function startEdit(lut: LutData) {
    setEditingLut(lut.id);
    setEditForm({ ...lut });
  }

  function saveEdit() {
    if (!editingLut || !editForm) return;
    updateLut(editingLut, editForm);
    setLuts(getLuts());
    setEditingLut(null);
    setEditForm({});
  }

  function cancelEdit() {
    setEditingLut(null);
    setEditForm({});
  }

  function resetLuts() {
    if (window.confirm('Reset all LUTs to default values? This cannot be undone.')) {
      saveLuts([...DEFAULT_LUTS]);
      setLuts([...DEFAULT_LUTS]);
    }
  }

  const inputStyle = {
    background: 'var(--input-bg)' as string,
    border: '1px solid var(--border)',
    color: 'var(--text)' as string,
    fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 flex items-center justify-center px-4 transition-opacity duration-350"
      style={{
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(8px)',
        zIndex: 700,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'all' : 'none',
      }}
    >
      <div
        className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto relative transition-all duration-350"
        style={{
          background: 'var(--popup-bg)',
          border: '1px solid var(--popup-border)',
          borderRadius: '8px',
          padding: 'clamp(24px, 5vw, 40px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-transparent border-none cursor-pointer transition-colors duration-200"
          style={{ color: 'var(--muted)', fontSize: '20px' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
        >
          ✕
        </button>

        <h2 className="font-display text-[clamp(22px,4vw,28px)] font-light mb-1.5" style={{ color: 'var(--text)' }}>
          Admin Panel
        </h2>
        <p className="text-[12px] mb-5" style={{ color: 'var(--muted)', letterSpacing: '0.5px' }}>
          Manage LUTs, videos, members and waitlist.
        </p>

        {/* Lock Screen */}
        {!unlocked && (
          <div className="text-center py-5">
            <p className="text-[14px] mb-4" style={{ color: 'var(--subtext)' }}>Enter your admin password to continue.</p>
            <div className="flex items-center gap-3 mt-4">
              <input
                ref={pinInputRef}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && checkPin()}
                placeholder="Admin password"
                className="flex-1 rounded-[4px] px-3.5 py-2.5 text-[14px] outline-none transition-colors duration-200"
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--amber)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              />
              <button
                onClick={checkPin}
                className="rounded-[4px] px-5 py-2.5 text-[12px] font-medium tracking-[1px] uppercase cursor-pointer transition-colors duration-200"
                style={{ background: 'var(--amber)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#daa85a'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)'}
              >
                Unlock
              </button>
            </div>
            {pinError && <p className="text-[12px] mt-2.5" style={{ color: 'var(--error)' }}>Incorrect password. Access denied.</p>}
          </div>
        )}

        {/* Admin Content */}
        {unlocked && (
          <>
            {/* Tabs */}
            <div className="flex gap-0 mb-6 rounded-[4px] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <button
                onClick={() => { setActiveTab('luts'); setUploadError(''); }}
                className="flex-1 py-2.5 text-[12px] font-medium tracking-[1px] uppercase cursor-pointer transition-colors duration-200 border-none"
                style={{ background: activeTab === 'luts' ? 'var(--amber)' : 'transparent', color: activeTab === 'luts' ? '#080808' : 'var(--subtext)', fontFamily: "'DM Sans', sans-serif" }}
              >
                LUT Library
              </button>
              <button
                onClick={() => { setActiveTab('members'); setUploadError(''); }}
                className="flex-1 py-2.5 text-[12px] font-medium tracking-[1px] uppercase cursor-pointer transition-colors duration-200 border-none"
                style={{ background: activeTab === 'members' ? 'var(--amber)' : 'transparent', color: activeTab === 'members' ? '#080808' : 'var(--subtext)', fontFamily: "'DM Sans', sans-serif" }}
              >
                Members ({members.length})
              </button>
              <button
                onClick={() => { setActiveTab('waitlist'); setUploadError(''); }}
                className="flex-1 py-2.5 text-[12px] font-medium tracking-[1px] uppercase cursor-pointer transition-colors duration-200 border-none"
                style={{ background: activeTab === 'waitlist' ? 'var(--amber)' : 'transparent', color: activeTab === 'waitlist' ? '#080808' : 'var(--subtext)', fontFamily: "'DM Sans', sans-serif" }}
              >
                Waitlist ({waitlist.length})
              </button>
            </div>

            {/* Upload error banner */}
            {uploadError && (
              <div className="mb-4 p-3 rounded-[4px] text-[12px]" style={{ background: 'rgba(224,85,85,0.15)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}>
                {uploadError}
              </div>
            )}

            {/* ─── LUTS TAB ─── */}
            {activeTab === 'luts' && (
              <>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-[10px] tracking-[1px]" style={{ color: 'var(--muted)' }}>
                    Video storage: <strong style={{ color: 'var(--amber)' }}>{storageSize.toFixed(1)} MB</strong> used (IndexedDB)
                  </p>
                  <p className="text-[10px] tracking-[1px]" style={{ color: 'var(--muted)' }}>
                    Max per video: ~50 MB
                  </p>
                </div>
                {luts.map((lut) => {
                  const vid = videos[lut.id];
                  const hasVideo = !!vid;

                  return (
                    <div key={lut.id} className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                      {/* Header row */}
                      <div className="flex items-center gap-4 mb-3">
                        <div
                          className="w-16 h-[46px] rounded-[3px] flex-shrink-0 overflow-hidden flex items-center justify-center text-[14px] relative"
                          style={{ background: lut.gradient }}
                        >
                          {hasVideo ? (
                            <video src={vid.dataUrl} loop muted playsInline className="w-full h-full object-cover" />
                          ) : (
                            <span>{lut.icon}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-[16px] truncate" style={{ color: 'var(--text)' }}>{lut.name}</p>
                          <p className="text-[10px] tracking-[1px] truncate" style={{ color: 'var(--muted)' }}>{lut.tag}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingLut !== lut.id && (
                            <button
                              onClick={() => startEdit(lut)}
                              className="rounded-[3px] px-3 py-1.5 text-[10px] font-medium tracking-[1px] uppercase cursor-pointer transition-colors duration-200 border"
                              style={{ borderColor: 'var(--amber-dim)', color: 'var(--amber)', background: 'transparent', fontFamily: "'DM Sans', sans-serif" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--amber)'; e.currentTarget.style.color = '#080808'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--amber)'; }}
                            >
                              ✎ Edit
                            </button>
                          )}
                          <label
                            className="inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[10px] font-medium tracking-[1px] uppercase cursor-pointer transition-all duration-200 whitespace-nowrap border"
                            style={{ borderColor: 'var(--amber-dim)', color: 'var(--amber)', fontFamily: "'DM Sans', sans-serif" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--amber)'; e.currentTarget.style.color = '#080808'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--amber)'; }}
                          >
                            ↑ Upload
                            <input
                              ref={(el) => { fileInputRefs.current[lut.id] = el; }}
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(lut.id, file); }}
                            />
                          </label>
                          {hasVideo && (
                            <button
                              onClick={() => handleDeleteVideo(lut.id)}
                              className="rounded-[3px] px-2 py-1.5 text-[10px] font-medium cursor-pointer transition-colors duration-200 border"
                              style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent', fontFamily: "'DM Sans', sans-serif" }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--error)'; e.currentTarget.style.color = 'var(--error)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
                              title="Delete video"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <p className="text-[10px] tracking-[1px] mb-2" style={{ color: hasVideo ? '#6ab87a' : 'var(--muted)' }}>
                        {hasVideo ? `✓ Video: ${vid.fileName}` : 'No video uploaded'}
                      </p>

                      {/* Edit Form */}
                      {editingLut === lut.id && (
                        <div className="mt-3 p-4 rounded-[6px]" style={{ background: 'var(--input-bg)', border: '1px solid var(--how-border)' }}>
                          <p className="text-[10px] tracking-[2px] uppercase font-medium mb-3" style={{ color: 'var(--amber)' }}>Edit LUT</p>

                          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                            <div>
                              <label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--muted)' }}>Name</label>
                              <input type="text" value={editForm.name || ''} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none transition-colors duration-200" style={inputStyle} onFocus={(e) => e.currentTarget.style.borderColor = 'var(--amber)'} onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'} />
                            </div>
                            <div>
                              <label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--muted)' }}>Tag</label>
                              <input type="text" value={editForm.tag || ''} onChange={(e) => setEditForm((prev) => ({ ...prev, tag: e.target.value }))} className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none transition-colors duration-200" style={inputStyle} onFocus={(e) => e.currentTarget.style.borderColor = 'var(--amber)'} onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'} />
                            </div>
                          </div>

                          <div className="mb-2.5">
                            <label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--muted)' }}>Description</label>
                            <textarea value={editForm.desc || ''} onChange={(e) => setEditForm((prev) => ({ ...prev, desc: e.target.value }))} rows={3} className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none transition-colors duration-200 resize-none" style={inputStyle} onFocus={(e) => e.currentTarget.style.borderColor = 'var(--amber)'} onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'} />
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 mb-4">
                            <div>
                              <label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--muted)' }}>Icon (emoji)</label>
                              <input type="text" value={editForm.icon || ''} onChange={(e) => setEditForm((prev) => ({ ...prev, icon: e.target.value }))} className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none transition-colors duration-200" style={inputStyle} onFocus={(e) => e.currentTarget.style.borderColor = 'var(--amber)'} onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'} />
                            </div>
                            <div>
                              <label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--muted)' }}>Gradient CSS</label>
                              <input type="text" value={editForm.gradient || ''} onChange={(e) => setEditForm((prev) => ({ ...prev, gradient: e.target.value }))} className="w-full rounded-[4px] px-3 py-2 text-[11px] outline-none transition-colors duration-200 font-mono" style={inputStyle} onFocus={(e) => e.currentTarget.style.borderColor = 'var(--amber)'} onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'} />
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mb-4 p-3 rounded-[4px]" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                            <div className="w-16 h-[46px] rounded-[3px] flex items-center justify-center text-[14px]" style={{ background: editForm.gradient || lut.gradient }}>
                              <span>{editForm.icon || lut.icon}</span>
                            </div>
                            <div>
                              <p className="font-display text-[14px]" style={{ color: 'var(--text)' }}>{editForm.name || lut.name}</p>
                              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{editForm.tag || lut.tag}</p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button onClick={saveEdit} className="flex-1 rounded-[4px] py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer transition-colors duration-200 border-none" style={{ background: 'var(--amber)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => e.currentTarget.style.background = '#daa85a'} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--amber)'}>
                              Save Changes
                            </button>
                            <button onClick={cancelEdit} className="flex-1 rounded-[4px] py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer transition-colors duration-200 border" style={{ borderColor: 'var(--border)', color: 'var(--subtext)', background: 'transparent', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--error)'; e.currentTarget.style.color = 'var(--error)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--subtext)'; }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Reset button */}
                <button onClick={resetLuts} className="mt-4 w-full rounded-[4px] py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer transition-colors duration-200 border" style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--error)'; e.currentTarget.style.color = 'var(--error)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}>
                  ↺ Reset All LUTs to Defaults
                </button>
              </>
            )}

            {/* ─── MEMBERS TAB ─── */}
            {activeTab === 'members' && (
              <div className="mt-2">
                <div className="mb-3 p-3 rounded-[4px]" style={{ background: 'rgba(200,146,74,0.08)', border: '1px solid var(--amber-dim)' }}>
                  <p className="text-[10px] tracking-[0.5px] leading-[1.6]" style={{ color: 'var(--subtext)' }}>
                    <strong style={{ color: 'var(--amber)' }}>Note:</strong> Data is stored locally in each browser. Members who join on other devices will not appear here until a backend is added.
                  </p>
                </div>
                <p className="text-[11px] tracking-[1px] mb-3" style={{ color: 'var(--amber)' }}>
                  {members.length} member{members.length !== 1 ? 's' : ''} registered on this device
                </p>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                  {members.length === 0 ? (
                    <p className="text-[13px] text-center py-5 italic" style={{ color: 'var(--muted)' }}>
                      No members yet. Be patient — they&apos;re coming. 🎞️
                    </p>
                  ) : (
                    [...members].reverse().map((u) => {
                      const initials = `${(u.firstName || '?')[0]}${(u.lastName || '')[0]}`.toUpperCase();
                      const date = u.joinedAt ? new Date(u.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                      const authMethod = u.googleId ? 'Google' : 'Email';
                      return (
                        <div key={u.email} className="flex items-center gap-3 px-3 py-2.5 rounded-[4px]" style={{ border: '1px solid var(--border)', background: 'var(--input-bg)' }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-medium" style={{ background: 'var(--amber-dim)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-normal" style={{ color: 'var(--text)' }}>{u.firstName} {u.lastName || ''}</p>
                            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{u.email}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] block" style={{ color: 'var(--muted)' }}>{date}</span>
                              <span className="text-[9px] tracking-[0.5px]" style={{ color: u.googleId ? '#4285F4' : 'var(--amber-dim)' }}>✓ {authMethod}</span>
                            </div>
                            <button onClick={() => { if (window.confirm(`Remove ${u.firstName} ${u.lastName || ''} (${u.email})? This cannot be undone.`)) { removeUser(u.email); loadMembers(); } }} className="ml-1 rounded-[3px] px-2 py-1 text-[10px] font-medium tracking-[0.5px] uppercase cursor-pointer transition-all duration-200 border" style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent', fontFamily: "'DM Sans', sans-serif" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--error)'; e.currentTarget.style.color = 'var(--error)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }} title="Remove member">✕</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ─── WAITLIST TAB ─── */}
            {activeTab === 'waitlist' && (
              <div className="mt-2">
                <div className="mb-3 p-3 rounded-[4px]" style={{ background: 'rgba(200,146,74,0.08)', border: '1px solid var(--amber-dim)' }}>
                  <p className="text-[10px] tracking-[0.5px] leading-[1.6]" style={{ color: 'var(--subtext)' }}>
                    <strong style={{ color: 'var(--amber)' }}>Note:</strong> Waitlist is stored locally per browser. Signups from other devices will not appear here until a backend is added.
                  </p>
                </div>
                <p className="text-[11px] tracking-[1px] mb-3" style={{ color: 'var(--amber)' }}>
                  {waitlist.length} early access signup{waitlist.length !== 1 ? 's' : ''} on this device
                </p>
                <p className="text-[12px] mb-4" style={{ color: 'var(--subtext)' }}>
                  These emails are also sent to <strong style={{ color: 'var(--text)' }}>nehan.apex@gmail.com</strong> via EmailJS.
                </p>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                  {waitlist.length === 0 ? (
                    <p className="text-[13px] text-center py-5 italic" style={{ color: 'var(--muted)' }}>No early access signups yet.</p>
                  ) : (
                    [...waitlist].reverse().map((email, i) => (
                      <div key={email} className="flex items-center gap-3 px-3 py-2.5 rounded-[4px]" style={{ border: '1px solid var(--border)', background: 'var(--input-bg)' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-medium" style={{ background: 'var(--amber-dim)', color: '#080808', fontFamily: "'DM Sans', sans-serif" }}>{waitlist.length - i}</div>
                        <p className="text-[13px] font-normal flex-1" style={{ color: 'var(--text)' }}>{email}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
