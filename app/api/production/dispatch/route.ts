import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic='force-dynamic';
const slots=['how-it-works','inside','curiosities'];
export async function POST(request:NextRequest){
 try{
  const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return NextResponse.json({error:'Inicia sesión para generar un vídeo.'},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,github=process.env.GITHUB_ACTIONS_TOKEN;
  if(!url||!anon)return NextResponse.json({error:'Falta configurar Supabase.'},{status:500});
  if(!github)return NextResponse.json({error:'Falta GITHUB_ACTIONS_TOKEN en Vercel. Añádelo para habilitar la generación desde la web.'},{status:503});
  const db=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}}});
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)return NextResponse.json({error:'La sesión ha caducado. Vuelve a entrar.'},{status:401});
  const body=await request.json(),slot=String(body?.slot||'');
  if(!slots.includes(slot))return NextResponse.json({error:'Selecciona una de las tres franjas editoriales.'},{status:400});
  const {data:channel,error:channelError}=await db.from('channel_settings').select('id,user_id').eq('brand_slug','nexo-raro').eq('user_id',user.id).maybeSingle();
  if(channelError||!channel)return NextResponse.json({error:'No hay un canal configurado para esta cuenta.'},{status:403});
  const response=await fetch('https://api.github.com/repos/ivanmunozadan12-blip/nexo-raro-studio/actions/workflows/daily-video.yml/dispatches',{
   method:'POST',headers:{Authorization:'Bearer '+github,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
   body:JSON.stringify({ref:'main',inputs:{slot}})
  });
  if(!response.ok)return NextResponse.json({error:'GitHub no aceptó la generación (HTTP '+response.status+'). '+(await response.text()).slice(0,500)},{status:502});
  return NextResponse.json({success:true,slot,message:'Generación enviada al motor.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Error inesperado.'},{status:500})}
}
