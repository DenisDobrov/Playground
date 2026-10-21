/** Only the user-selected existing project is eligible for remote installation. */
export function validateRemoteTarget(rawUrl, projectRef) {
  if (!rawUrl) throw new Error('Set SUPABASE_DB_URL in local .env (Supabase > Connect). No cloud changes made.');
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error('Invalid database URL'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.password) throw new Error('Use a PostgreSQL connection string with a password');
  const username = decodeURIComponent(parsed.username);
  const direct = parsed.hostname === `db.${projectRef}.supabase.co` && username === 'postgres';
  const pooler = parsed.hostname.endsWith('.pooler.supabase.com') && username === `postgres.${projectRef}` && (parsed.port === '' || parsed.port === '5432');
  if (!direct && !pooler) throw new Error('Database connection does not match the selected Supabase project/session pooler');
  // pg connection-string ssl flags must not silently override verified TLS settings.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(key);
  return parsed.toString();
}
