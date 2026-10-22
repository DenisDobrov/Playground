'use server';
import { redirect } from 'next/navigation';
import { editorialClient } from '../../../lib/editorial-auth';
import { editorialConfig, invitedEmail } from '../../../lib/editorial-config';

export async function requestLogin(form: FormData) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const config = editorialConfig();
  if (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && invitedEmail(email)) {
    const client = await editorialClient(true);
    // Existing accounts only; no automatic signup or changes to the shared project's Auth settings.
    await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${config.origin}/auth/callback` } });
  }
  redirect('/login?notice=sent'); // Same response for invited, unknown and rate-limited addresses.
}
export async function signOut() {
  const client = await editorialClient(true);
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new Error('Could not sign out; retry');
  redirect('/login');
}
