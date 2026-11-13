'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase-browser';

const fmt=(v:string)=>new Date(v).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'});
export default function Studio(){
 const db=supabase();
 const [session,setSession]=useState<any>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false);
 const [scripts,setScripts]=useState<any[]>([]),[jobs,setJobs]=useState<any[]>([]),[videos,setVideos]=useState<any[]>([]),[memory,setMemory]=useState<any[]>([]),[posts,setPosts]=useState<any[]>([]);
 const [signed,setSigned]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[dispatching,setDispatching]=useState(false),[message,setMessage]=useState(''),[prompt1,setPrompt1]=useState(''),[prompt2,setPrompt2]=useState(''),[prompt3,setPrompt3]=useState('');
 const load=useCallback(async()=>{
  if(!session)return;
  setBusy(true);
  const [s,j,v,m,p]=await Promise.all([
   db.from('scripts').select('id,title,hook,narration,status,created_at,source_notes').order('created_at',{ascending:false}).limit(18),
   db.from('production_jobs').select('id,status,error_message,started_at,completed_at,scheduled_for,script_id').order('created_at',{ascending:false}).limit(18),
   db.from('videos').select('id,storage_path,duration_seconds,width,height,quality_check,created_at').order('created_at',{ascending:false}).limit(12),
   db.from('editorial_memory').select('id,topic,angle,memory_status,created_at').order('created_at',{ascending:false}).limit(40),
   db.from('social_posts').select('id,video_id,platform,status,external_post_id,error_message,created_at').order('created_at',{ascending:false}).limit(60)
  ]);
  const error=s.error||j.error||v.error||m.error||p.error;
  if(error)setMessage('No se han podido cargar todos los datos: '+error.message);
  setScripts(s.data||[]);setJobs(j.data||[]);setVideos(v.data||[]);setMemory(m.data||[]);setPosts(p.data||[]);
  setBusy(false);
 },[session]);
 useEffect(()=>{db.auth.getSession().then(({data}:any)=>setSession(data.session));const {data}=db.auth.onAuthStateChange((_e:any,s:any)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{if(!session||!jobs.some(j=>['queued','voicing','rendering','publishing'].includes(j.status)))return;const timer=window.setInterval(load,20000);return()=>window.clearInterval(timer)},[session,jobs,load]);
 useEffect(()=>{let active=true;(async()=>{const next:Record<string,string>={};for(const v of videos){const {data}=await db.storage.from('nexo-videos').createSignedUrl(v.storage_path,3600);if(data?.signedUrl)next[v.id]=data.signedUrl;}if(active)setSigned(next)})();return()=>{active=false}},[videos]);
 async function auth(e:any){e.preventDefault();const r=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});setMessage(r.error?.message||(signup?'Revisa tu correo para confirmar la cuenta.':'Sesión iniciada.'))}
 async function generateAll(){
  setDispatching(true);setMessage('');
  try{
   const {data:{session:active}}=await db.auth.getSession();
   const r=await fetch('/api/production/dispatch',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+active?.access_token},body:JSON.stringify({prompt1,prompt2,prompt3})});
   const result=await r.json();if(!r.ok)throw new Error(result.error||'No se pudieron iniciar los vídeos.');
   setMessage('Los tres vídeos se han enviado al motor. Puedes seguir esta página para consultar su progreso.');
   await load();
  }catch(e:any){setMessage(e?.message||'Error al iniciar los vídeos.')}
  finally{setDispatching(false)}
 }
 async function addExclusion(){
  const topic=window.prompt('¿Qué tema quieres excluir de futuras ideas?');if(!topic?.trim())return;
  const {error}=await db.from('editorial_memory').insert({user_id:session.user.id,topic:topic.trim(),topic_key:topic.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-'),angle:'Exclusión manual',summary:'Tema excluido desde el panel',source_urls:[],memory_status:'rejected',reason:'Excluido manualmente'});
  if(error)setMessage(error.message);else{setMessage('Tema añadido a exclusiones.');await load()}
 }
 if(!session)return <main className="auth-shell"><a className="brand" href="/"><span className="brand-mark brand-mark-world"><img src="/brand-mark.svg" alt=""/></span><span>BEHIND <b>DEL MUNDO</b><small>STUDIO / ACCESO</small></span></a><section className="auth-card"><div className="eyebrow">CENTRO DE PRODUCCIÓN</div><h1>{signup?'Crea tu acceso.':'Vuelve al estudio.'}</h1><p>Accede al panel privado de Behind del Mundo.</p><form onSubmit={auth}><label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><button>{signup?'Crear cuenta':'Entrar'}</button></form><button className="link-button" onClick={()=>setSignup(!signup)}>{signup?'Ya tengo cuenta · Entrar':'Crear una cuenta'}</button>{message&&<p className="notice">{message}</p>}</section></main>;
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Madrid'});
 const todays=scripts.filter(s=>new Date(s.created_at).toLocaleDateString('en-CA',{timeZone:'Europe/Madrid'})===today);
 const ready=videos.length,failed=jobs.filter(j=>j.status==='failed').length,active=jobs.filter(j=>['queued','voicing','rendering','publishing'].includes(j.status)).length;
 const latest=videos.slice(0,6);
 return <main className="studio-shell">
  <header className="studio-top"><a className="brand" href="/"><span className="brand-mark brand-mark-world"><img src="/brand-mark.svg" alt=""/></span><span>BEHIND <b>DEL MUNDO</b><small>STUDIO / CONTROL ROOM</small></span></a><div className="top-actions"><span className="user-email">{session.user.email}</span><button className="ghost-button" onClick={load}>{busy?'Actualizando…':'↻ Actualizar'}</button><button className="ghost-button" onClick={()=>db.auth.signOut()}>Salir</button></div></header>
  <section className="studio-heading"><div><div className="eyebrow">NUEVA LÍNEA EDITORIAL / EUROPE-MADRID</div><h1>Centro de <em>producción.</em></h1><p>Tres historias distintas al día. Investigación, animación, voz y sonido.</p></div><div className="system-pill"><i/> MOTOR PYTHON / PILLOW / FFMPEG</div></section>
  {message&&<div className="studio-message">{message}<button onClick={()=>setMessage('')}>×</button></div>}
  <div className="metric-grid"><Metric label="Vídeos guardados" value={ready} note="Biblioteca privada"/><Metric label="En producción" value={active} note="Trabajos activos"/><Metric label="Fallidos" value={failed} note="Requieren revisión"/><Metric label="Temas recordados" value={memory.length} note="Memoria editorial"/></div>
  <section className="studio-card prompt-studio">
   <div className="card-kicker">CREACIÓN / TUS TRES VÍDEOS</div><h2>Prepara los vídeos de hoy</h2>
   <p className="muted-copy">Pega los tres prompts diarios que te preparo. El motor creará una animación distinta para cada historia, con narración, música, efectos y subtítulos.</p>
   <label>Vídeo 1 · Cómo funcionan las cosas<textarea rows={3} value={prompt1} onChange={e=>setPrompt1(e.target.value)} placeholder="Ej.: Explica cómo funciona un microondas por dentro, mostrando el magnetrón, las ondas y cómo calientan los alimentos…"/></label>
   <label>Vídeo 2 · El mundo por dentro<textarea rows={3} value={prompt2} onChange={e=>setPrompt2(e.target.value)} placeholder="Ej.: Recorre el interior de un aeropuerto y explica qué ocurre desde que facturas hasta que el avión despega…"/></label>
   <label>Vídeo 3 · Curiosidades y porqués<textarea rows={3} value={prompt3} onChange={e=>setPrompt3(e.target.value)} placeholder="Ej.: ¿Por qué los aviones dejan estelas blancas en el cielo? Explícalo visualmente…"/></label>
   <button className="primary-button" disabled={dispatching||busy||[prompt1,prompt2,prompt3].some(x=>x.trim().length<12)} onClick={generateAll}>{dispatching?'Enviando los tres vídeos…':'GENERAR LOS 3 VÍDEOS'}</button>
   <p className="muted-copy">Formato vertical · Animación dibujada por código · Voz masculina española · Música y efectos · MP4</p>
  </section>
  <div className="studio-columns"><section className="studio-card"><div className="card-kicker">IDEAS / HOY</div><h2>Temas generados ({todays.length})</h2>{todays.length?todays.map(s=><article className="data-row" key={s.id}><div><b>{s.title}</b><small>{fmt(s.created_at)} · {(s.source_notes||[]).length} fuentes</small></div><Status value={s.status}/></article>):<Empty text="Todavía no se ha generado ningún tema hoy."/>}</section><section className="studio-card"><div className="card-kicker">ESTADO DEL MOTOR</div><h2>Producción automática</h2><div className="pipeline"><span>Idea + fuentes</span><i>→</i><span>Guion</span><i>→</i><span>Voz</span><i>→</i><span>Animación</span><i>→</i><span>Sonido</span><i>→</i><span>MP4</span></div><p className="muted-copy">Narrador masculino es-ES-AlvaroNeural. Música ambiental y efectos originales generados por código. Publicación automática desactivada: todos los vídeos quedan privados para revisión.</p><button className="ghost-button" onClick={addExclusion}>＋ Excluir un tema</button></section></div>
  <section className="studio-card"><div className="card-kicker">BIBLIOTECA / VÍDEOS MP4</div><h2>Últimos vídeos ({videos.length})</h2><div className="video-grid">{latest.map(v=><article className="video-card" key={v.id}>{signed[v.id]?<video controls playsInline preload="metadata" src={signed[v.id]}/>:<div className="video-placeholder">VÍDEO PRIVADO</div>}<b>{v.storage_path.split('/').pop()}</b><small>{fmt(v.created_at)} · {v.duration_seconds||'—'} s · {v.width}×{v.height}</small>{signed[v.id]&&<a href={signed[v.id]} target="_blank" rel="noreferrer">Abrir MP4 ↗</a>}<div className="social-status-list">{posts.filter(p=>p.video_id===v.id).map(p=><div className="social-status" key={p.id}><span>{p.platform==='youtube'?'YouTube':'TikTok'}</span><Status value={p.status}/>{p.error_message&&<small>{p.error_message}</small>}</div>)}</div></article>)}</div>{!videos.length&&<Empty text="Los vídeos terminados aparecerán aquí para reproducirlos y revisarlos."/>}</section>
  <section className="studio-card"><div className="card-kicker">MEMORIA EDITORIAL</div><h2>Temas ya tratados y excluidos</h2>{memory.slice(0,12).map(x=><div className="data-row" key={x.id}><div><b>{x.topic}</b><small>{x.angle||'Sin enfoque registrado'} · {fmt(x.created_at)}</small></div><Status value={x.memory_status}/></div>)}{!memory.length&&<Empty text="La memoria se irá completando con cada vídeo."/>}</section>
  <footer className="studio-footer">BEHIND DEL MUNDO © 2026 · DESCUBRE LO QUE HAY DETRÁS <span>Panel privado · {session.user.email}</span></footer>
 </main>;
}
function Metric({label,value,note}:{label:string,value:any,note:string}){return <article className="metric-card"><small>{label}</small><strong>{value}</strong><span>{note}</span></article>}
function Status({value}:{value:string}){return <span className={'status status-'+String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-')}>{value}</span>}
function Empty({text}:{text:string}){return <div className="empty-state">{text}</div>}
