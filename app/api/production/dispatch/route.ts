import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const githubToken = process.env.GITHUB_ACTIONS_TOKEN;
    if (!url || !anon) return NextResponse.json({ error: 'Falta la configuración pública de Supabase.' }, { status: 500 });
    if (!githubToken) return NextResponse.json({ error: 'La web todavía no tiene configurado GITHUB_ACTIONS_TOKEN en Vercel. Los guiones están guardados en cola, pero no se ha iniciado ningún render.' }, { status: 503 });

    const db = createClient(url, anon, { global: { headers: { Authorization: 'Bearer ' + accessToken } } });
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: 'La sesión ha caducado. Vuelve a entrar.' }, { status: 401 });

    const body = await request.json();
    const ids = Array.isArray(body?.scriptIds) ? body.scriptIds : [];
    if (ids.length < 1 || ids.length > 10 || ids.some((id: unknown) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'Envía entre uno y diez guiones por lote.' }, { status: 400 });
    }
    const { data: scripts, error: scriptsError } = await db.from('scripts').select('id,status').in('id', ids);
    if (scriptsError) return NextResponse.json({ error: scriptsError.message }, { status: 400 });
    if (!scripts || scripts.length !== ids.length || scripts.some(s => !['queued', 'in_production', 'approved'].includes(s.status))) {
      return NextResponse.json({ error: ids.length === 1 ? 'No se ha encontrado el guion pendiente de esta cuenta o su estado no permite reintentarlo.' : 'No se han encontrado los tres guiones pendientes de esta cuenta.' }, { status: 400 });
    }

    const dispatched: string[] = [];
    for (let index = 0; index < ids.length; index++) {
      const response = await fetch('https://api.github.com/repos/ivanmunozadan12-blip/nexo-raro-studio/actions/workflows/daily-production.yml/dispatches', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + githubToken,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { script_id: ids[index], queue_index: String(index) },
        }),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        return NextResponse.json({ error: 'GitHub no aceptó el trabajo ' + (index + 1) + ' (HTTP ' + response.status + '). ' + detail, dispatched }, { status: 502 });
      }
      dispatched.push(ids[index]);
    }
    return NextResponse.json({ success: true, dispatched });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error inesperado al iniciar la producción.' }, { status: 500 });
  }
}
