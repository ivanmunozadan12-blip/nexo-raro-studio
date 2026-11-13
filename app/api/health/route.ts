import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const github = Boolean(process.env.GITHUB_ACTIONS_TOKEN);
  return NextResponse.json({
    service: 'behind-del-mundo-studio',
    status: 'online',
    studioReady: supabase && github,
    workflow: 'three-user-prompts',
    productionWorker: 'github-actions-python',
    aiProvider: 'groq',
    renderer: 'python-pillow-numpy-ffmpeg',
    voice: 'edge-tts-es-ES-AlvaroNeural',
    publishingCredentials: 'configured-in-github-actions',
    dispatch: github ? 'configured' : 'missing'
  });
}
