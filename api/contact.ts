// Vercel Function for the Connect page's "Send a note" form (POST /api/contact).
// Lives in the root api/ directory, which Vercel deploys as a function next to
// the static Astro build, so the site itself stays fully static.

// Server-only config, read at request time so rotating a key in Vercel
// doesn't need a rebuild. See AGENTS.md "Contact form" for what each one is.
const env = (name: string) => process.env[name]?.trim() ?? '';

const TURNSTILE_ACTION = 'contact';
const LIMITS = { name: 100, email: 200, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const field = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = env('TURNSTILE_SECRET');
  const hostnames = new Set(
    env('TURNSTILE_HOSTNAMES').split(',').map((h) => h.trim()).filter(Boolean),
  );
  if (!secret || hostnames.size === 0) return false;
  if (token.length === 0 || token.length > 2048) return false;

  let result: any;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ secret, response: token, ...(ip && { remoteip: ip }) }),
    });
    if (!res.ok) return false;
    result = await res.json();
  } catch {
    return false; // fail closed
  }

  if (result?.success !== true || !hostnames.has(result.hostname)) return false;

  // Cloudflare's test keys return no action. Accept that only outside
  // production, so local dev and preview deploys can use the test keys.
  const isTestKey = result.metadata?.result_with_testing_key === true;
  if (isTestKey) return process.env.VERCEL_ENV !== 'production';
  return result.action === TURNSTILE_ACTION;
}

async function sendEmail(name: string, email: string, message: string): Promise<boolean> {
  const apiKey = env('RESEND_API_KEY');
  const from = env('CONTACT_FROM');
  const to = env('CONTACT_TO');
  if (!apiKey || !from || !to) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `patcox.net contact: ${name}`,
        text: `From: ${name} <${email}>\n\n${message}\n`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, error: 'Something went wrong. Please try again.' });
  }

  // Honeypot: a hidden field people never see. Bots that fill it get a fake
  // success so they don't learn to skip it.
  if (field(form, 'website')) return json(200, { ok: true });

  const name = field(form, 'name');
  const email = field(form, 'email');
  const message = field(form, 'message');

  if (!name || !email || !message) {
    return json(400, { ok: false, error: 'Please fill in your name, email and message.' });
  }
  if (name.length > LIMITS.name || email.length > LIMITS.email || message.length > LIMITS.message) {
    return json(400, { ok: false, error: 'That message is a bit long. Please trim it down.' });
  }
  if (!EMAIL_RE.test(email)) {
    return json(400, { ok: false, error: 'That email address doesn’t look right.' });
  }

  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';
  if (!(await verifyTurnstile(field(form, 'cf-turnstile-response'), ip))) {
    return json(403, { ok: false, error: 'Couldn’t verify you’re human. Please try again.' });
  }

  if (!(await sendEmail(name, email, message))) {
    console.error('contact: email send failed');
    return json(502, { ok: false, error: 'Your message didn’t send. Please try again in a bit.' });
  }

  return json(200, { ok: true });
}
