'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase-browser';

type Slot={id:string,time:string,label:string,description:string};
const slots:Slot[]=[
 {id:'how-it-works',time:'07:30',label:'Cómo funciona',description:'Objetos, máquinas y fenómenos cotidianos'},
 {id:'inside',time:'14:30',label:'Por dentro',description:'Lugares, edificios e instalaciones desde dentro'},
 {id:'curiosities',time:'20:30',label:'Curiosidades',description:'Sabías que, preguntas y hechos sorprendentes'}
];
const fmt=(v:string)=>new Date(v).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'});
export default function Studio(){
 const db=supabase();
 const [session,setSession]=useState<any>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false);
 const [scripts,setScripts]=useState<any[]>([]),[jobs,setJobs]=useState<any[]>([]),[videos,setVideos]=useState<any[]>([]),[memory,setMemory]=useState<any[]>([]);
 const [signed,setSigned]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[dispatching,setDispatching]=useState<string|null>(null),[message,setMessage]=useState('');
 const load=useCallback(async()=>{
  if(!session)return;
  setBusy(true);
  const [s,j,v,m]=await Promise.all([
   db.from('scripts').select('id,title,hook,narration,status,created_at,source_notes').order('created_at',{ascending:false}).limit(18),
   db.from('production_jobs').select('id,status,error_message,started_at,completed_at,scheduled_for,script_id').order('created_at',{ascending:false}).limit(18),
   db.from('videos').select('id,storage_path,duration_seconds,width,height,quality_check,created_at').order('created_at',{ascending:false}).limit(12),
   db.from('editorial_memory').select('id,topic,angle,memory_status,created_at').order('created_at',{ascending:false}).limit(40)
  ]);
  const error=s.error||j.error||v.error||m.error;
  if(error)setMessage('No se han podido cargar todos los datos: '+error.message);
  setScripts(s.data||[]);setJobs(j.data||[]);setVideos(v.data||[]);setMemory(m.data||[]);
  setBusy(false);
 },[session]);
 useEffect(()=>{db.auth.getSession().then(({data}:any)=>setSession(data.session));const {data}=db.auth.onAuthStateChange((_e:any,s:any)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{if(!session||!jobs.some(j=>['queued','voicing','rendering'].includes(j.status)))return;const timer=window.setInterval(load,20000);return()=>window.clearInterval(timer)},[session,jobs,load]);
 useEffect(()=>{let active=true;(async()=>{const next:Record<string,string>={};for(const v of videos){const {data}=await db.storage.from('nexo-videos').createSignedUrl(v.storage_path,3600);if(data?.signedUrl)next[v.id]=data.signedUrl;}if(active)setSigned(next)})();return()=>{active=false}},[videos]);
 async function auth(e:any){e.preventDefault();const r=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});setMessage(r.error?.message||(signup?'Revisa tu correo para confirmar la cuenta.':'Sesión iniciada.'))}
 async function generate(slot:string){
  setDispatching(slot);setMessage('');
  try{
   const {data:{session:active}}=await db.auth.getSession();
   const r=await fetch('/api/production/dispatch',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+active?.access_token},body:JSON.stringify({slot})});
   const result=await r.json();if(!r.ok)throw new Error(result.error||'No se pudo iniciar la generación.');
   setMessage('Generación solicitada. El tema, el guion, la voz y el vídeo se crearán en el servidor. No se publicará automáticamente.');
   await load();
  }catch(e:any){setMessage(e?.message||'Error al iniciar el vídeo.')}
  finally{setDispatching(null)}
 }
 async function addExclusion(){
  const topic=window.prompt('¿Qué tema quieres excluir de futuras ideas?');if(!topic?.trim())return;
  const {error}=await db.from('editorial_memory').insert({user_id:session.user.id,topic:topic.trim(),topic_key:topic.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-'),angle:'Exclusión manual',summary:'Tema excluido desde el panel',source_urls:[],memory_status:'rejected',reason:'Excluido manualmente'});
  if(error)setMessage(error.message);else{setMessage('Tema añadido a exclusiones.');await load()}
 }
 if(!session)return <main className="auth-shell"><a className="brand" href="/"><span className="brand-mark brand-mark-world"><img src="/brand-mark.svg" alt=""/></span><span>BEHIND <b>DEL MUNDO</b><small>STUDIO / ACCESO</small></span></a><section className="auth-card"><div className="eyebrow">CENTRO DE PRODUCCIÓN</div><h1>{signup?'Crea tu acceso.':'Vuelve al estudio.'}</h1><p>Accede al panel privado de Behind del Mundo.</p><form onSubmit={auth}><label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><button>{signup?'Crear cuenta':'Entrar'}</button></form><button className="link-button" onClick={()=>setSignup(!signup)}>{signup?'Ya tengo cuenta · Entrar':'Crear una cuenta'}</button>{message&&<p className="notice">{message}</p>}</section></main>;
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Madrid'});
 const todays=scripts.filter(s=>new Date(s.created_at).toLocaleDateString('en-CA',{timeZone:'Europe/Madrid'})===today);
 const ready=videos.length,failed=jobs.filter(j=>j.status==='failed').length,active=jobs.filter(j=>['queued','voicing','rendering'].includes(j.status)).length;
 const latest=videos.slice(0,6);
 return <main className="studio-shell">
  <header className="studio-top"><a className="brand" href="/"><span className="brand-mark brand-mark-world"><img src="/brand-mark.svg" alt=""/></span><span>BEHIND <b>DEL MUNDO</b><small>STUDIO / CONTROL ROOM</small></span></a><div className="top-actions"><span className="user-email">{session.user.email}</span><button className="ghost-button" onClick={load}>{busy?'Actualizando…':'↻ Actualizar'}</button><button className="ghost-button" onClick={()=>db.auth.signOut()}>Salir</button></div></header>
  <section className="studio-heading"><div><div className="eyebrow">NUEVA LÍNEA EDITORIAL / EUROPE-MADRID</div><h1>Centro de <em>producción.</em></h1><p>Tres historias distintas al día. Investigación, animación, voz y sonido.</p></div><div className="system-pill"><i/> MOTOR PYTHON / PILLOW / FFMPEG</div></section>
  {message&&<div className="studio-message">{message}<button onClick={()=>setMessage('')}>×</button></div>}
  <div className="metric-grid"><Metric label="Vídeos guardados" value={ready} note="Biblioteca privada"/><Metric label="En producción" value={active} note="Trabajos activos"/><Metric label="Fallidos" value={failed} note="Requieren revisión"/><Metric label="Temas recordados" value={memory.length} note="Memoria editorial"/></div>
  <section className="studio-card"><div className="card-kicker">CALENDARIO / TRES VÍDEOS DIARIOS</div><h2>Las tres historias del día</h2><div className="schedule-row"><b>07:30</b><div><span>Cómo funciona</span><small>Objetos, mecanismos, tecnología y fenómenos cotidianos</small></div><span className="status">DIARIO</span></div><div className="schedule-row"><b>14:30</b><div><span>Por dentro</span><small>Edificios, lugares, instalaciones y transportes desde dentro</small></div><span className="status">DIARIO</span></div><div className="schedule-row"><b>20:30</b><div><span>Curiosidades</span><small>Sabías que, preguntas sorprendentes y porqués</small></div><span className="status">DIARIO</span></div><p className="muted-copy">Cada franja genera un tema diferente y evita repetir los ya publicados. Puedes iniciar una prueba manualmente; la programación automática se activará cuando validemos los primeros renders.</p><div className="button-row">{slots.map(s=><button key={s.id} className="primary-button" disabled={!!dispatching||busy} onClick={()=>generate(s.id)}>{dispatching===s.id?'Iniciando…':'Probar: '+s.label}</button>)}</div></section>
  <div className="studio-columns"><section className="studio-card"><div className="card-kicker">IDEAS / HOY</div><h2>Temas generados ({todays.length})</h2>{todays.length?todays.map(s=><article className="data-row" key={s.id}><div><b>{s.title}</b><small>{fmt(s.created_at)} · {(s.source_notes||[]).length} fuentes</small></div><Status value={s.status}/></article>):<Empty text="Todavía no se ha generado ningún tema hoy."/>}</section><section className="studio-card"><div className="card-kicker">ESTADO DEL MOTOR</div><h2>Producción automática</h2><div className="pipeline"><span>Idea + fuentes</span><i>→</i><span>Guion</span><i>→</i><span>Voz</span><i>→</i><span>Animación</span><i>→</i><span>Sonido</span><i>→</i><span>MP4</span></div><p className="muted-copy">Narrador masculino es-ES-AlvaroNeural. Música ambiental y efectos originales generados por código. Publicación automática desactivada: todos los vídeos quedan privados para revisión.</p><button className="ghost-button" onClick={addExclusion}>＋ Excluir un tema</button></section></div>
  <section className="studio-card"><div className="card-kicker">BIBLIOTECA / VÍDEOS MP4</div><h2>Últimos vídeos ({videos.length})</h2><div className="video-grid">{latest.map(v=><article className="video-card" key={v.id}>{signed[v.id]?<video controls playsInline preload="metadata" src={signed[v.id]}/>:<div className="video-placeholder">VÍDEO PRIVADO</div>}<b>{v.storage_path.split('/').pop()}</b><small>{fmt(v.created_at)} · {v.duration_seconds||'—'} s · {v.width}×{v.height}</small>{signed[v.id]&&<a href={signed[v.id]} target="_blank" rel="noreferrer">Abrir MP4 ↗</a>}</article>)}</div>{!videos.length&&<Empty text="Los vídeos terminados aparecerán aquí para reproducirlos y revisarlos."/>}</section>
  <section className="studio-card"><div className="card-kicker">MEMORIA EDITORIAL</div><h2>Temas ya tratados y excluidos</h2>{memory.slice(0,12).map(x=><div className="data-row" key={x.id}><div><b>{x.topic}</b><small>{x.angle||'Sin enfoque registrado'} · {fmt(x.created_at)}</small></div><Status value={x.memory_status}/></div>)}{!memory.length&&<Empty text="La memoria se irá completando con cada vídeo."/>}</section>
  <footer className="studio-footer">BEHIND DEL MUNDO © 2026 · DESCUBRE LO QUE HAY DETRÁS <span>Panel privado · {session.user.email}</span></footer>
 </main>;
}
function fmt(v:string){return new Date(v).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'})}
function Metric({label,value,note}:{label:string,value:any,note:string}){return <article className="metric-card"><small>{label}</small><strong>{value}</strong><span>{note}</span></article>}
function Status({value}:{value:string}){return <span className={'status status-'+String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-')}>{value}</span>}
function Empty({text}:{text:string}){return <div className="empty-state">{text}</div>}
