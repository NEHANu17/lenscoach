// ══════════════════════════════════════════
//  EMAIL VALIDATION
//  Checks if an email address is real/deliverable
// ══════════════════════════════════════════

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
}

// List of known disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com',
  'yopmail.com', 'sharklasers.com', 'getairmail.com', '10minutemail.com',
  'burnermail.io', 'temp-mail.org', 'fakeemail.com', 'emailfake.com',
  'tempinbox.com', 'mailnesia.com', 'tempmailaddress.com',
]);

/**
 * Validates an email address by checking:
 * 1. Format (regex)
 * 2. Domain has MX records (via DNS-over-HTTPS)
 * 3. Not a known disposable email domain
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  // 1. Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Invalid email format.' };
  }

  const domain = email.split('@')[1].toLowerCase();

  // 2. Check against disposable domains
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'Disposable email addresses are not allowed.' };
  }

  // 3. Check domain has MX records via Cloudflare DNS-over-HTTPS
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`,
      {
        headers: { Accept: 'application/dns-json' },
      }
    );
    const data = await response.json();

    // Check if MX records exist
    const hasMX = data.Answer && data.Answer.some((r: Record<string, unknown>) => r.type === 15);
    if (!hasMX) {
      return { valid: false, reason: `The domain "${domain}" does not accept emails.` };
    }
  } catch {
    // If DNS check fails, still allow (network issues) but flag it
    console.warn('Could not validate email domain via DNS');
  }

  return { valid: true };
}
