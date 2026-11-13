import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    github: Boolean(process.env.GITHUB_ACTIONS_TOKEN),
    youtube: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN),
    tiktok: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && (process.env.TIKTOK_REFRESH_TOKEN || process.env.TIKTOK_ACCESS_TOKEN))
  };
  return NextResponse.json({
    service: 'behind-del-mundo-studio',
    status: 'online',
    studioReady: configured.supabase && configured.github,
    workflow: 'three-user-prompts',
    productionWorker: 'github-actions-python',
    aiProvider: 'groq',
    renderer: 'python-pillow-numpy-ffmpeg',
    voice: 'edge-tts-es-ES-AlvaroNeural',
    publishing: { youtube: configured.youtube, tiktok: configured.tiktok },
    dispatch: configured.github ? 'configured' : 'missing'
  });
}
