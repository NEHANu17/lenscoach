// ══════════════════════════════════════════
//  AUTHENTICATION UTILITIES
//  Session management + Email + SHA-256
//  Data storage is now via tRPC → Supabase
// ══════════════════════════════════════════

import emailjs from "@emailjs/browser";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY,
} from "./config";

const SESSION_KEY = "lc_session";
const PENDING_KEY = "lc_pending_verification";
const LOGOUT_KEY = "lc_logout";

// ── Event name for cross-tab kick-out ──
export const KICKOUT_EVENT = "lc_kickout";

export interface Session {
  email: string;
  firstName: string;
  googleAvatar?: string;
  at: number;
}

export interface PendingUser {
  firstName: string;
  lastName: string;
  email: string;
  pwHash: string;
  code: string;
  createdAt: number;
}

// ── SHA-256 ──
export async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Session (localStorage — who is logged in) ──
export function getSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function setSession(user: {
  email: string;
  firstName: string;
  googleAvatar?: string;
}): void {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      email: user.email,
      firstName: user.firstName,
      googleAvatar: user.googleAvatar,
      at: Date.now(),
    })
  );
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ── Logout flag (show login form on return) ──
export function setLogoutFlag(): void {
  localStorage.setItem(LOGOUT_KEY, "1");
}

export function clearLogoutFlag(): void {
  localStorage.removeItem(LOGOUT_KEY);
}

export function hasLogoutFlag(): boolean {
  return localStorage.getItem(LOGOUT_KEY) === "1";
}

// ── Email Verification ──
export function getPendingUser(): PendingUser | null {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
  } catch {
    return null;
  }
}

export function setPendingUser(user: PendingUser): void {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(user));
}

export function clearPendingUser(): void {
  sessionStorage.removeItem(PENDING_KEY);
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── EmailJS ──
export interface EmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send verification OTP via EmailJS
 * Template variables: {{email}}, {{passcode}}, {{time}}
 */
export async function sendVerificationEmail(
  toEmail: string,
  _toName: string,
  code: string
): Promise<EmailResult> {
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString(
    "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  );

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      { email: toEmail, passcode: code, time: expiry },
      EMAILJS_PUBLIC_KEY
    );
    return { success: true };
  } catch (error: unknown) {
    const errObj = error as Record<string, unknown>;
    let errMsg =
      error instanceof Error ? error.message : String(error);
    if (errObj?.text) errMsg = String(errObj.text);
    return { success: false, error: errMsg };
  }
}

/**
 * Send early access signup notification to admin
 */
export async function sendEarlyAccessEmail(
  subscriberEmail: string
): Promise<EmailResult> {
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        email: "nehan.apex@gmail.com",
        passcode: subscriberEmail,
        time: new Date().toLocaleString("en-US"),
      },
      EMAILJS_PUBLIC_KEY
    );
    return { success: true };
  } catch (error: unknown) {
    const errObj = error as Record<string, unknown>;
    let errMsg =
      error instanceof Error ? error.message : String(error);
    if (errObj?.text) errMsg = String(errObj.text);
    return { success: false, error: errMsg };
  }
}

// ── Sign Out: clear session + fire kickout (DB removal done via tRPC) ──
export function signOutUser(email: string): void {
  clearSession();
  fireKickoutEvent(email);
}

// ── Kick-out: fire event across tabs ──
export function fireKickoutEvent(email: string): void {
  localStorage.setItem(KICKOUT_EVENT, email);
  localStorage.removeItem(KICKOUT_EVENT);
}

// ── Admin PIN ──
export function setAdminPin(pin: string): void {
  localStorage.setItem("lc_admin_pin", pin);
}

export function clearAdminPin(): void {
  localStorage.removeItem("lc_admin_pin");
}

// ── Legacy localStorage data migration ──
export function getLegacyUsers(): Array<{
  firstName: string;
  lastName?: string;
  email: string;
  googleId?: string;
  googleAvatar?: string;
  pwHash?: string;
  joinedAt?: string;
  memberNumber?: number;
  verified?: boolean;
}> {
  try {
    return JSON.parse(localStorage.getItem("lc_users") || "[]");
  } catch {
    return [];
  }
}

export function getLegacyWaitlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem("lc_waitlist") || "[]");
  } catch {
    return [];
  }
}

export function clearLegacyData(): void {
  localStorage.removeItem("lc_users");
  localStorage.removeItem("lc_waitlist");
  localStorage.removeItem("lc_luts");
  localStorage.removeItem("lc_videos");
}

// ── Google GIS types ──
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: Record<string, unknown>) => void;
            error_callback?: (error: unknown) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}
