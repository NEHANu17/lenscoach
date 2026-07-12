// ══════════════════════════════════════════
//  CONFIGURATION
// ══════════════════════════════════════════

// ─── GOOGLE OAUTH ───
export const GOOGLE_CLIENT_ID: string = '300645345570-1k4qessht86ctlkdilebejukdbvrdvgp.apps.googleusercontent.com';

// ─── EMAILJS (for sending verification emails via Gmail) ───
export const EMAILJS_SERVICE_ID: string = 'service_4killrb';
export const EMAILJS_TEMPLATE_ID: string = 'template_4h600wr';
export const EMAILJS_PUBLIC_KEY: string = 'CZINymvAbn-nRS707';

// ─── HELPERS ───
export function hasGoogleConfig(): boolean {
  return GOOGLE_CLIENT_ID.length > 10;
}
