import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { editorialConfig, editorialEnabled } from './lib/editorial-config';
import {homePath,preferredLanguage} from './lib/news-languages';

export async function proxy(request: NextRequest) {
  // Negotiate only the neutral entry. Explicit article and language URLs always win.
  if(request.nextUrl.pathname==='/'){
    const language=preferredLanguage(request.cookies.get('da-language')?.value,request.headers.get('accept-language'));
    const url=request.nextUrl.clone();url.pathname=homePath(language);
    const response=NextResponse.redirect(url,307);
    response.headers.set('Vary','Accept-Language, Cookie');
    response.headers.set('Cache-Control','private, no-store, max-age=0');
    return response;
  }
  if (!editorialEnabled()) return NextResponse.next();
  const config = editorialConfig();
  let response = NextResponse.next({ request });
  const client = createServerClient(config.url, config.key, {
    cookieOptions: { name: 'da-academy-auth', httpOnly: true, sameSite: 'lax', secure: config.secure, path: '/' },
    cookies: { getAll: () => request.cookies.getAll(), setAll(updates) {
      for (const { name, value } of updates) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of updates) response.cookies.set(name, value, options);
    } }
  });
  await client.auth.getUser(); // Refresh only. Each page/action also verifies identity and current DB role.
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
export const config = { matcher: ['/', '/editorial/:path*', '/login', '/auth/:path*'] };
