import { useState, useRef, useEffect } from "react";
import { sha256, setAdminPin, clearAdminPin } from "@/lib/auth";
import { apiUsers, apiLuts, apiWaitlist, apiHero } from "@/lib/api";
import { useQuery, useMutation } from "@/hooks/useData";

const ADMIN_HASH = "f6fd73d07ce373f3936bfebcce8c2318dab09207c063d68feb670a0595ddbec2";

interface Props { isOpen: boolean; onClose: () => void; }

export default function AdminPanel({ isOpen, onClose }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState<"luts" | "members" | "waitlist" | "hero">("luts");
  const [uploadError, setUploadError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const pinInputRef = useRef<HTMLInputElement>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Data
  const { data: luts = [], refresh: refreshLuts } = useQuery(() => apiLuts.list(), [isOpen, unlocked]);
  const { data: members = [], refresh: refreshMembers } = useQuery(() => apiUsers.list(), [isOpen, unlocked, activeTab]);
  const { data: waitlistEntries = [], refresh: refreshWaitlist } = useQuery(() => apiWaitlist.list(), [isOpen, unlocked, activeTab]);
  const { data: heroImages = [], refresh: refreshHero } = useQuery(() => apiHero.list(), [isOpen, unlocked, activeTab]);

  // Edit state
  const [editingLut, setEditingLut] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Record<string, string>>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ lutId: "", name: "", tag: "", description: "", icon: "", gradient: "" });

  useEffect(() => {
    if (isOpen && !unlocked) { setPin(""); setPinError(false); setUploadError(""); setSuccessMsg(""); setTimeout(() => pinInputRef.current?.focus(), 300); }
  }, [isOpen, unlocked]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape" && isOpen) handleClose(); }
    if (isOpen) { document.addEventListener("keydown", handleEsc); document.body.classList.add("locked"); }
    return () => { document.removeEventListener("keydown", handleEsc); if (!isOpen) document.body.classList.remove("locked"); };
  }, [isOpen]);

  async function checkPin() {
    if (!pin) return;
    const hash = await sha256(pin);
    if (hash === ADMIN_HASH) { setUnlocked(true); setPinError(false); setAdminPin(pin); }
    else { setPinError(true); setPin(""); }
  }

  function handleClose() { clearAdminPin(); setUnlocked(false); onClose(); }

  // LUT edit
  function startEdit(lut: Record<string, unknown>) {
    setEditingLut(lut.lutId as string);
    setEditForm({ name: lut.name as string, tag: lut.tag as string, description: lut.description as string, icon: lut.icon as string, gradient: lut.gradient as string });
  }
  async function saveEdit() {
    if (!editingLut) return;
    const { name, tag, description, icon, gradient } = editForm;
    await apiLuts.update(editingLut, { name, tag, description, icon, gradient });
    refreshLuts(); setEditingLut(null); setEditForm({});
  }

  // LUT create
  async function handleCreateLut() {
    if (!createForm.lutId || !createForm.name || !createForm.tag || !createForm.description || !createForm.icon || !createForm.gradient) { setUploadError("Fill all fields."); return; }
    if (!/^[a-z0-9-]+$/.test(createForm.lutId)) { setUploadError("LUT ID: lowercase, numbers, hyphens only."); return; }
    await apiLuts.create(createForm); refreshLuts();
    setCreateForm({ lutId: "", name: "", tag: "", description: "", icon: "", gradient: "" });
    setShowCreateForm(false); setUploadError(""); setSuccessMsg("LUT created!"); setTimeout(() => setSuccessMsg(""), 3000);
  }

  // Video upload
  function handleUpload(lutId: string, file: File) {
    setUploadError("");
    if (file.size > 50 * 1024 * 1024) { setUploadError("Max 50MB."); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) { await apiLuts.uploadVideo(lutId, dataUrl, file.name); refreshLuts(); setSuccessMsg("Video uploaded!"); setTimeout(() => setSuccessMsg(""), 3000); }
      const inputEl = fileInputRefs.current[lutId]; if (inputEl) inputEl.value = "";
    };
    reader.onerror = () => setUploadError("Failed to read file.");
    reader.readAsDataURL(file);
  }

  // Hero upload
  function handleHeroUpload(slot: number, file: File) {
    setUploadError("");
    if (file.size > 10 * 1024 * 1024) { setUploadError("Max 10MB."); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) { await apiHero.update(slot, dataUrl); refreshHero(); setSuccessMsg("Hero image updated!"); setTimeout(() => setSuccessMsg(""), 3000); }
    };
    reader.onerror = () => setUploadError("Failed to read image.");
    reader.readAsDataURL(file);
  }

  const inputStyle = { background: "var(--input-bg)" as string, border: "1px solid var(--border)", color: "var(--text)" as string, fontFamily: "'DM Sans', sans-serif" };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }} className="fixed inset-0 flex items-center justify-center px-4 transition-opacity duration-350" style={{ background: "var(--overlay-bg)", backdropFilter: "blur(8px)", zIndex: 700, opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "all" : "none" }}>
      <div className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto relative transition-all duration-350" style={{ background: "var(--popup-bg)", border: "1px solid var(--popup-border)", borderRadius: "8px", padding: "clamp(24px, 5vw, 40px)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
        <button onClick={handleClose} className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-[20px]" style={{ color: "var(--muted)" }}>✕</button>
        <h2 className="font-display text-[clamp(22px,4vw,28px)] font-light mb-1.5" style={{ color: "var(--text)" }}>Admin Panel</h2>
        <p className="text-[12px] mb-5" style={{ color: "var(--muted)" }}>Manage LUTs, videos, members, waitlist and hero images.</p>

        {successMsg && <div className="mb-4 p-3 rounded-[4px] text-[12px] text-center" style={{ background: "rgba(106,184,122,0.1)", border: "1px solid rgba(106,184,122,0.3)", color: "#6ab87a" }}>{successMsg}</div>}
        {uploadError && <div className="mb-4 p-3 rounded-[4px] text-[12px]" style={{ background: "rgba(224,85,85,0.15)", border: "1px solid rgba(224,85,85,0.3)", color: "#e05555" }}>{uploadError}</div>}

        {!unlocked && (
          <div className="text-center py-5">
            <p className="text-[14px] mb-4" style={{ color: "var(--subtext)" }}>Enter your admin password.</p>
            <div className="flex items-center gap-3 mt-4">
              <input ref={pinInputRef} type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && checkPin()} placeholder="Admin password" className="flex-1 rounded-[4px] px-3.5 py-2.5 text-[14px] outline-none" style={inputStyle} />
              <button onClick={checkPin} className="rounded-[4px] px-5 py-2.5 text-[12px] font-medium tracking-[1px] uppercase cursor-pointer" style={{ background: "var(--amber)", color: "#080808", fontFamily: "'DM Sans', sans-serif" }}>Unlock</button>
            </div>
            {pinError && <p className="text-[12px] mt-2.5" style={{ color: "var(--error)" }}>Incorrect password.</p>}
          </div>
        )}

        {unlocked && (
          <>
            <div className="flex gap-0 mb-6 rounded-[4px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {(["luts", "members", "waitlist", "hero"] as const).map((tab) => (
                <button key={tab} onClick={() => { setActiveTab(tab); setUploadError(""); }} className="flex-1 py-2.5 text-[11px] font-medium tracking-[0.5px] uppercase cursor-pointer border-none transition-colors" style={{ background: activeTab === tab ? "var(--amber)" : "transparent", color: activeTab === tab ? "#080808" : "var(--subtext)", fontFamily: "'DM Sans', sans-serif" }}>
                  {tab === "luts" && "LUTs"}{tab === "members" && `Members (${members.length})`}{tab === "waitlist" && `Waitlist (${waitlistEntries.length})`}{tab === "hero" && "Hero Images"}
                </button>
              ))}
            </div>

            {/* LUTS TAB */}
            {activeTab === "luts" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setShowCreateForm(!showCreateForm)} className="rounded-[4px] px-4 py-2 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer border" style={{ borderColor: "var(--amber-dim)", color: "var(--amber)", background: "transparent", fontFamily: "'DM Sans', sans-serif" }}>{showCreateForm ? "✕ Cancel" : "+ Create LUT"}</button>
                </div>

                {showCreateForm && (
                  <div className="mb-6 p-4 rounded-[6px]" style={{ background: "var(--input-bg)", border: "1px solid var(--how-border)" }}>
                    <p className="text-[10px] tracking-[2px] uppercase font-medium mb-3" style={{ color: "var(--amber)" }}>Create New LUT</p>
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <div><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>LUT ID (lowercase)</label><input type="text" value={createForm.lutId} onChange={(e) => setCreateForm(p => ({ ...p, lutId: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="cyber-punk" className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none" style={inputStyle} /></div>
                      <div><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>Name</label><input type="text" value={createForm.name} onChange={(e) => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="Cyber Punk" className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none" style={inputStyle} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <div><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>Tag</label><input type="text" value={createForm.tag} onChange={(e) => setCreateForm(p => ({ ...p, tag: e.target.value }))} placeholder="Neon · Futuristic" className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none" style={inputStyle} /></div>
                      <div><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>Icon (emoji)</label><input type="text" value={createForm.icon} onChange={(e) => setCreateForm(p => ({ ...p, icon: e.target.value }))} placeholder="🤖" className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none" style={inputStyle} /></div>
                    </div>
                    <div className="mb-2.5"><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>Description</label><textarea value={createForm.description} onChange={(e) => setCreateForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Describe the look..." className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none resize-none" style={inputStyle} /></div>
                    <div className="mb-3"><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>Gradient CSS</label><input type="text" value={createForm.gradient} onChange={(e) => setCreateForm(p => ({ ...p, gradient: e.target.value }))} placeholder="linear-gradient(135deg,#000,#fff)" className="w-full rounded-[4px] px-3 py-2 text-[11px] outline-none font-mono" style={inputStyle} /></div>
                    <button onClick={handleCreateLut} className="w-full rounded-[4px] py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer border-none" style={{ background: "var(--amber)", color: "#080808", fontFamily: "'DM Sans', sans-serif" }}>Create LUT</button>
                  </div>
                )}

                {luts.map((lut: Record<string, unknown>) => {
                  const hasVideo = !!lut.video_url;
                  return (
                    <div key={lut.id as number} className="py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-16 h-[46px] rounded-[3px] flex-shrink-0 overflow-hidden flex items-center justify-center text-[14px] relative" style={{ background: lut.gradient as string }}>
                          {hasVideo ? <video src={lut.video_url as string} loop muted playsInline className="w-full h-full object-cover" /> : <span>{lut.icon as string}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-[16px] truncate" style={{ color: "var(--text)" }}>{lut.name as string}</p>
                          <p className="text-[10px] tracking-[1px] truncate" style={{ color: "var(--muted)" }}>{lut.tag as string}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingLut !== lut.lut_id && <button onClick={() => startEdit(lut)} className="rounded-[3px] px-3 py-1.5 text-[10px] font-medium tracking-[1px] uppercase cursor-pointer border" style={{ borderColor: "var(--amber-dim)", color: "var(--amber)", background: "transparent", fontFamily: "'DM Sans', sans-serif" }}>✎ Edit</button>}
                          <label className="inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[10px] font-medium tracking-[1px] uppercase cursor-pointer border" style={{ borderColor: "var(--amber-dim)", color: "var(--amber)", fontFamily: "'DM Sans', sans-serif" }}>↑ Upload<input ref={(el) => { fileInputRefs.current[lut.lut_id as string] = el; }} type="file" accept="video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(lut.lut_id as string, file); }} /></label>
                          {hasVideo && <button onClick={async () => { await apiLuts.removeVideo(lut.lut_id as string); refreshLuts(); }} className="rounded-[3px] px-2 py-1.5 text-[10px] cursor-pointer border" style={{ borderColor: "var(--border)", color: "var(--muted)", background: "transparent" }}>🗑</button>}
                          <button onClick={async () => { if (window.confirm(`Delete "${lut.name}"?`)) { await apiLuts.delete(lut.lut_id as string); refreshLuts(); } }} className="rounded-[3px] px-2 py-1.5 text-[10px] cursor-pointer border" style={{ borderColor: "var(--border)", color: "#e05555", background: "transparent" }}>✕</button>
                        </div>
                      </div>
                      <p className="text-[10px] tracking-[1px] mb-2" style={{ color: hasVideo ? "#6ab87a" : "var(--muted)" }}>{hasVideo ? "✓ Video uploaded" : "No video uploaded"}</p>
                      {editingLut === lut.lut_id && (
                        <div className="mt-3 p-4 rounded-[6px]" style={{ background: "var(--input-bg)", border: "1px solid var(--how-border)" }}>
                          <p className="text-[10px] tracking-[2px] uppercase font-medium mb-3" style={{ color: "var(--amber)" }}>Edit LUT</p>
                          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                            <div><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>Name</label><input type="text" value={editForm.name || ""} onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))} className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none" style={inputStyle} /></div>
                            <div><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>Tag</label><input type="text" value={editForm.tag || ""} onChange={(e) => setEditForm(p => ({ ...p, tag: e.target.value }))} className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none" style={inputStyle} /></div>
                          </div>
                          <div className="mb-2.5"><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>Description</label><textarea value={editForm.description || ""} onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none resize-none" style={inputStyle} /></div>
                          <div className="grid grid-cols-2 gap-2.5 mb-4">
                            <div><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>Icon</label><input type="text" value={editForm.icon || ""} onChange={(e) => setEditForm(p => ({ ...p, icon: e.target.value }))} className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none" style={inputStyle} /></div>
                            <div><label className="block text-[10px] tracking-[1px] uppercase mb-1" style={{ color: "var(--muted)" }}>Gradient</label><input type="text" value={editForm.gradient || ""} onChange={(e) => setEditForm(p => ({ ...p, gradient: e.target.value }))} className="w-full rounded-[4px] px-3 py-2 text-[11px] outline-none font-mono" style={inputStyle} /></div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveEdit} className="flex-1 rounded-[4px] py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer border-none" style={{ background: "var(--amber)", color: "#080808", fontFamily: "'DM Sans', sans-serif" }}>Save</button>
                            <button onClick={() => { setEditingLut(null); setEditForm({}); }} className="flex-1 rounded-[4px] py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer border" style={{ borderColor: "var(--border)", color: "var(--subtext)", background: "transparent" }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* MEMBERS TAB */}
            {activeTab === "members" && (
              <div className="mt-2">
                <p className="text-[11px] tracking-[1px] mb-3" style={{ color: "var(--amber)" }}>{members.length} member{members.length !== 1 ? "s" : ""} registered</p>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                  {members.length === 0 ? <p className="text-[13px] text-center py-5 italic" style={{ color: "var(--muted)" }}>No members yet. 🎞️</p> : [...members].reverse().map((u: Record<string, unknown>) => {
                    const initials = `${(u.first_name as string || "?")[0]}${(u.last_name as string || "")[0]}`.toUpperCase();
                    const date = u.created_at ? new Date(u.created_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
                    return (
                      <div key={u.id as number} className="flex items-center gap-3 px-3 py-2.5 rounded-[4px]" style={{ border: "1px solid var(--border)", background: "var(--input-bg)" }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-medium" style={{ background: "var(--amber-dim)", color: "#080808" }}>{initials}</div>
                        <div className="flex-1 min-w-0"><p className="text-[13px]" style={{ color: "var(--text)" }}>{u.first_name as string} {u.last_name as string || ""}</p><p className="text-[11px]" style={{ color: "var(--muted)" }}>{u.email as string}</p></div>
                        <div className="flex items-center gap-2 flex-shrink-0"><div className="text-right"><span className="text-[10px] block" style={{ color: "var(--muted)" }}>{date}</span><span className="text-[9px]" style={{ color: u.google_id ? "#4285F4" : "var(--amber-dim)" }}>✓ {u.google_id ? "Google" : "Email"}</span></div><button onClick={async () => { if (window.confirm(`Remove ${u.first_name as string}?`)) { await apiUsers.remove(u.email as string); refreshMembers(); } }} className="ml-1 rounded-[3px] px-2 py-1 text-[10px] cursor-pointer border" style={{ borderColor: "var(--border)", color: "var(--muted)", background: "transparent" }}>✕</button></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WAITLIST TAB */}
            {activeTab === "waitlist" && (
              <div className="mt-2">
                <p className="text-[11px] tracking-[1px] mb-3" style={{ color: "var(--amber)" }}>{waitlistEntries.length} signup{waitlistEntries.length !== 1 ? "s" : ""}</p>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                  {waitlistEntries.length === 0 ? <p className="text-[13px] text-center py-5 italic" style={{ color: "var(--muted)" }}>No signups yet.</p> : [...waitlistEntries].reverse().map((entry: Record<string, unknown>, i: number) => (
                    <div key={entry.id as number} className="flex items-center gap-3 px-3 py-2.5 rounded-[4px]" style={{ border: "1px solid var(--border)", background: "var(--input-bg)" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-medium" style={{ background: "var(--amber-dim)", color: "#080808" }}>{(waitlistEntries as unknown[]).length - i}</div>
                      <p className="text-[13px] flex-1" style={{ color: "var(--text)" }}>{entry.email as string}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HERO TAB */}
            {activeTab === "hero" && (
              <div className="mt-2">
                <p className="text-[11px] tracking-[1px] mb-4" style={{ color: "var(--amber)" }}>Edit the two hero carousel images</p>
                <div className="flex flex-col gap-6">
                  {[1, 2].map((slot) => {
                    const img = (heroImages as Record<string, unknown>[]).find((h: Record<string, unknown>) => h.slot === slot);
                    return (
                      <div key={slot} className="p-4 rounded-[6px]" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                        <p className="text-[10px] tracking-[2px] uppercase font-medium mb-3" style={{ color: "var(--amber)" }}>Slide {slot}</p>
                        <div className="w-full h-[140px] rounded-[4px] mb-3 overflow-hidden flex items-center justify-center" style={{ background: img ? "transparent" : "var(--card-bg)", border: "1px solid var(--border)" }}>
                          {img?.image_url ? <img src={img.image_url as string} alt={`Slide ${slot}`} className="w-full h-full object-cover" /> : <span className="text-[12px]" style={{ color: "var(--muted)" }}>No image — upload below</span>}
                        </div>
                        <label className="flex items-center justify-center gap-2 w-full rounded-[4px] px-3 py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer border" style={{ borderColor: "var(--amber-dim)", color: "var(--amber)", fontFamily: "'DM Sans', sans-serif" }}>📷 Upload New Image<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleHeroUpload(slot, file); }} /></label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
