import { NextRequest, NextResponse } from 'next/server';
import { callbackUrl, serviceHeaders, verifyState } from '@/lib/social-oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '') : (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : request.nextUrl.origin);
  const finish = (platform: string, result: string) => NextResponse.redirect(new URL('/studio?social=' + encodeURIComponent(platform) + '&result=' + encodeURIComponent(result), base));
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state') || '';
    const providerError = request.nextUrl.searchParams.get('error');
    if (providerError) return finish('account', 'cancelled');
    if (!code) return finish('account', 'missing_code');
    const { userId, platform } = verifyState(state);
    const redirect = callbackUrl();
    let payload: Record<string, unknown>;
    if (platform === 'youtube') {
      const form = new URLSearchParams({ code, client_id: process.env.YOUTUBE_CLIENT_ID || '', client_secret: process.env.YOUTUBE_CLIENT_SECRET || '', redirect_uri: redirect, grant_type: 'authorization_code' });
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const data = await response.json();
      if (!response.ok || !data.refresh_token) throw new Error('Google no devolvió un refresh token. Revoca el acceso anterior y vuelve a conectar.');
      payload = { user_id: userId, platform, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString(), scope: data.scope || '', metadata: { token_type: data.token_type || 'Bearer' } };
    } else {
      const form = new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY || '', client_secret: process.env.TIKTOK_CLIENT_SECRET || '', code, grant_type: 'authorization_code', redirect_uri: redirect });
      const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const data = await response.json();
      if (!response.ok || data.error || !data.access_token) throw new Error('TikTok no autorizó la cuenta: ' + JSON.stringify(data).slice(0, 350));
      payload = { user_id: userId, platform, access_token: data.access_token, refresh_token: data.refresh_token || null, expires_at: new Date(Date.now() + Number(data.expires_in || 86400) * 1000).toISOString(), scope: data.scope || '', metadata: { open_id: data.open_id || '', token_type: data.token_type || 'Bearer' } };
    }
    const response = await fetch((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/rest/v1/social_connections?on_conflict=user_id,platform', { method: 'POST', headers: serviceHeaders(), body: JSON.stringify(payload) });
    if (!response.ok) throw new Error('No se pudo guardar la conexión de forma segura.');
    return finish(platform, 'connected');
  } catch (error) {
    console.error('Social OAuth callback:', error);
    return finish('account', 'error');
  }
}
