export function editorialEnabled() { return process.env.EDITORIAL_MODE === 'live'; }
export function editorialConfig() {
  if (!editorialEnabled()) throw new Error('Live editorial mode is disabled');
  const url = process.env.EDITORIAL_SUPABASE_URL;
  const key = process.env.EDITORIAL_SUPABASE_PUBLISHABLE_KEY;
  const origin = process.env.EDITORIAL_SITE_URL;
  if (!url || !key || !origin) throw new Error('Editorial environment is incomplete');
  const site = new URL(origin);
  const api = new URL(url);
  const local = (u: URL) => ['localhost', '127.0.0.1'].includes(u.hostname);
  if ((site.protocol !== 'https:' && !(local(site) && site.protocol === 'http:')) || site.origin !== origin || site.username || site.password
    || (api.protocol !== 'https:' && !(local(api) && api.protocol === 'http:'))) throw new Error('Invalid editorial origin');
  // Reject accidentally pasted privileged keys, including legacy JWT service-role keys.
  if (key.startsWith('sb_secret_')) throw new Error('Use a publishable key for web Auth');
  if (!key.startsWith('sb_publishable_')) {
    try { if (JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon') throw new Error(); }
    catch { throw new Error('Use a publishable or anon key for web Auth'); }
  }
  return { url, key, origin, secure: site.protocol === 'https:' };
}
export function invitedEmail(email: string) {
  const allowed = (process.env.EDITORIAL_EMAIL_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
