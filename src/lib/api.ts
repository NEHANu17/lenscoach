// ══════════════════════════════════════════
//  DIRECT tRPC API CLIENT
//  For calling tRPC endpoints outside React hooks
// ══════════════════════════════════════════

const API_BASE = "/api/trpc";

async function trpcFetch(path: string, input?: unknown) {
  const pin = localStorage.getItem("lc_admin_pin") ?? "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (pin) headers["x-admin-pin"] = pin;

  if (input !== undefined) {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ json: input }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error?.message ?? `API error: ${res.status}`);
    }
    return data.result.data;
  } else {
    const res = await fetch(`${API_BASE}/${path}`, { headers });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error?.message ?? `API error: ${res.status}`);
    }
    return data.result.data;
  }
}

// ── Users ──
export async function apiGetUsers() {
  return trpcFetch("user.list");
}

export async function apiCreateUser(user: {
  firstName: string;
  lastName?: string;
  email: string;
  googleId?: string;
  googleAvatar?: string;
  pwHash?: string;
  memberNumber: number;
  verified?: boolean;
}) {
  return trpcFetch("user.create", user);
}

export async function apiFindUser(email: string) {
  return trpcFetch("user.findByEmail", { email });
}

export async function apiRemoveUser(email: string) {
  return trpcFetch("user.remove", { email });
}

export async function apiUserCount() {
  return trpcFetch("user.count");
}

// ── LUTs ──
export async function apiGetLuts() {
  return trpcFetch("lut.list");
}

export async function apiCreateLut(lut: {
  lutId: string;
  name: string;
  tag: string;
  description: string;
  icon: string;
  gradient: string;
}) {
  return trpcFetch("lut.create", lut);
}

export async function apiUpdateLut(
  lutId: string,
  updates: Partial<{
    name: string;
    tag: string;
    description: string;
    icon: string;
    gradient: string;
  }>
) {
  return trpcFetch("lut.update", { lutId, ...updates });
}

export async function apiDeleteLut(lutId: string) {
  return trpcFetch("lut.delete", { lutId });
}

export async function apiResetLuts() {
  return trpcFetch("lut.resetDefaults");
}

export async function apiUploadVideo(
  lutId: string,
  dataUrl: string,
  fileName: string
) {
  return trpcFetch("lut.uploadVideo", { lutId, dataUrl, fileName });
}

export async function apiRemoveVideo(lutId: string) {
  return trpcFetch("lut.removeVideo", { lutId });
}

// ── Waitlist ──
export async function apiGetWaitlist() {
  return trpcFetch("waitlist.list");
}

export async function apiSignupWaitlist(email: string) {
  return trpcFetch("waitlist.signup", { email });
}

export async function apiWaitlistCount() {
  return trpcFetch("waitlist.count");
}

// ── Hero Images ──
export async function apiGetHeroImages() {
  return trpcFetch("hero.list");
}

export async function apiUpdateHeroImage(input: {
  slot: number;
  imageUrl?: string;
  caption?: string;
  base64Data?: string;
}) {
  return trpcFetch("hero.update", input);
}
