import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // The video worker runs in GitHub Actions, not in the Vercel web runtime.
  // Groq credentials therefore remain in GitHub Actions secrets and are not
  // exposed or incorrectly checked from this endpoint.
  const configured = {
    supabasePublicUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabasePublicKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
  return NextResponse.json({
    service: 'nexo-raro-studio',
    status: 'online',
    studioReady: Object.values(configured).every(Boolean),
    productionWorker: 'github-actions',
    aiProvider: 'external-script-input',
    productionDispatch: process.env.GITHUB_ACTIONS_TOKEN ? 'configured' : 'missing',
    publishing: 'draft-and-manual-approval',
    configured: Object.fromEntries(Object.entries(configured).map(([key, value]) => [key, value ? 'configured' : 'missing'])),
    schedule: ['07:30', '14:30', '20:30'],
    timezone: 'Europe/Madrid',
  });
}
