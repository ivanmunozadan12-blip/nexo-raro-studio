import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callbackUrl, signState, SocialPlatform } from '@/lib/social-oauth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ platform: string }> }) {
  try {
    const { platform } = await context.params;
    if (platform !== 'youtube' && platform !== 'tiktok') return NextResponse.json({ error: 'Plataforma no válida.' }, { status: 404 });
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Inicia sesión primero.' }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return NextResponse.json({ error: 'Falta configurar Supabase.' }, { status: 500 });
    const db = createClient(url, anon, { global: { headers: { Authorization: 'Bearer ' + token } } });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'La sesión ha caducado.' }, { status: 401 });
    const state = signState(user.id, platform as SocialPlatform);
    const redirect = callbackUrl();
    const target = new URL(platform === 'youtube' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://www.tiktok.com/v2/auth/authorize/');
    if (platform === 'youtube') {
      const clientId = process.env.YOUTUBE_CLIENT_ID;
      if (!clientId) return NextResponse.json({ error: 'Falta YOUTUBE_CLIENT_ID en Vercel.' }, { status: 503 });
      target.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'https://www.googleapis.com/auth/youtube.upload', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state }).toString();
    } else {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      if (!clientKey) return NextResponse.json({ error: 'Falta TIKTOK_CLIENT_KEY en Vercel.' }, { status: 503 });
      target.search = new URLSearchParams({ client_key: clientKey, redirect_uri: redirect, response_type: 'code', scope: 'user.info.basic,video.publish', state }).toString();
    }
    return NextResponse.json({ url: target.toString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo iniciar la conexión.' }, { status: 500 });
  }
}
