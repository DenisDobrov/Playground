import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { validateRemoteTarget } from '../scripts/database-target.mjs';

const ref = 'upwrplsgunjanragbggb';
describe('existing Supabase project adoption', () => {
  it('accepts the selected project direct connection', () => {
    expect(validateRemoteTarget(`postgresql://postgres:test@db.${ref}.supabase.co:5432/postgres`, ref)).toContain(ref);
  });
  it('accepts its session pooler', () => {
    expect(validateRemoteTarget(`postgresql://postgres.${ref}:test@aws-0-us-east-2.pooler.supabase.com:5432/postgres`, ref)).toContain(ref);
  });
  it('rejects another project', () => {
    expect(() => validateRemoteTarget('postgresql://postgres:test@db.wrong.supabase.co/postgres', ref)).toThrow('does not match');
  });
  it('rejects a local/other-app connection for remote apply', () => {
    expect(() => validateRemoteTarget('postgresql://postgres:test@127.0.0.1:54322/postgres', ref)).toThrow();
  });
  it('rejects transaction pooling for advisory transaction installation', () => {
    expect(() => validateRemoteTarget(`postgresql://postgres.${ref}:test@aws-0-us-east-2.pooler.supabase.com:6543/postgres`, ref)).toThrow();
  });
  it('does not allow URL options to downgrade TLS', () => {
    expect(validateRemoteTarget(`postgresql://postgres:test@db.${ref}.supabase.co/postgres?sslmode=no-verify`, ref)).not.toContain('sslmode');
  });
  it('contains no legacy public DDL or project-wide auth configuration in application migrations', () => {
    for (const file of readdirSync('supabase/migrations')) {
      const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
      expect(sql).not.toMatch(/(?:create|alter|drop)\s+(?:table|function|schema)\s+(?:public|auth)\./i);
      expect(sql).not.toMatch(/drop\s+schema|truncate|delete\s+from\s+(?:public|auth)\./i);
    }
  });
});
