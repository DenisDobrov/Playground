/** Local-only HTTP integration: real Next Server Actions + Supabase Auth, RLS and Mailpit. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import pg from 'pg';

const origin = 'http://localhost:3000';
const api = 'http://127.0.0.1:56321';
const statusCommand = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', windowsHide: true });
if (statusCommand.status !== 0) throw new Error('Local Supabase is required');
const status = JSON.parse(statusCommand.stdout);
assert.equal(status.API_URL, api, 'Only the local Academy project is allowed');
const publicKey = status.ANON_KEY;
const admin = createClient(api, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:56322/postgres' });
const emails = ['editor@academy.example.test', 'reviewer@academy.example.test', 'outsider@academy.example.test'];
const userIds: string[] = [];
const paginationIds: string[] = [];
const budgetMonth='2095-01-01';
let budgetFixture=false;
const canonical = `doi:10.9999/academy-e2e-${randomUUID()}`;
const unescapeHtml = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#x27;', "'");
class Browser {
  cookies = new Map<string, string>();
  expireStoredSession() {
    const names = [...this.cookies.keys()].filter(n => n === 'da-academy-auth' || /^da-academy-auth\.\d+$/.test(n)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const encoded = names.map(n => this.cookies.get(n)).join('');
    assert.ok(encoded.startsWith('base64-'), 'SSR session cookie encoding');
    const session = JSON.parse(Buffer.from(encoded.slice(7), 'base64url').toString());
    session.expires_at = 1; // Keep real Auth-issued tokens; force Proxy to exercise refresh.
    const next = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
    names.forEach(n => this.cookies.delete(n));
    if (next.length <= 3180) this.cookies.set('da-academy-auth', next);
    else for (let i = 0; i * 3180 < next.length; i++) this.cookies.set(`da-academy-auth.${i}`, next.slice(i * 3180, (i + 1) * 3180));
  }
  async request(path: string, options: RequestInit = {}) {
    const url = new URL(path, origin);
    assert.equal(url.origin, origin, 'Session cookies stay on the app origin');
    const response = await fetch(url, { ...options, redirect: 'manual', headers: { Cookie: [...this.cookies].map(([n, v]) => `${n}=${v}`).join('; '), ...options.headers } });
    for (const c of response.headers.getSetCookie()) {
      const pair = c.split(';')[0]; const separator = pair.indexOf('=');
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  }
  async post(form: FormData, requestOrigin = origin, path = '/editorial') {
    return this.request(path, { method: 'POST', body: form, headers: { Origin: requestOrigin } });
  }
}
function formFrom(html: string, marker: string): FormData {
  const body = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m => m[1]).find(s => marker === 'logout' ? s.includes('Cerrar sesión') : s.includes(`name="${marker}"`));
  assert.ok(body, `Missing form ${marker}`);
  const form = new FormData();
  for (const match of body.matchAll(/<input\b[^>]*>/g)) {
    const name = match[0].match(/name="([^"]+)"/)?.[1];
    const value = match[0].match(/value="([^"]*)"/)?.[1];
    if (name) form.set(unescapeHtml(name), unescapeHtml(value || ''));
  }
  assert.ok([...form.keys()].some(k => k.startsWith('$ACTION_')), 'Real server action form required');
  return form;
}
async function sessionWithoutEmail(email: string) {
  const browser = new Browser();
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  assert.ok(!error && data.properties.hashed_token, 'Generate a local test session');
  const client = createServerClient(api, publicKey, {
    cookieOptions: { name: 'da-academy-auth', httpOnly: true, sameSite: 'lax', secure: false, path: '/' },
    cookies: { getAll: () => [...browser.cookies].map(([name, value]) => ({ name, value })), setAll: values => { for (const v of values) browser.cookies.set(v.name, v.value); } }
  });
  const verified = await client.auth.verifyOtp({ type: 'email', token_hash: data.properties.hashed_token });
  assert.equal(verified.error, null, 'Local Auth session verified');
  return browser;
}

let web: ReturnType<typeof spawn> | undefined;
try {
  await db.connect();
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    assert.ok(!error && data.user, 'Test mailbox already exists or local Auth is unavailable; do not delete unrelated accounts');
    userIds.push(data.user.id);
  }
  await db.query("insert into academy.editor_members(user_id,role) values($1,'editor'),($2,'reviewer')", userIds.slice(0, 2));
  // Refuse to reuse an existing web server, which could point at a different database.
  await new Promise<void>((resolve, reject) => {
    const probe = createServer(); probe.once('error', reject); probe.listen(3000, 'localhost', () => probe.close(() => resolve()));
  });
  web = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', 'apps/web', '--hostname', 'localhost', '--port', '3000'], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, EDITORIAL_MODE: 'live', EDITORIAL_SUPABASE_URL: api, EDITORIAL_SUPABASE_PUBLISHABLE_KEY: publicKey, EDITORIAL_SITE_URL: origin, EDITORIAL_EMAIL_ALLOWLIST: emails.join(',') }
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local Next server startup timeout; run npm run build first')), 30000);
    web!.stdout!.on('data', chunk => { if (String(chunk).includes('Ready')) { clearTimeout(timer); resolve(); } });
    web!.once('error', () => { clearTimeout(timer); reject(new Error('Could not start local Next server')); });
    web!.once('exit', () => { clearTimeout(timer); reject(new Error('Local Next server exited')); });
    web!.stderr!.resume(); // Do not echo sessions, callback URLs or Auth errors to CI logs.
  });
  const anon = new Browser();
  for (const path of ['/en','/en/method','/en/stories/reading-ai-results']) {
    const publicPage = await anon.request(path);
    assert.equal(publicPage.status,200,'English page loads');
    const englishHtml=await publicPage.text();
    assert.match(englishHtml,/<html lang="en"/,'Correct server-rendered document language');
    assert.ok(!englishHtml.includes('PORTAL EN VISTA PREVIA'),'English shell does not inherit Spanish banner');
  }
  assert.match(await (await anon.request('/')).text(),/<html lang="es"/);
  assert.equal((await anon.request('/en/stories/missing')).status,404,'Missing English article does not silently serve Spanish');
  assert.equal((await anon.request('/editorial')).headers.get('location'), '/login');
  assert.equal((await anon.request('/editorial/stories')).headers.get('location'), '/login');
  assert.equal((await anon.request('/editorial/budget')).headers.get('location'), '/login');
  anon.cookies.set('da-academy-auth', 'base64-forged-session');
  assert.equal((await anon.request('/editorial')).headers.get('location'), '/login');
  const editor = new Browser();
  const oldMessages = new Set((await (await fetch('http://127.0.0.1:56324/api/v1/messages')).json()).messages.map((m: { ID: string }) => m.ID));
  const login = formFrom(await (await editor.request('/login')).text(), 'email'); login.set('email', emails[0]);
  assert.match((await editor.post(login, origin, '/login')).headers.get('location') || '', /notice=sent/);
  // Supabase sends only to the local Mailpit container; this test never sends external email.
  let verificationUrl: string | undefined;
  for (let attempt = 0; attempt < 20 && !verificationUrl; attempt++) {
    const inbox = await (await fetch('http://127.0.0.1:56324/api/v1/messages')).json();
    const message = inbox.messages.find((m: { ID: string; To: { Address: string }[] }) => !oldMessages.has(m.ID) && m.To.some(t => t.Address === emails[0]));
    if (message) {
      const full = await (await fetch(`http://127.0.0.1:56324/api/v1/message/${message.ID}`)).json();
      verificationUrl = unescapeHtml(full.HTML.match(/href="([^"]*\/auth\/v1\/verify[^\"]*)"/)?.[1] || '');
    }
    if (!verificationUrl) await new Promise(r => setTimeout(r, 250));
  }
  assert.ok(verificationUrl, 'Expected local magic-link email');
  assert.equal(new URL(verificationUrl).origin, api, 'Email verification stays on local Auth');
  const verified = await fetch(verificationUrl, { redirect: 'manual' });
  const callback = verified.headers.get('location'); assert.ok(callback, 'Auth redirects back to app');
  const exchanged = await editor.request(callback);
  assert.equal(new URL(exchanged.headers.get('location')!, origin).pathname, '/editorial', 'PKCE callback signs in');
  let response = await editor.request('/editorial'); let html = await response.text();
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control') || '', /no-store/);
  editor.expireStoredSession();
  response = await editor.request('/editorial');
  assert.equal(response.status, 200, 'Expired stored session is refreshed');
  assert.ok(response.headers.getSetCookie().some(c => c.startsWith('da-academy-auth')), 'Refresh cookies reach the browser');
  html = await response.text();
  const intake = formFrom(html, 'identifier'); intake.set('identifier', canonical); intake.set('title', 'Synthetic HTTP integration fixture'); intake.set('domain', 'ai');
  assert.match((await editor.post(intake)).headers.get('location') || '', /notice=saved/);
  assert.match((await editor.post(intake)).headers.get('location') || '', /notice=saved/);
  assert.equal((await db.query('select count(*)::int as n from academy.sources where canonical_id=$1', [canonical])).rows[0].n, 1);
  html = await (await editor.request('/editorial')).text();
  const selection = formFrom(html, 'storyId'); selection.set('decision', 'select'); selection.set('reason', 'Primary source selected in HTTP test');
  const csrf = await editor.post(selection, 'https://attacker.example');
  assert.ok(csrf.status >= 400, 'Cross-origin Server Action rejected');
  assert.match((await editor.post(selection)).headers.get('location') || '', /notice=saved/);
  assert.match((await editor.post(selection)).headers.get('location') || '', /notice=saved/, 'Retry is idempotent');
  const afterReload = await (await editor.request('/editorial')).text();
  assert.ok(!afterReload.includes('Synthetic HTTP integration fixture'), 'Saved candidate leaves the new inbox');
  const catalogPath = '/editorial/stories?q=' + encodeURIComponent(canonical) + '&status=researching&decision=select&domain=ai';
  const catalog = await (await editor.request(catalogPath)).text();
  assert.match(catalog, /Primary source selected in HTTP test/, 'Catalog retains history and searches source identity');
  const noMatch = await (await editor.request(catalogPath.replace('domain=ai', 'domain=physics'))).text();
  assert.ok(!noMatch.includes('Synthetic HTTP integration fixture'), 'Domain filter runs in the database');
  const wildcard = await (await editor.request('/editorial/stories?q=%25')).text();
  assert.ok(!wildcard.includes('Synthetic HTTP integration fixture'), 'Percent search is literal');
  const reasonSearch = await (await editor.request('/editorial/stories?q=Primary+source+selected+in+HTTP+test')).text();
  assert.match(reasonSearch, /Synthetic HTTP integration fixture/, 'Decision reasons are searchable');
  selection.set('requestId', randomUUID()); selection.set('decision', 'hold');
  assert.match((await editor.post(selection)).headers.get('location') || '', /notice=conflict/);
  const reviewer = await sessionWithoutEmail(emails[1]);
  assert.equal((await db.query('select count(*)::int n from academy.budget_periods where month=$1',[budgetMonth])).rows[0].n,0,'Refuse to replace an existing budget');
  await db.query("select academy.budget_configure($1,200000000,'{\"news_analysis\":30000000,\"content\":50000000,\"voice\":50000000,\"video\":70000000}',10000000,25000000)",[budgetMonth]);
  budgetFixture=true;
  const operation=(await db.query("select (academy.budget_reserve($1,$2,'voice',1500000,$3,'video:http-test','fixture','1','fixture/1',repeat('a',64))).id as id",['http-budget:'+randomUUID(),budgetMonth,selection.get('storyId')])).rows[0].id;
  const token=(await db.query('select academy.budget_start($1) as token',[operation])).rows[0].token;
  await db.query('select academy.budget_uncertain($1,$2)',[operation,token]);
  const budgetPage=await reviewer.request('/editorial/budget?month=2095-01');
  assert.equal(budgetPage.status,200);
  assert.match(budgetPage.headers.get('cache-control')||'',/no-store/);
  const budgetHtml=await budgetPage.text();
  for(const label of ['Análisis de noticias','Texto y guion','Voz','Vídeo','uncertain','Pendientes de conciliación:']) assert.ok(budgetHtml.includes(label),'Budget exposes categories and unresolved operation');
  assert.ok(!budgetHtml.includes('name="reason"'),'Budget has no financial write forms');
  const readOnly = await (await reviewer.request('/editorial/stories')).text();
  assert.match(readOnly, /Primary source selected in HTTP test/); assert.ok(!readOnly.includes('name="reason"'));
  assert.ok((await reviewer.post(selection)).status >= 400, 'Reviewer cannot invoke hidden action directly');
  const reconsider = formFrom(catalog, 'storyId');
  reconsider.set('decision', 'revise'); reconsider.set('reason', 'New evidence requested in HTTP test');
  assert.match((await editor.post(reconsider, origin, '/editorial/stories')).headers.get('location') || '', /status=researching.*notice=saved/, 'Catalog save preserves safe filters');
  const revised = await (await editor.request('/editorial/stories?q=' + encodeURIComponent(canonical) + '&status=review&decision=revise')).text();
  assert.match(revised, /New evidence requested in HTTP test/);
  assert.match(revised, /Primary source selected in HTTP test/, 'Reanalysis preserves previous reasons');
  assert.ok(!(await (await editor.request('/editorial')).text()).includes('Synthetic HTTP integration fixture'), 'Reconsideration does not reset new queue');
  const marker = `pagination-${randomUUID()}`;
  paginationIds.push(...(await db.query("insert into academy.stories(slug,title_en,status) select $1||'-'||n,$1||' item '||n,'candidate' from generate_series(1,21) n returning id", [marker])).rows.map(row=>row.id));
  const pageOne = await (await editor.request('/editorial/stories?q=' + marker)).text();
  const pageTwo = await (await editor.request('/editorial/stories?q=' + marker + '&page=2')).text();
  assert.equal((pageOne.match(/class="candidate-card"/g)||[]).length,20,'First page shows 20 filtered stories');
  assert.equal((pageTwo.match(/class="candidate-card"/g)||[]).length,1,'Second page includes the remaining story');
  assert.equal((await editor.request('/editorial/stories?q=' + marker + '&page=999')).status,200,'Out-of-range page remains a usable empty result');
  const outsider = await sessionWithoutEmail(emails[2]);
  assert.match((await outsider.request('/editorial/stories')).headers.get('location') || '', /notice=access/);
  assert.match((await outsider.request('/editorial/budget?month=2095-01')).headers.get('location') || '', /notice=access/);
  assert.match((await outsider.request('/editorial')).headers.get('location') || '', /notice=access/);
  await db.query('delete from academy.editor_members where user_id=$1', [userIds[1]]);
  assert.match((await reviewer.request('/editorial')).headers.get('location') || '', /notice=access/, 'Membership revocation takes effect immediately');
  const logout = formFrom(afterReload, 'logout');
  assert.equal((await editor.post(logout)).headers.get('location'), '/login');
  assert.equal((await editor.request('/editorial')).headers.get('location'), '/login');
  console.log('PASS: Auth/PKCE, refresh/logout, private reads, inbox/catalog, read-only budget dashboard, decision history, CSRF, retries, stale tab, reviewer and revoked membership');
} finally {
  if (web && web.exitCode === null) web.kill();
  if (userIds.length) {
    if(budgetFixture) {
      await db.query('delete from academy.budget_events where operation_id in (select id from academy.budget_operations where month=$1)',[budgetMonth]);
      await db.query('delete from academy.budget_operations where month=$1',[budgetMonth]);
      await db.query('delete from academy.budget_periods where month=$1',[budgetMonth]);
    }
    if (paginationIds.length) await db.query('delete from academy.stories where id=any($1::uuid[])', [paginationIds]);
    // Remove only data associated with this unique synthetic source and the test users created above.
    const stories = (await db.query("select id from academy.stories where slug='source-'||md5($1)", [canonical])).rows.map(r => r.id);
    for (const table of ['production_jobs', 'editorial_decisions', 'story_sources', 'story_domains']) await db.query(`delete from academy.${table} where story_id=any($1::uuid[])`, [stories]);
    await db.query('delete from academy.stories where id=any($1::uuid[])', [stories]);
    await db.query('delete from academy.sources where canonical_id=$1', [canonical]);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  }
  await db.end();
}
