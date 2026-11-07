// Process liveness deliberately makes no claim about database or worker readiness.
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ status: 'ok', checks: { web: 'alive' }, publication: 'not_probed' }, {
    headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }
  });
}
