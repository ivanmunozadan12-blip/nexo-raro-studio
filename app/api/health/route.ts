import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const required = ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CRON_SECRET','OPENAI_API_KEY'];
  const configured = Object.fromEntries(required.map((key) => [key, Boolean(process.env[key])]));
  return NextResponse.json({ service: 'nexo-raro-studio', status: 'online', generationReady: Object.values(configured).every(Boolean), configured: Object.fromEntries(Object.entries(configured).map(([key,value]) => [key, value ? 'configured' : 'missing'])), schedule: ['07:30','14:30','20:30'], timezone: 'Europe/Madrid' });
}
