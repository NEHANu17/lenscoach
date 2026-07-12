import { useState, useRef, useEffect } from "react";
import { sha256, setAdminPin, clearAdminPin } from "@/lib/auth";
import { trpc } from "@/providers/trpc";

const ADMIN_HASH =
  "f6fd73d07ce373f3936bfebcce8c2318dab09207c063d68feb670a0595ddbec2";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState<"luts" | "members" | "waitlist" | "hero">("luts");
  const [uploadError, setUploadError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── tRPC data ──
  const utils = trpc.useUtils();
  const { data: luts = [] } = trpc.lut.list.useQuery();
  const { data: members = [] } = trpc.user.list.useQuery();
  const { data: waitlistEntries = [] } = trpc.waitlist.list.useQuery();
  const { data: heroImages = [] } = trpc.hero.list.useQuery();

  const updateLut = trpc.lut.update.useMutation({
    onSuccess: () => utils.lut.list.invalidate(),
  });
  const createLut = trpc.lut.create.useMutation({
    onSuccess: () => {
      utils.lut.list.invalidate();
      setSuccessMsg("LUT created successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });
  const deleteLut = trpc.lut.delete.useMutation({
    onSuccess: () => utils.lut.list.invalidate(),
  });
  const resetLuts = trpc.lut.resetDefaults.useMutation({
    onSuccess: () => utils.lut.list.invalidate(),
  });
  const uploadVideo = trpc.lut.uploadVideo.useMutation({
    onSuccess: () => {
      utils.lut.list.invalidate();
      setSuccessMsg("Video uploaded!");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });
  const removeVideo = trpc.lut.removeVideo.useMutation({
    onSuccess: () => utils.lut.list.invalidate(),
  });
  const removeUser = trpc.user.remove.useMutation({
    onSuccess: () => utils.user.list.invalidate(),
  });
  const updateHero = trpc.hero.update.useMutation({
    onSuccess: () => {
      utils.hero.list.invalidate();
      setSuccessMsg("Hero image updated!");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });

  // ── Edit state ──
  const [editingLut, setEditingLut] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<{
    name: string;
    tag: string;
    description: string;
    icon: string;
    gradient: string;
  }>>({});

  // ── Create LUT state ──
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    lutId: "",
    name: "",
    tag: "",
    description: "",
    icon: "",
    gradient: "",
  });

  useEffect(() => {
    if (isOpen && !unlocked) {
      setPin("");
      setPinError(false);
      setUploadError("");
      setSuccessMsg("");
      setTimeout(() => pinInputRef.current?.focus(), 300);
    }
  }, [isOpen, unlocked]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.classList.add("locked");
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      if (!isOpen) document.body.classList.remove("locked");
    };
  }, [isOpen, onClose]);

  async function checkPin() {
    if (!pin) return;
    const hash = await sha256(pin);
    if (hash === ADMIN_HASH) {
      setUnlocked(true);
      setPinError(false);
      setAdminPin(pin);
    } else {
      setPinError(true);
      setPin("");
    }
  }

  function handleClose() {
    clearAdminPin();
    setUnlocked(false);
    onClose();
  }

  // ── LUT Editing ──
  function startEdit(lut: (typeof luts)[0]) {
    setEditingLut(lut.lutId);
    setEditForm({
      name: lut.name,
      tag: lut.tag,
      description: lut.description,
      icon: lut.icon,
      gradient: lut.gradient,
    });
  }

  function saveEdit() {
    if (!editingLut || !editForm) return;
    updateLut.mutate({ lutId: editingLut, ...editForm });
    setEditingLut(null);
    setEditForm({});
  }

  function cancelEdit() {
    setEditingLut(null);
    setEditForm({});
  }

  // ── LUT Creation ──
  function handleCreateLut() {
    if (
      !createForm.lutId ||
      !createForm.name ||
      !createForm.tag ||
      !createForm.description ||
      !createForm.icon ||
      !createForm.gradient
    ) {
      setUploadError("Please fill in all fields.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(createForm.lutId)) {
      setUploadError(
        "LUT ID must be lowercase letters, numbers, and hyphens only (no spaces)."
      );
      return;
    }
    createLut.mutate(createForm);
    setCreateForm({ lutId: "", name: "", tag: "", description: "", icon: "", gradient: "" });
    setShowCreateForm(false);
    setUploadError("");
  }

  // ── Video Upload ──
  function handleUpload(lutId: string, file: File) {
    setUploadError("");
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("Video must be under 50MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        uploadVideo.mutate({ lutId, dataUrl, fileName: file.name });
        const inputEl = fileInputRefs.current[lutId];
        if (inputEl) inputEl.value = "";
      }
    };
    reader.onerror = () => setUploadError("Failed to read video file.");
    reader.readAsDataURL(file);
  }

  // ── Hero Image Upload ──
  function handleHeroUpload(slot: number, file: File) {
    setUploadError("");
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be under 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        updateHero.mutate({ slot, base64Data: dataUrl });
      }
    };
    reader.onerror = () => setUploadError("Failed to read image file.");
    reader.readAsDataURL(file);
  }

  const inputStyle = {
    background: "var(--input-bg)" as string,
    border: "1px solid var(--border)",
    color: "var(--text)" as string,
    fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
      className="fixed inset-0 flex items-center justify-center px-4 transition-opacity duration-350"
      style={{
        background: "var(--overlay-bg)",
        backdropFilter: "blur(8px)",
        zIndex: 700,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "all" : "none",
      }}
    >
      <div
        className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto relative transition-all duration-350"
        style={{
          background: "var(--popup-bg)",
          border: "1px solid var(--popup-border)",
          borderRadius: "8px",
          padding: "clamp(24px, 5vw, 40px)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 bg-transparent border-none cursor-pointer transition-colors duration-200"
          style={{ color: "var(--muted)", fontSize: "20px" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
        >
          ✕
        </button>

        <h2
          className="font-display text-[clamp(22px,4vw,28px)] font-light mb-1.5"
          style={{ color: "var(--text)" }}
        >
          Admin Panel
        </h2>
        <p
          className="text-[12px] mb-5"
          style={{ color: "var(--muted)", letterSpacing: "0.5px" }}
        >
          Manage LUTs, videos, members, waitlist and hero images.
        </p>

        {/* Messages */}
        {successMsg && (
          <div
            className="mb-4 p-3 rounded-[4px] text-[12px] text-center"
            style={{
              background: "rgba(106,184,122,0.1)",
              border: "1px solid rgba(106,184,122,0.3)",
              color: "#6ab87a",
            }}
          >
            {successMsg}
          </div>
        )}
        {uploadError && (
          <div
            className="mb-4 p-3 rounded-[4px] text-[12px]"
            style={{
              background: "rgba(224,85,85,0.15)",
              border: "1px solid rgba(224,85,85,0.3)",
              color: "#e05555",
            }}
          >
            {uploadError}
          </div>
        )}

        {/* Lock Screen */}
        {!unlocked && (
          <div className="text-center py-5">
            <p className="text-[14px] mb-4" style={{ color: "var(--subtext)" }}>
              Enter your admin password to continue.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <input
                ref={pinInputRef}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkPin()}
                placeholder="Admin password"
                className="flex-1 rounded-[4px] px-3.5 py-2.5 text-[14px] outline-none transition-colors duration-200"
                style={inputStyle}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "var(--amber)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              />
              <button
                onClick={checkPin}
                className="rounded-[4px] px-5 py-2.5 text-[12px] font-medium tracking-[1px] uppercase cursor-pointer transition-colors duration-200"
                style={{
                  background: "var(--amber)",
                  color: "#080808",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#daa85a")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "var(--amber)")
                }
              >
                Unlock
              </button>
            </div>
            {pinError && (
              <p className="text-[12px] mt-2.5" style={{ color: "var(--error)" }}>
                Incorrect password. Access denied.
              </p>
            )}
          </div>
        )}

        {/* Admin Content */}
        {unlocked && (
          <>
            {/* Tabs */}
            <div
              className="flex gap-0 mb-6 rounded-[4px] overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {(["luts", "members", "waitlist", "hero"] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setUploadError("");
                    }}
                    className="flex-1 py-2.5 text-[11px] font-medium tracking-[0.5px] uppercase cursor-pointer transition-colors duration-200 border-none"
                    style={{
                      background:
                        activeTab === tab ? "var(--amber)" : "transparent",
                      color:
                        activeTab === tab ? "#080808" : "var(--subtext)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {tab === "luts" && "LUTs"}
                    {tab === "members" && `Members (${members.length})`}
                    {tab === "waitlist" && `Waitlist (${waitlistEntries.length})`}
                    {tab === "hero" && "Hero Images"}
                  </button>
                )
              )}
            </div>

            {/* ─── LUTS TAB ─── */}
            {activeTab === "luts" && (
              <>
                {/* Create LUT button */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="rounded-[4px] px-4 py-2 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer transition-all duration-200 border"
                    style={{
                      borderColor: "var(--amber-dim)",
                      color: "var(--amber)",
                      background: "transparent",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--amber)";
                      e.currentTarget.style.color = "#080808";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--amber)";
                    }}
                  >
                    {showCreateForm ? "✕ Cancel" : "+ Create LUT"}
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "Reset all LUTs to defaults? This will remove any custom LUTs and videos."
                        )
                      )
                        resetLuts.mutate();
                    }}
                    className="rounded-[4px] px-3 py-1.5 text-[10px] font-medium tracking-[0.5px] uppercase cursor-pointer transition-all duration-200 border"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--muted)",
                      background: "transparent",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--error)";
                      e.currentTarget.style.color = "var(--error)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.color = "var(--muted)";
                    }}
                  >
                    ↺ Reset Defaults
                  </button>
                </div>

                {/* Create LUT Form */}
                {showCreateForm && (
                  <div
                    className="mb-6 p-4 rounded-[6px]"
                    style={{
                      background: "var(--input-bg)",
                      border: "1px solid var(--how-border)",
                    }}
                  >
                    <p
                      className="text-[10px] tracking-[2px] uppercase font-medium mb-3"
                      style={{ color: "var(--amber)" }}
                    >
                      Create New LUT
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <div>
                        <label
                          className="block text-[10px] tracking-[1px] uppercase mb-1"
                          style={{ color: "var(--muted)" }}
                        >
                          LUT ID (lowercase, no spaces)
                        </label>
                        <input
                          type="text"
                          value={createForm.lutId}
                          onChange={(e) =>
                            setCreateForm((p) => ({
                              ...p,
                              lutId: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                            }))
                          }
                          placeholder="e.g. cyber-punk"
                          className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label
                          className="block text-[10px] tracking-[1px] uppercase mb-1"
                          style={{ color: "var(--muted)" }}
                        >
                          Name
                        </label>
                        <input
                          type="text"
                          value={createForm.name}
                          onChange={(e) =>
                            setCreateForm((p) => ({ ...p, name: e.target.value }))
                          }
                          placeholder="e.g. Cyber Punk"
                          className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <div>
                        <label
                          className="block text-[10px] tracking-[1px] uppercase mb-1"
                          style={{ color: "var(--muted)" }}
                        >
                          Tag
                        </label>
                        <input
                          type="text"
                          value={createForm.tag}
                          onChange={(e) =>
                            setCreateForm((p) => ({ ...p, tag: e.target.value }))
                          }
                          placeholder="e.g. Neon · Futuristic"
                          className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label
                          className="block text-[10px] tracking-[1px] uppercase mb-1"
                          style={{ color: "var(--muted)" }}
                        >
                          Icon (emoji)
                        </label>
                        <input
                          type="text"
                          value={createForm.icon}
                          onChange={(e) =>
                            setCreateForm((p) => ({
                              ...p,
                              icon: e.target.value,
                            }))
                          }
                          placeholder="e.g. 🤖"
                          className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div className="mb-2.5">
                      <label
                        className="block text-[10px] tracking-[1px] uppercase mb-1"
                        style={{ color: "var(--muted)" }}
                      >
                        Description
                      </label>
                      <textarea
                        value={createForm.description}
                        onChange={(e) =>
                          setCreateForm((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Describe the look and feel..."
                        className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none resize-none"
                        style={inputStyle}
                      />
                    </div>
                    <div className="mb-3">
                      <label
                        className="block text-[10px] tracking-[1px] uppercase mb-1"
                        style={{ color: "var(--muted)" }}
                      >
                        Gradient CSS
                      </label>
                      <input
                        type="text"
                        value={createForm.gradient}
                        onChange={(e) =>
                          setCreateForm((p) => ({
                            ...p,
                            gradient: e.target.value,
                          }))
                        }
                        placeholder="linear-gradient(135deg,#000000,#ffffff)"
                        className="w-full rounded-[4px] px-3 py-2 text-[11px] outline-none font-mono"
                        style={inputStyle}
                      />
                    </div>
                    <button
                      onClick={handleCreateLut}
                      className="w-full rounded-[4px] py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer border-none"
                      style={{
                        background: "var(--amber)",
                        color: "#080808",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#daa85a")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "var(--amber)")
                      }
                    >
                      Create LUT
                    </button>
                  </div>
                )}

                {/* LUT List */}
                {luts.map((lut) => {
                  const hasVideo = !!lut.videoUrl;
                  return (
                    <div
                      key={lut.id}
                      className="py-4"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <div
                          className="w-16 h-[46px] rounded-[3px] flex-shrink-0 overflow-hidden flex items-center justify-center text-[14px] relative"
                          style={{ background: lut.gradient }}
                        >
                          {hasVideo ? (
                            <video
                              src={lut.videoUrl!}
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{lut.icon}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-display text-[16px] truncate"
                            style={{ color: "var(--text)" }}
                          >
                            {lut.name}
                          </p>
                          <p
                            className="text-[10px] tracking-[1px] truncate"
                            style={{ color: "var(--muted)" }}
                          >
                            {lut.tag}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingLut !== lut.lutId && (
                            <button
                              onClick={() => startEdit(lut)}
                              className="rounded-[3px] px-3 py-1.5 text-[10px] font-medium tracking-[1px] uppercase cursor-pointer transition-colors duration-200 border"
                              style={{
                                borderColor: "var(--amber-dim)",
                                color: "var(--amber)",
                                background: "transparent",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "var(--amber)";
                                e.currentTarget.style.color = "#080808";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "var(--amber)";
                              }}
                            >
                              ✎ Edit
                            </button>
                          )}
                          <label
                            className="inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[10px] font-medium tracking-[1px] uppercase cursor-pointer transition-all duration-200 whitespace-nowrap border"
                            style={{
                              borderColor: "var(--amber-dim)",
                              color: "var(--amber)",
                              fontFamily: "'DM Sans', sans-serif",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--amber)";
                              e.currentTarget.style.color = "#080808";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "var(--amber)";
                            }}
                          >
                            ↑ Upload
                            <input
                              ref={(el) => {
                                fileInputRefs.current[lut.lutId] = el;
                              }}
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(lut.lutId, file);
                              }}
                            />
                          </label>
                          {hasVideo && (
                            <button
                              onClick={() =>
                                removeVideo.mutate({ lutId: lut.lutId })
                              }
                              className="rounded-[3px] px-2 py-1.5 text-[10px] font-medium cursor-pointer transition-colors duration-200 border"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--muted)",
                                background: "transparent",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "var(--error)";
                                e.currentTarget.style.color = "var(--error)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "var(--border)";
                                e.currentTarget.style.color = "var(--muted)";
                              }}
                              title="Delete video"
                            >
                              🗑
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete "${lut.name}"? This cannot be undone.`
                                )
                              )
                                deleteLut.mutate({ lutId: lut.lutId });
                            }}
                            className="rounded-[3px] px-2 py-1.5 text-[10px] font-medium cursor-pointer transition-colors duration-200 border"
                            style={{
                              borderColor: "var(--border)",
                              color: "#e05555",
                              background: "transparent",
                              fontFamily: "'DM Sans', sans-serif",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(224,85,85,0.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                            title="Delete LUT"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <p
                        className="text-[10px] tracking-[1px] mb-2"
                        style={{ color: hasVideo ? "#6ab87a" : "var(--muted)" }}
                      >
                        {hasVideo
                          ? `✓ Video uploaded (${lut.videoUrl?.split("/").pop()})`
                          : "No video uploaded"}
                      </p>

                      {/* Edit Form */}
                      {editingLut === lut.lutId && (
                        <div
                          className="mt-3 p-4 rounded-[6px]"
                          style={{
                            background: "var(--input-bg)",
                            border: "1px solid var(--how-border)",
                          }}
                        >
                          <p
                            className="text-[10px] tracking-[2px] uppercase font-medium mb-3"
                            style={{ color: "var(--amber)" }}
                          >
                            Edit LUT
                          </p>
                          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                            <div>
                              <label
                                className="block text-[10px] tracking-[1px] uppercase mb-1"
                                style={{ color: "var(--muted)" }}
                              >
                                Name
                              </label>
                              <input
                                type="text"
                                value={editForm.name || ""}
                                onChange={(e) =>
                                  setEditForm((p) => ({
                                    ...p,
                                    name: e.target.value,
                                  }))
                                }
                                className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none"
                                style={inputStyle}
                              />
                            </div>
                            <div>
                              <label
                                className="block text-[10px] tracking-[1px] uppercase mb-1"
                                style={{ color: "var(--muted)" }}
                              >
                                Tag
                              </label>
                              <input
                                type="text"
                                value={editForm.tag || ""}
                                onChange={(e) =>
                                  setEditForm((p) => ({
                                    ...p,
                                    tag: e.target.value,
                                  }))
                                }
                                className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none"
                                style={inputStyle}
                              />
                            </div>
                          </div>
                          <div className="mb-2.5">
                            <label
                              className="block text-[10px] tracking-[1px] uppercase mb-1"
                              style={{ color: "var(--muted)" }}
                            >
                              Description
                            </label>
                            <textarea
                              value={editForm.description || ""}
                              onChange={(e) =>
                                setEditForm((p) => ({
                                  ...p,
                                  description: e.target.value,
                                }))
                              }
                              rows={3}
                              className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none resize-none"
                              style={inputStyle}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 mb-4">
                            <div>
                              <label
                                className="block text-[10px] tracking-[1px] uppercase mb-1"
                                style={{ color: "var(--muted)" }}
                              >
                                Icon (emoji)
                              </label>
                              <input
                                type="text"
                                value={editForm.icon || ""}
                                onChange={(e) =>
                                  setEditForm((p) => ({
                                    ...p,
                                    icon: e.target.value,
                                  }))
                                }
                                className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none"
                                style={inputStyle}
                              />
                            </div>
                            <div>
                              <label
                                className="block text-[10px] tracking-[1px] uppercase mb-1"
                                style={{ color: "var(--muted)" }}
                              >
                                Gradient CSS
                              </label>
                              <input
                                type="text"
                                value={editForm.gradient || ""}
                                onChange={(e) =>
                                  setEditForm((p) => ({
                                    ...p,
                                    gradient: e.target.value,
                                  }))
                                }
                                className="w-full rounded-[4px] px-3 py-2 text-[11px] outline-none font-mono"
                                style={inputStyle}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveEdit}
                              className="flex-1 rounded-[4px] py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer border-none"
                              style={{
                                background: "var(--amber)",
                                color: "#080808",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background = "#daa85a")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "var(--amber)")
                              }
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex-1 rounded-[4px] py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer border"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--subtext)",
                                background: "transparent",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "var(--error)";
                                e.currentTarget.style.color = "var(--error)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "var(--border)";
                                e.currentTarget.style.color = "var(--subtext)";
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* ─── MEMBERS TAB ─── */}
            {activeTab === "members" && (
              <div className="mt-2">
                <p
                  className="text-[11px] tracking-[1px] mb-3"
                  style={{ color: "var(--amber)" }}
                >
                  {members.length} member{members.length !== 1 ? "s" : ""}{" "}
                  registered (from all devices)
                </p>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                  {members.length === 0 ? (
                    <p
                      className="text-[13px] text-center py-5 italic"
                      style={{ color: "var(--muted)" }}
                    >
                      No members yet. Be patient — they&apos;re coming. 🎞️
                    </p>
                  ) : (
                    [...members].reverse().map((u) => {
                      const initials = `${(u.firstName || "?")[0]}${(u.lastName || "")[0]}`.toUpperCase();
                      const date = u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—";
                      const authMethod = u.googleId ? "Google" : "Email";
                      return (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-[4px]"
                          style={{
                            border: "1px solid var(--border)",
                            background: "var(--input-bg)",
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-medium"
                            style={{
                              background: "var(--amber-dim)",
                              color: "#080808",
                              fontFamily: "'DM Sans', sans-serif",
                            }}
                          >
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[13px] font-normal"
                              style={{ color: "var(--text)" }}
                            >
                              {u.firstName} {u.lastName || ""}
                            </p>
                            <p
                              className="text-[11px]"
                              style={{ color: "var(--muted)" }}
                            >
                              {u.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <span
                                className="text-[10px] block"
                                style={{ color: "var(--muted)" }}
                              >
                                {date}
                              </span>
                              <span
                                className="text-[9px] tracking-[0.5px]"
                                style={{
                                  color: u.googleId ? "#4285F4" : "var(--amber-dim)",
                                }}
                              >
                                ✓ {authMethod}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Remove ${u.firstName} ${u.lastName || ""} (${u.email})? This cannot be undone.`
                                  )
                                ) {
                                  removeUser.mutate({ email: u.email });
                                }
                              }}
                              className="ml-1 rounded-[3px] px-2 py-1 text-[10px] font-medium tracking-[0.5px] uppercase cursor-pointer transition-all duration-200 border"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--muted)",
                                background: "transparent",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "var(--error)";
                                e.currentTarget.style.color = "var(--error)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "var(--border)";
                                e.currentTarget.style.color = "var(--muted)";
                              }}
                              title="Remove member"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ─── WAITLIST TAB ─── */}
            {activeTab === "waitlist" && (
              <div className="mt-2">
                <p
                  className="text-[11px] tracking-[1px] mb-3"
                  style={{ color: "var(--amber)" }}
                >
                  {waitlistEntries.length} early access signup
                  {waitlistEntries.length !== 1 ? "s" : ""} (from all
                  devices)
                </p>
                <p className="text-[12px] mb-4" style={{ color: "var(--subtext)" }}>
                  These are synced to the Supabase database and visible across all
                  devices.
                </p>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                  {waitlistEntries.length === 0 ? (
                    <p
                      className="text-[13px] text-center py-5 italic"
                      style={{ color: "var(--muted)" }}
                    >
                      No early access signups yet.
                    </p>
                  ) : (
                    [...waitlistEntries].reverse().map((entry, i) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[4px]"
                        style={{
                          border: "1px solid var(--border)",
                          background: "var(--input-bg)",
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-medium"
                          style={{
                            background: "var(--amber-dim)",
                            color: "#080808",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {waitlistEntries.length - i}
                        </div>
                        <p
                          className="text-[13px] font-normal flex-1"
                          style={{ color: "var(--text)" }}
                        >
                          {entry.email}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ─── HERO IMAGES TAB ─── */}
            {activeTab === "hero" && (
              <div className="mt-2">
                <p
                  className="text-[11px] tracking-[1px] mb-4"
                  style={{ color: "var(--amber)" }}
                >
                  Edit the two hero carousel images
                </p>
                <div className="flex flex-col gap-6">
                  {[1, 2].map((slot) => {
                    const img = heroImages.find((h) => h.slot === slot);
                    return (
                      <div
                        key={slot}
                        className="p-4 rounded-[6px]"
                        style={{
                          background: "var(--input-bg)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <p
                          className="text-[10px] tracking-[2px] uppercase font-medium mb-3"
                          style={{ color: "var(--amber)" }}
                        >
                          Slide {slot}
                        </p>

                        {/* Current image preview */}
                        <div
                          className="w-full h-[140px] rounded-[4px] mb-3 overflow-hidden flex items-center justify-center"
                          style={{
                            background: img
                              ? "transparent"
                              : "var(--card-bg)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {img?.imageUrl ? (
                            <img
                              src={img.imageUrl}
                              alt={`Slide ${slot}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span
                              className="text-[12px]"
                              style={{ color: "var(--muted)" }}
                            >
                              No image set — upload below
                            </span>
                          )}
                        </div>

                        {/* Upload */}
                        <label
                          className="flex items-center justify-center gap-2 w-full rounded-[4px] px-3 py-2.5 text-[11px] font-medium tracking-[1px] uppercase cursor-pointer transition-all duration-200 border mb-2"
                          style={{
                            borderColor: "var(--amber-dim)",
                            color: "var(--amber)",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--amber)";
                            e.currentTarget.style.color = "#080808";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "var(--amber)";
                          }}
                        >
                          📷 Upload New Image
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleHeroUpload(slot, file);
                            }}
                          />
                        </label>

                        {img?.imageUrl && (
                          <p
                            className="text-[10px] break-all"
                            style={{ color: "var(--muted)" }}
                          >
                            {img.imageUrl}
                          </p>
                        )}
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
