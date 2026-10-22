import { afterEach, describe, expect, it, vi } from 'vitest';
import { editorialConfig, editorialEnabled, invitedEmail } from '../apps/web/lib/editorial-config';
const anon = `header.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`;
function configure() {
  vi.stubEnv('EDITORIAL_MODE', 'live'); vi.stubEnv('EDITORIAL_SUPABASE_URL', 'http://127.0.0.1:56321');
  vi.stubEnv('EDITORIAL_SUPABASE_PUBLISHABLE_KEY', anon); vi.stubEnv('EDITORIAL_SITE_URL', 'http://localhost:3000');
}
describe('editorial environment boundary', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('stays in demo unless live mode is explicit', () => {
    vi.stubEnv('EDITORIAL_MODE', ''); expect(editorialEnabled()).toBe(false); expect(() => editorialConfig()).toThrow('disabled');
  });
  it('allows local development and production HTTPS', () => {
    configure(); expect(editorialConfig().secure).toBe(false);
    vi.stubEnv('EDITORIAL_SITE_URL', 'https://dobrov.org'); expect(editorialConfig().secure).toBe(true);
  });
  it('rejects a secret key accidentally used as a public Auth key', () => {
    configure(); vi.stubEnv('EDITORIAL_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_test'); expect(() => editorialConfig()).toThrow('publishable');
    vi.stubEnv('EDITORIAL_SUPABASE_PUBLISHABLE_KEY', `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`);
    expect(() => editorialConfig()).toThrow('publishable');
  });
  it('rejects insecure remote origins and redirect paths', () => {
    configure(); vi.stubEnv('EDITORIAL_SITE_URL', 'http://example.com'); expect(() => editorialConfig()).toThrow('origin');
    vi.stubEnv('EDITORIAL_SITE_URL', 'https://dobrov.org/redirect'); expect(() => editorialConfig()).toThrow('origin');
  });
  it('does not send login mail to arbitrary legacy accounts', () => {
    vi.stubEnv('EDITORIAL_EMAIL_ALLOWLIST', ''); expect(invitedEmail('unknown@example.test')).toBe(false);
    vi.stubEnv('EDITORIAL_EMAIL_ALLOWLIST', ' editor@example.test '); expect(invitedEmail('EDITOR@example.test')).toBe(true);
    expect(invitedEmail('editor@example.test.evil')).toBe(false);
  });
});
