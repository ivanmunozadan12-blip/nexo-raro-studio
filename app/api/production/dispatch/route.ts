import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const workflow = 'daily-video.yml';
const slots = ['how-it-works', 'inside', 'curiosities'] as const;

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Inicia sesión para generar vídeos.' }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const github = process.env.GITHUB_ACTIONS_TOKEN;
    if (!url || !anon) return NextResponse.json({ error: 'Falta configurar Supabase.' }, { status: 500 });
    if (!github) return NextResponse.json({ error: 'Falta GITHUB_ACTIONS_TOKEN en Vercel.' }, { status: 503 });

    const db = createClient(url, anon, { global: { headers: { Authorization: 'Bearer ' + token } } });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'La sesión ha caducado. Vuelve a entrar.' }, { status: 401 });

    const body = await request.json();
    const prompts = [body?.prompt1, body?.prompt2, body?.prompt3].map((x) => String(x || '').trim());
    if (prompts.some((p) => p.length < 12)) {
      return NextResponse.json({ error: 'Escribe los tres prompts (al menos 12 caracteres cada uno).' }, { status: 400 });
    }
    if (prompts.some((p) => p.length > 3500)) {
      return NextResponse.json({ error: 'Cada prompt debe tener como máximo 3.500 caracteres.' }, { status: 400 });
    }

    const { data: channel, error: channelError } = await db.from('channel_settings')
      .select('id,user_id').eq('brand_slug', 'nexo-raro').eq('user_id', user.id).maybeSingle();
    if (channelError || !channel) return NextResponse.json({ error: 'No hay un canal configurado para esta cuenta.' }, { status: 403 });

    const results = [];
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`https://api.github.com/repos/ivanmunozadan12-blip/nexo-raro-studio/actions/workflows/${workflow}/dispatches`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + github, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'prompt-video-studio', inputs: { slot: slots[i], prompt: prompts[i] } })
      });
      if (!response.ok) {
        return NextResponse.json({ error: `No se pudo iniciar el vídeo ${i + 1} (HTTP ${response.status}). ${(await response.text()).slice(0, 350)}`, started: results }, { status: 502 });
      }
      results.push({ slot: slots[i], accepted: true });
    }
    return NextResponse.json({ success: true, started: results, message: 'Los tres vídeos se han enviado al motor.' });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado.' }, { status: 500 });
  }
}
