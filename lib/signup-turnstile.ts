/** Optional, server-side Cloudflare Turnstile verification for password signup.
 * Enable only after the signup UI sends turnstileToken and the secret is configured.
 * Do not log tokens, email addresses, or IP addresses.
 */
export async function verifySignupTurnstile(token: unknown): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.REQUIRE_SIGNUP_TURNSTILE !== '1';
  if (typeof token !== 'string' || token.length < 1 || token.length > 2048) return false;

  try {
    const form = new URLSearchParams({ secret, response: token });
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
