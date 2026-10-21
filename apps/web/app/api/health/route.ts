export function GET() {
  return Response.json({ status: 'ok', mode: 'demo', publicationEnabled: false, version: '0.1.0' });
}
