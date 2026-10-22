'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { canonicalSourceId } from '@science/sources';
import { requireMember } from '../../../lib/editorial-auth';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function createCandidate(form: FormData) {
  const { client } = await requireMember(true);
  const title = String(form.get('title') || '').trim();
  const domain = String(form.get('domain') || '');
  let canonical: string;
  try { canonical = canonicalSourceId(String(form.get('identifier') || '')); }
  catch { redirect('/editorial?notice=invalid'); }
  if (title.length < 3 || title.length > 500 || canonical.length > 500 || !['ai', 'physics'].includes(domain)) redirect('/editorial?notice=invalid');
  const { error } = await client.rpc('create_candidate', { p_canonical_id: canonical, p_title: title, p_domain: domain });
  if (error) redirect('/editorial?notice=failed');
  revalidatePath('/editorial'); redirect('/editorial?notice=saved');
}
export async function recordSelection(form: FormData) {
  const { client } = await requireMember(true);
  const storyId = String(form.get('storyId') || ''); const requestId = String(form.get('requestId') || '');
  const decision = String(form.get('decision') || ''); const reason = String(form.get('reason') || '').trim();
  const version = Number(form.get('version'));
  if (!uuid.test(storyId) || !uuid.test(requestId) || !['select', 'reject', 'hold', 'revise'].includes(decision) || reason.length < 3 || reason.length > 2000 || !Number.isSafeInteger(version) || version < 0) redirect('/editorial?notice=invalid');
  const { error } = await client.rpc('record_selection', { p_story_id: storyId, p_decision: decision, p_reason: reason, p_expected_version: version, p_request_id: requestId });
  if (error) redirect(`/editorial?notice=${error.code === '40001' ? 'conflict' : 'failed'}`);
  revalidatePath('/editorial'); redirect('/editorial?notice=saved');
}
