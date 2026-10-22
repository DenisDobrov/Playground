import { NextResponse, type NextRequest } from 'next/server';
import { editorialClient } from '../../../lib/editorial-auth';
import { editorialConfig } from '../../../lib/editorial-config';

export async function GET(request: NextRequest) {
  const { origin } = editorialConfig();
  const code = request.nextUrl.searchParams.get('code');
  let destination = '/login?notice=expired';
  if (code && code.length < 2048) {
    const client = await editorialClient(true);
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) destination = '/editorial';
  }
  const response = NextResponse.redirect(new URL(destination, origin));
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response; // Fixed destination: no arbitrary next/redirect URL.
}
