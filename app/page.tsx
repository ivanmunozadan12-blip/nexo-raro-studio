import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

async function getPublicVideos(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return [];
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.from('videos')
   .select('id,job_id,script_id,storage_path,duration_seconds,created_at,quality_check')
   .order('created_at',{ascending:false}).limit(30);
  if(error||!data?.length)return [];
  const approved=data.filter((v:any)=>v.quality_check?.renderer==='behind-del-mundo-cinematic-v2-enzo');
  if(!approved.length)return [];
  const jobIds=approved.map((v:any)=>v.job_id).filter(Boolean);
  const scriptIds=approved.map((v:any)=>v.script_id).filter(Boolean);
  const [{data:jobs},{data:scripts}]=await Promise.all([
   db.from('production_jobs').select('id,status').in('id',jobIds).eq('status','ready'),
   db.from('scripts').select('id,title,hook').in('id',scriptIds)
  ]);
  const readyJobs=new Set((jobs||[]).map((j:any)=>j.id));
  const titles=new Map((scripts||[]).map((s:any)=>[s.id,s]));
  const visible=approved.filter((v:any)=>readyJobs.has(v.job_id)).slice(0,12);
  return await Promise.all(visible.map(async(v:any)=>{
   const {data:signed}=await db.storage.from('nexo-videos').createSignedUrl(v.storage_path,60*60*24);
   const script:any=titles.get(v.script_id);
   return {id:v.id,title:script?.title||'BEHIND DEL MUNDO',hook:script?.hook||'',url:signed?.signedUrl||'',duration:Number(v.duration_seconds||0),createdAt:v.created_at};
  })).then((items:any[])=>items.filter(v=>v.url));
 }catch{return []}
}

export default async function Home(){
 const videos=await getPublicVideos();
 return <main className="shell">
  <header className="topbar">
   <a className="brand" href="/"><span className="brand-mark brand-mark-world"><img src="/brand-mark.svg" alt=""/></span><span>BEHIND <b>DEL MUNDO</b><small>DESCUBRE LO QUE HAY DETRÁS</small></span></a>
   <Link className="login-link" href="/studio">Abrir estudio ↗</Link>
  </header>
  <section className="hero">
   <div className="eyebrow">EXPLORA · DESCUBRE · ENTIENDE</div>
   <h1>El mundo tiene<br/><em>mucho detrás.</em></h1>
   <p>Historias visuales para descubrir cómo funciona lo que nos rodea, los lugares que esconden secretos y los fenómenos que parecen imposibles.</p>
   <div className="hero-foot"><span>BEHIND DEL MUNDO</span><span>CIENCIA · HISTORIA · CURIOSIDADES</span></div>
  </section>
  <section className="public-library" id="videos">
   <div className="section-head"><div><div className="eyebrow">LA VIDEOTECA</div><h2>Historias para mirar más allá.</h2></div><span className="library-count">{videos.length} VÍDEOS</span></div></section>
   {videos.length?<div className="public-video-grid">{videos.map((video:any)=><article className="public-video-card" key={video.id}>
    <video controls playsInline preload="metadata" src={video.url}/>
    <div className="public-video-info"><div className="eyebrow">BEHIND DEL MUNDO</div><h3>{video.title}</h3>{video.hook&&<p>{video.hook}</p>}<small>{Math.round(video.duration)} segundos · {new Date(video.createdAt).toLocaleDateString('es-ES')}</small></div>
   </article>)}</div>:<div className="public-empty"><span>PRÓXIMAMENTE</span><h3>Estamos preparando nuevas historias.</h3><p>Los próximos vídeos que superen el control de calidad aparecerán aquí automáticamente.</p></div>}
  </section>
  <section className="grid">
   <article className="panel"><div className="eyebrow">CADA HISTORIA, UN VIAJE</div><h3>Del detalle al descubrimiento</h3><p>Escenas animadas y explicaciones visuales que siguen el hilo de cada historia para que entiendas lo que estás viendo.</p></article>
   <article className="panel mascot"><div className="eyebrow">NUESTRO EXPLORADOR</div><div className="mascot-icon">✳</div><h3>Enzo te acompaña.</h3><p>Un explorador curioso que se adentra en cada historia para descubrir qué hay detrás.</p></article>
  </section>
  <footer>BEHIND DEL MUNDO © 2026 · DESCUBRE LO QUE HAY DETRÁS</footer>
 </main>
}
