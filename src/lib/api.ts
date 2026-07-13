// ══════════════════════════════════════════
//  SIMPLE API CLIENT (direct fetch to Express)
//  No tRPC, no complex types — just REST
// ══════════════════════════════════════════

const API = "/api";

async function get(path: string) {
  const pin = localStorage.getItem("lc_admin_pin") ?? "";
  const res = await fetch(`${API}${path}`, {
    headers: pin ? { "x-admin-pin": pin } : {},
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post(path: string, body: Record<string, unknown>) {
  const pin = localStorage.getItem("lc_admin_pin") ?? "";
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(pin ? { "x-admin-pin": pin } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function del(path: string, body: Record<string, unknown>) {
  const pin = localStorage.getItem("lc_admin_pin") ?? "";
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(pin ? { "x-admin-pin": pin } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
  return res.json();
}

// ── Users ──
export const apiUsers = {
  list: () => get("/users"),
  count: () => get("/users/count"),
  create: (user: Record<string, unknown>) => post("/users", user),
  remove: (email: string) => del("/users", { email }),
  findByEmail: (email: string) => get(`/users/find?email=${encodeURIComponent(email)}`),
};

// ── LUTs ──
export const apiLuts = {
  list: () => get("/luts"),
  create: (lut: Record<string, unknown>) => post("/luts", lut),
  update: (lutId: string, fields: Record<string, unknown>) => post("/luts/update", { lutId, ...fields }),
  delete: (lutId: string) => del("/luts", { lutId }),
  uploadVideo: (lutId: string, dataUrl: string, fileName: string) => post("/luts/video", { lutId, dataUrl, fileName }),
  removeVideo: (lutId: string) => del("/luts/video", { lutId }),
};

// ── Waitlist ──
export const apiWaitlist = {
  list: () => get("/waitlist"),
  signup: (email: string) => post("/waitlist", { email }),
};

// ── Hero Images ──
export const apiHero = {
  list: () => get("/hero"),
  update: (slot: number, base64Data: string) => post("/hero", { slot, base64Data }),
};
