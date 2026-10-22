import Link from 'next/link';
import { editorialEnabled } from '../../lib/editorial-config';
import { requestLogin, signOut } from './actions';
export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  if (!editorialEnabled()) return <main><h1>Acceso editorial</h1><p>Esta vista previa usa datos ficticios.</p><Link href="/editorial">Abrir la demostración</Link></main>;
  return <main className="auth-panel"><p className="eyebrow">DOBROV ACADEMY / REDACCIÓN</p><h1>Acceso editorial.</h1>
    <p>Solicita un enlace de acceso con tu correo de invitación. Abre el enlace en este mismo navegador.</p>
    {notice === 'sent' && <p role="status">Si tu cuenta está habilitada, recibirás un enlace de acceso. Revisa tu correo.</p>}
    {notice === 'access' && <><p role="alert">Tu cuenta no tiene acceso a la redacción. Solicita una invitación al administrador.</p><form action={signOut}><button type="submit">Cerrar sesión</button></form></>}
    {notice === 'expired' && <p role="alert">El enlace no es válido o ha caducado. Solicita uno nuevo.</p>}
    <form action={requestLogin}><label>Correo electrónico<input name="email" type="email" required maxLength={254} autoComplete="email" /></label><button type="submit">Enviar enlace de acceso</button></form>
  </main>;
}
