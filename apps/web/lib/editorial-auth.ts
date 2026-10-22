import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { editorialConfig } from './editorial-config';

export async function editorialClient(writable = false) {
  const config = editorialConfig();
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    db: { schema: 'academy' },
    cookieOptions: { name: 'da-academy-auth', httpOnly: true, sameSite: 'lax', secure: config.secure, path: '/' },
    cookies: { getAll: () => jar.getAll(), ...(writable ? { setAll: (updates: { name: string; value: string; options: Parameters<typeof jar.set>[2] }[]) => {
      for (const { name, value, options } of updates) jar.set(name, value, options);
    } } : {}) }
  });
}
export async function requireMember(write = false) {
  const client = await editorialClient(write);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect('/login');
  const { data: member, error: membershipError } = await client.from('editor_members').select('role').eq('user_id', user.id).maybeSingle();
  if (membershipError) throw new Error('Membership lookup failed');
  if (!member || !['editor', 'reviewer'].includes(member.role)) redirect('/login?notice=access');
  if (write && member.role !== 'editor') throw new Error('Editor role required');
  return { client, user, role: member.role as 'editor' | 'reviewer' };
}
