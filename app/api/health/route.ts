import { NextResponse } from 'next/server';
export const dynamic='force-dynamic';
export async function GET(){
 const configured={supabase:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),github:Boolean(process.env.GITHUB_ACTIONS_TOKEN)};
 return NextResponse.json({service:'behind-del-mundo-studio',status:'online',studioReady:configured.supabase,productionWorker:'github-actions-python',aiProvider:'groq',renderer:'python-pillow-numpy-ffmpeg',voice:'edge-tts-es-ES-AlvaroNeural',publishing:'private-review-only',dispatch:configured.github?'configured':'missing',schedule:['07:30','14:30','20:30'],timezone:'Europe/Madrid'});
}