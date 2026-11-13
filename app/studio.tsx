'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase-browser';

const fmt=(v:string)=>new Date(v).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'});
export default function Studio(){
 const db=supabase();
 const [session,setSession]=useState<any>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false);
 const [jobs,setJobs]=useState<any[]>([]),[videos,setVideos]=useState<any[]>([]),[posts,setPosts]=useState<any[]>([]),[social,setSocial]=useState({youtube:false,tiktok:false});
 const [signed,setSigned]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[dispatching,setDispatching]=useState(false),[message,setMessage]=useState(''),[prompt1,setPrompt1]=useState(''),[prompt2,setPrompt2]=useState(''),[prompt3,setPrompt3]=useState('');
 const load=useCallback(async()=>{
  if(!session)return;
  setBusy(true);
  const [j,v,p]=await Promise.all([
   db.from('production_jobs').select('id,status,error_message,started_at,completed_at,scheduled_for,script_id').order('created_at',{ascending:false}).limit(18),
   db.from('videos').select('id,storage_path,duration_seconds,width,height,quality_check,created_at').order('created_at',{ascending:false}).limit(12),
   db.from('social_posts').select('id,video_id,platform,status,external_post_id,error_message,created_at').order('created_at',{ascending:false}).limit(60)
  ]);
  const error=j.error||v.error||p.error;
  if(error)setMessage('No se han podido cargar todos los datos: '+error.message);
  setJobs(j.data||[]);setVideos(v.data||[]);setPosts(p.data||[]);
  const socialResponse=await fetch('/api/social/status',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
  if(socialResponse.ok)setSocial(await socialResponse.json());
  setBusy(false);
 },[session]);
 useEffect(()=>{db.auth.getSession().then(({data}:any)=>setSession(data.session));const {data}=db.auth.onAuthStateChange((_e:any,s:any)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const result=params.get('result');const platform=params.get('social');if(result){setMessage(result==='connected'?'Cuenta '+(platform==='youtube'?'YouTube':'TikTok')+' conectada correctamente.':result==='cancelled'?'Se canceló la conexión social.':'No se pudo completar la conexión social. Revisa las credenciales OAuth.');window.history.replaceState({},'',window.location.pathname)}},[]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{if(!session||(!jobs.some(j=>['queued','voicing','rendering','publishing'].includes(j.status))&&!posts.some(p=>p.status==='publishing')))return;const timer=window.setInterval(load,20000);return()=>window.clearInterval(timer)},[session,jobs,posts,load]);
 useEffect(()=>{let active=true;(async()=>{const next:Record<string,string>={};for(const v of videos){const {data}=await db.storage.from('nexo-videos').createSignedUrl(v.storage_path,3600);if(data?.signedUrl)next[v.id]=data.signedUrl;}if(active)setSigned(next)})();return()=>{active=false}},[videos]);
 async function auth(e:any){e.preventDefault();const r=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});setMessage(r.error?.message||(signup?'Revisa tu correo para confirmar la cuenta.':'Sesión iniciada.'))}
 async function connectSocial(platform:'youtube'|'tiktok'){
  try{
   const r=await fetch('/api/social/connect/'+platform,{method:'POST',headers:{Authorization:'Bearer '+session.access_token}});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo iniciar la conexión.');
   window.location.href=data.url;
  }catch(e:any){setMessage(e?.message||'Error conectando la cuenta.')}
 }
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
 if(!session)return <main className="auth-shell"><a className="brand" href="/"><span className="brand-mark brand-mark-world"><img src="/brand-mark.svg" alt=""/></span><span>BEHIND <b>DEL MUNDO</b><small>STUDIO / ACCESO</small></span></a><section className="auth-card"><div className="eyebrow">CENTRO DE PRODUCCIÓN</div><h1>{signup?'Crea tu acceso.':'Vuelve al estudio.'}</h1><p>Accede al panel privado de Behind del Mundo.</p><form onSubmit={auth}><label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><button>{signup?'Crear cuenta':'Entrar'}</button></form><button className="link-button" onClick={()=>setSignup(!signup)}>{signup?'Ya tengo cuenta · Entrar':'Crear una cuenta'}</button>{message&&<p className="notice">{message}</p>}</section></main>;
 const ready=videos.length,failed=jobs.filter(j=>j.status==='failed').length,active=jobs.filter(j=>['queued','voicing','rendering','publishing'].includes(j.status)).length;
 const latest=videos.slice(0,6);
 return <main className="studio-shell">
  <header className="studio-top"><a className="brand" href="/"><span className="brand-mark brand-mark-world"><img src="/brand-mark.svg" alt=""/></span><span>BEHIND <b>DEL MUNDO</b><small>STUDIO / CONTROL ROOM</small></span></a><div className="top-actions"><span className="user-email">{session.user.email}</span><button className="ghost-button" onClick={load}>{busy?'Actualizando…':'↻ Actualizar'}</button><button className="ghost-button" onClick={()=>db.auth.signOut()}>Salir</button></div></header>
  <section className="studio-heading"><div><div className="eyebrow">TUS TRES IDEAS / UN SOLO ENVÍO</div><h1>Centro de <em>producción.</em></h1><p>Pega los tres guiones técnicos que te preparo y el motor los convierte en vídeos completos.</p></div><div className="system-pill"><i/> MOTOR PYTHON / PILLOW / FFMPEG</div></section>
  {message&&<div className="studio-message">{message}<button onClick={()=>setMessage('')}>×</button></div>}
  <div className="metric-grid"><Metric label="Vídeos guardados" value={ready} note="Biblioteca privada"/><Metric label="En producción" value={active} note="Trabajos activos"/><Metric label="Fallidos" value={failed} note="Requieren revisión"/></div>
  <section className="studio-card social-connect-card">
   <div className="card-kicker">PUBLICACIÓN / CUENTAS CONECTADAS</div><h2>Conecta tus canales</h2>
   <p className="muted-copy">Autoriza una vez cada cuenta. Después, los vídeos se enviarán automáticamente al terminar.</p>
   <div className="social-connect-actions">
    <div><span>YouTube</span><b className={social.youtube?'connected':'not-connected'}>{social.youtube?'Conectado':'Sin conectar'}</b><button className="ghost-button" onClick={()=>connectSocial('youtube')}>{social.youtube?'Volver a conectar':'Conectar YouTube'}</button></div>
    <div><span>TikTok</span><b className={social.tiktok?'connected':'not-connected'}>{social.tiktok?'Conectado':'Sin conectar'}</b><button className="ghost-button" onClick={()=>connectSocial('tiktok')}>{social.tiktok?'Volver a conectar':'Conectar TikTok'}</button></div>
   </div>
   <small className="muted-copy">TikTok puede limitar las publicaciones a privadas hasta que su aplicación supere la auditoría oficial.</small>
  </section>
  <section className="studio-card prompt-studio">
   <div className="card-kicker">CREACIÓN / TUS TRES VÍDEOS</div><h2>Prepara los vídeos de hoy</h2>
   <p className="muted-copy">Pega los tres guiones técnicos JSON completos que te preparo. La narración será cercana, fácil de entender y con ganchos; cada escena define fondo, acción, cámara y objetos concretos. Los subtítulos aparecen por frases cortas sincronizadas con la voz. El motor no utiliza IA generativa ni consume tokens.</p>
   <label>Vídeo 1 · Guion técnico JSON<textarea rows={3} value={prompt1} onChange={e=>setPrompt1(e.target.value)} placeholder='Pega aquí el JSON completo del vídeo 1…' maxLength={45000}/></label>
   <label>Vídeo 2 · Guion técnico JSON<textarea rows={3} value={prompt2} onChange={e=>setPrompt2(e.target.value)} placeholder='Pega aquí el JSON completo del vídeo 2…' maxLength={45000}/></label>
   <label>Vídeo 3 · Guion técnico JSON<textarea rows={3} value={prompt3} onChange={e=>setPrompt3(e.target.value)} placeholder='Pega aquí el JSON completo del vídeo 3…' maxLength={45000}/></label>
   <button className="primary-button" disabled={dispatching||busy||[prompt1,prompt2,prompt3].some(x=>x.trim().length<12)} onClick={generateAll}>{dispatching?'Enviando los tres vídeos…':'GENERAR LOS 3 VÍDEOS'}</button>
   <p className="muted-copy">Sin Groq ni claves de IA · Voz masculina española · Animación por código · Música, efectos y subtítulos · MP4</p>
  </section>
  <section className="studio-card"><div className="card-kicker">BIBLIOTECA / VÍDEOS MP4</div><h2>Últimos vídeos ({videos.length})</h2><div className="video-grid">{latest.map(v=><article className="video-card" key={v.id}>{signed[v.id]?<video controls playsInline preload="metadata" src={signed[v.id]}/>:<div className="video-placeholder">VÍDEO PRIVADO</div>}<b>{v.storage_path.split('/').pop()}</b><small>{fmt(v.created_at)} · {v.duration_seconds||'—'} s · {v.width}×{v.height}</small>{signed[v.id]&&<a href={signed[v.id]} target="_blank" rel="noreferrer">Abrir MP4 ↗</a>}<div className="social-status-list">{posts.filter(p=>p.video_id===v.id).map(p=><div className="social-status" key={p.id}><span>{p.platform==='youtube'?'YouTube':'TikTok'}</span><Status value={p.status}/>{p.platform==='youtube'&&p.external_post_id&&<a href={'https://youtu.be/'+p.external_post_id} target="_blank" rel="noreferrer">Ver vídeo ↗</a>}{p.error_message&&<small>{p.error_message}</small>}</div>)}</div></article>)}</div>{!videos.length&&<Empty text="Los vídeos terminados aparecerán aquí para reproducirlos y revisarlos."/>}</section>
  <footer className="studio-footer">BEHIND DEL MUNDO © 2026 · DESCUBRE LO QUE HAY DETRÁS <span>Panel privado · {session.user.email}</span></footer>
 </main>;
}
function Metric({label,value,note}:{label:string,value:any,note:string}){return <article className="metric-card"><small>{label}</small><strong>{value}</strong><span>{note}</span></article>}
function Status({value}:{value:string}){return <span className={'status status-'+String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-')}>{value}</span>}
function Empty({text}:{text:string}){return <div className="empty-state">{text}</div>}
