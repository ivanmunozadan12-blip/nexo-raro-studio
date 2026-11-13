import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { serviceHeaders } from '@/lib/social-oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return NextResponse.json({ error: 'Falta Supabase.' }, { status: 500 });
    const db = createClient(url, anon, { global: { headers: { Authorization: 'Bearer ' + token } } });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    const response = await fetch((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/rest/v1/social_connections?user_id=eq.' + encodeURIComponent(user.id) + '&select=platform,expires_at', { headers: serviceHeaders(), cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo consultar el estado de las conexiones.');
    const rows = await response.json();
    return NextResponse.json({ youtube: rows.some((x: any) => x.platform === 'youtube'), tiktok: rows.some((x: any) => x.platform === 'tiktok') });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error consultando conexiones.' }, { status: 500 });
  }
}
