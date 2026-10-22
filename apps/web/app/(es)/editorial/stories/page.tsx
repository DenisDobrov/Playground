import { Inbox } from '../inbox';
import { editorialEnabled } from '../../../../lib/editorial-config';
import type { EditorialParams } from '../../../../lib/editorial-query';
export const dynamic = 'force-dynamic';
export default async function Stories({ searchParams }: { searchParams: Promise<EditorialParams> }) {
  if (!editorialEnabled()) return <main><h1>Catálogo editorial</h1><p>El catálogo de fuentes reales requiere el modo editorial conectado.</p><a href="/editorial">Volver a la demo</a></main>;
  return <Inbox catalog params={await searchParams} />;
}
