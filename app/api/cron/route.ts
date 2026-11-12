import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!expected || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ status: 'accepted', message: 'Scheduler authenticated. Production worker is not yet configured; no placeholder video will be created.', configured: { supabase: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), ai: Boolean(process.env.OPENAI_API_KEY), renderer: Boolean(process.env.RENDER_WORKER_URL), youtube: Boolean(process.env.YOUTUBE_REFRESH_TOKEN), tiktok: Boolean(process.env.TIKTOK_ACCESS_TOKEN) } }, { status: 202 });
}

function timingSafeEqual(a: string, b: string) {
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) mismatch |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  return mismatch === 0;
}
