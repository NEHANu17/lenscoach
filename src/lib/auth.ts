// ══════════════════════════════════════════
//  AUTHENTICATION UTILITIES
// ══════════════════════════════════════════

import emailjs from '@emailjs/browser';
import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } from './config';

const DB_KEY = 'lc_users';
const SESSION_KEY = 'lc_session'; // NOW uses localStorage (was sessionStorage)
const PENDING_KEY = 'lc_pending_verification';
const LUTS_KEY = 'lc_luts';
const WAITLIST_KEY = 'lc_waitlist';
const VIDEOS_KEY = 'lc_videos'; // NEW: persist video data URLs

// ── Event name for cross-tab kick-out ──
export const KICKOUT_EVENT = 'lc_kickout';

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  pwHash?: string;
  googleId?: string;
  googleAvatar?: string;
  joinedAt: string;
  memberNumber: number;
  verified: boolean;
}

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

export interface LutData {
  id: string;
  name: string;
  tag: string;
  desc: string;
  icon: string;
  gradient: string;
}

export interface VideoEntry {
  lutId: string;
  dataUrl: string;
  fileName: string;
  uploadedAt: string;
}

export const DEFAULT_LUTS: LutData[] = [
  { id: 'analog', name: 'Analog Road Trip', tag: 'Warm · Nostalgic', desc: 'The warm, slightly faded look of a road trip shot on old film. Golden tones, soft shadows, summer in every frame.', icon: '🎞️', gradient: 'linear-gradient(135deg,#2a1800,#9a6828,#e8c878)' },
  { id: 'tokyo', name: 'Tokyonite', tag: 'Neon · Cinematic', desc: 'Deep shadows, electric purples and pinks. The look of a city that never sleeps, shot at 2am in the rain.', icon: '🌸', gradient: 'linear-gradient(135deg,#0a0520,#3a1060,#ff6b9d)' },
  { id: 'y2k', name: 'Y2K Mall Footage', tag: 'Faded · Dreamy', desc: 'Washed-out blues and milky whites. The exact look of early 2000s disposable cameras and mall security footage.', icon: '📼', gradient: 'linear-gradient(135deg,#c4d8e8,#78aac8,#a0c0d8)' },
  { id: 'vhs', name: 'VHS Summer', tag: 'Grainy · Vintage', desc: 'Heavy grain, muted colors, that unmistakeable 90s home video warmth. Nostalgic before you even press play.', icon: '📹', gradient: 'linear-gradient(135deg,#080820,#203050,#405870)' },
  { id: 'golden', name: 'Golden Hour', tag: 'Warm · Glowing', desc: 'Rich ambers and honey tones. That 7pm light that makes everything look like a cinematic film still.', icon: '🌅', gradient: 'linear-gradient(135deg,#100800,#8a4800,#ffe090)' },
  { id: 'disney', name: '2000s Disney', tag: 'Soft · Pastel', desc: 'Soft pinks, lifted blacks, a gentle dreamlike quality. The exact palette of early Disney Channel original movies.', icon: '✨', gradient: 'linear-gradient(135deg,#ffd4e8,#ff88a8,#e06888)' },
];

export async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getUsers(): User[] {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); }
  catch { return []; }
}

export function saveUser(user: User): boolean {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === user.email.toLowerCase())) return false;
  users.push(user);
  localStorage.setItem(DB_KEY, JSON.stringify(users));
  return true;
}

export function updateUser(email: string, updates: Partial<User>): void {
  const users = getUsers();
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...updates };
    localStorage.setItem(DB_KEY, JSON.stringify(users));
  }
}

export function findUser(email: string): User | null {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

// ── Remove user + fire kick-out event across tabs ──
export function removeUser(email: string): boolean {
  const users = getUsers();
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return false;
  users.splice(idx, 1);
  localStorage.setItem(DB_KEY, JSON.stringify(users));
  // Fire kick-out event so other tabs listening for this email know to log out
  localStorage.setItem(KICKOUT_EVENT, email);
  localStorage.removeItem(KICKOUT_EVENT);
  return true;
}

// ── Check if current session user is still in the database ──
export function isSessionValid(): boolean {
  const session = getSession();
  if (!session) return false;
  return !!findUser(session.email);
}

// ── Sign Out: remove user from DB + clear session (permanent) ──
export function signOutUser(email: string): void {
  removeUser(email);
  clearSession();
}

// ── Session: NOW in localStorage so it persists across visits ──
export function getSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

export function setSession(user: User): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    email: user.email,
    firstName: user.firstName,
    googleAvatar: user.googleAvatar,
    at: Date.now(),
  }));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ── Email Verification ──
export function getPendingUser(): PendingUser | null {
  try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); }
  catch { return null; }
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

// ── LUT Data ──
export function getLuts(): LutData[] {
  try {
    const stored = localStorage.getItem(LUTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  localStorage.setItem(LUTS_KEY, JSON.stringify(DEFAULT_LUTS));
  return [...DEFAULT_LUTS];
}

export function saveLuts(luts: LutData[]): void {
  localStorage.setItem(LUTS_KEY, JSON.stringify(luts));
}

export function updateLut(lutId: string, updates: Partial<LutData>): void {
  const luts = getLuts();
  const idx = luts.findIndex(l => l.id === lutId);
  if (idx !== -1) {
    luts[idx] = { ...luts[idx], ...updates };
    saveLuts(luts);
  }
}

// ── Video Persistence via IndexedDB ──
// IndexedDB handles large files (50MB+) that exceed localStorage's ~5-10MB quota.
// The API remains synchronous for compatibility; internal ops are async.
import {
  saveVideoDB,
  removeVideoDB,
} from './videoStore';

/** In-memory cache so reads are synchronous for React state */
let videoCache: Record<string, VideoEntry> | null = null;

export function getVideos(): Record<string, VideoEntry> {
  // Return cache if available; otherwise try legacy localStorage
  if (videoCache) return videoCache;
  try {
    const legacy = JSON.parse(localStorage.getItem(VIDEOS_KEY) || '{}');
    return legacy;
  } catch { return {}; }
}

export function saveVideo(lutId: string, dataUrl: string, fileName: string): void {
  const entry: VideoEntry = { lutId, dataUrl, fileName, uploadedAt: new Date().toISOString() };
  // Update cache immediately for synchronous reads
  if (!videoCache) videoCache = {};
  videoCache[lutId] = entry;
  // Persist to IndexedDB asynchronously
  saveVideoDB(lutId, dataUrl, fileName).catch(() => {
    // Fallback: if IndexedDB fails, try localStorage (for small videos)
    try {
      const videos = getVideos();
      videos[lutId] = entry;
      localStorage.setItem(VIDEOS_KEY, JSON.stringify(videos));
    } catch { /* storage full */ }
  });
}

export function removeVideo(lutId: string): void {
  if (videoCache) delete videoCache[lutId];
  // Remove from IndexedDB
  removeVideoDB(lutId).catch(() => {
    // Fallback: legacy localStorage
    try {
      const videos = getVideos();
      delete videos[lutId];
      localStorage.setItem(VIDEOS_KEY, JSON.stringify(videos));
    } catch { /* ignore */ }
  });
}

export function getVideoForLut(lutId: string): VideoEntry | null {
  return getVideos()[lutId] || null;
}

// ── Waitlist / Early Access ──
export function getWaitlist(): string[] {
  try { return JSON.parse(localStorage.getItem(WAITLIST_KEY) || '[]'); }
  catch { return []; }
}

export function addToWaitlist(email: string): boolean {
  const list = getWaitlist();
  if (list.includes(email.toLowerCase())) return false;
  list.push(email.toLowerCase());
  localStorage.setItem(WAITLIST_KEY, JSON.stringify(list));
  return true;
}

export function isOnWaitlist(email: string): boolean {
  return getWaitlist().includes(email.toLowerCase());
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
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

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
    let errMsg = error instanceof Error ? error.message : String(error);
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
        email: 'nehan.apex@gmail.com',
        passcode: subscriberEmail,
        time: new Date().toLocaleString('en-US'),
      },
      EMAILJS_PUBLIC_KEY
    );
    return { success: true };
  } catch (error: unknown) {
    const errObj = error as Record<string, unknown>;
    let errMsg = error instanceof Error ? error.message : String(error);
    if (errObj?.text) errMsg = String(errObj.text);
    return { success: false, error: errMsg };
  }
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
