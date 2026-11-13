'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase-browser';

type Tab='overview'|'import'|'scripts'|'memory'|'videos'|'posts'|'stats'|'settings';
const tabs:{id:Tab,label:string}[]=[{id:'overview',label:'Resumen'},{id:'import',label:'Importar guiones'},{id:'scripts',label:'Guiones'},{id:'memory',label:'Memoria editorial'},{id:'videos',label:'Vídeos'},{id:'posts',label:'Publicaciones'},{id:'stats',label:'Estadísticas'},{id:'settings',label:'Sistema'}];
const fmt=(v:string)=>new Date(v).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'});
const stamp=(v:string)=>new Date(v).toLocaleDateString('es-ES');
export default function Studio(){
 const [session,setSession]=useState<any>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState<Tab>('overview');
 const [jobs,setJobs]=useState<any[]>([]),[scripts,setScripts]=useState<any[]>([]),[memory,setMemory]=useState<any[]>([]),[videos,setVideos]=useState<any[]>([]),[posts,setPosts]=useState<any[]>([]),[analytics,setAnalytics]=useState<any[]>([]),[settings,setSettings]=useState<any>(null),[series,setSeries]=useState<any[]>([]);
 const [selectedScript,setSelectedScript]=useState<any>(null),[signed,setSigned]=useState<Record<string,string>>({}),[memoryTopic,setMemoryTopic]=useState(''),[memoryReason,setMemoryReason]=useState('');
 const [scriptBatch,setScriptBatch]=useState(['','','']),[zipName,setZipName]=useState(''),[dispatching,setDispatching]=useState(false),[knownReady,setKnownReady]=useState<string[]>([]),[notifyEnabled,setNotifyEnabled]=useState(false),[dispatchConfigured,setDispatchConfigured]=useState<boolean|null>(null);
 const db=supabase();
 const videoIdsRef=useRef<string[]>([]),videoLoadRef=useRef(false),jobIdsRef=useRef<string[]>([]),jobLoadRef=useRef(false);
 useEffect(()=>{fetch('/api/health').then(r=>r.json()).then(data=>setDispatchConfigured(data.productionDispatch==='configured')).catch(()=>setDispatchConfigured(false));db.auth.getSession().then(({data}:any)=>setSession(data.session));const {data}=db.auth.onAuthStateChange((_e:any,s:any)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 const load=useCallback(async()=>{
  if(!session)return;setBusy(true);setMessage('');
  const [j,s,v,p,a,c,ser,m]=await Promise.all([
   db.from('production_jobs').select('id,status,error_message,attempt_count,started_at,completed_at,script_id').order('created_at',{ascending:false}).limit(50),
   db.from('scripts').select('id,title,hook,narration,visual_plan,source_notes,target_seconds,status,created_at,series_id').order('created_at',{ascending:false}).limit(60),
   db.from('videos').select('id,job_id,script_id,storage_path,duration_seconds,width,height,mime_type,quality_check,created_at').order('created_at',{ascending:false}).limit(60),
   db.from('social_posts').select('id,video_id,platform,caption,status,scheduled_for,published_at,error_message,created_at').order('created_at',{ascending:false}).limit(60),
   db.from('social_analytics').select('id,social_post_id,views,likes,comments,shares,average_view_duration_seconds,retention_percent,captured_at').order('captured_at',{ascending:false}).limit(100),
   db.from('channel_settings').select('channel_name,monthly_budget_cents,require_approval,auto_publish_enabled,content_locale').eq('brand_slug','nexo-raro').maybeSingle(),
   db.from('series').select('id,slug,title,description,is_active').order('slug'),
   db.from('editorial_memory').select('id,topic,topic_key,angle,summary,source_urls,memory_status,created_at').order('created_at',{ascending:false}).limit(1000)
  ]);
  const err=j.error||s.error||v.error||p.error||a.error||c.error||ser.error||m.error;
  if(err)setMessage('Error al cargar datos: '+err.message);
  const nextJobs=j.data||[],newFailed=nextJobs.filter((item:any)=>item.status==='failed'&&!jobIdsRef.current.includes(item.id));
  if(jobLoadRef.current&&newFailed.length&&typeof window!=='undefined'&&'Notification' in window&&Notification.permission==='granted'){new Notification('BEHIND DEL MUNDO',{body:'Un vídeo ha fallado. Abre el panel para ver el error y reintentarlo.'});}
  jobIdsRef.current=nextJobs.map((item:any)=>item.id);jobLoadRef.current=true;setJobs(nextJobs);setScripts(s.data||[]);setMemory(m.data||[]);
  const nextVideos=v.data||[],newVideos=nextVideos.filter((item:any)=>!videoIdsRef.current.includes(item.id));
  if(videoLoadRef.current&&newVideos.length&&typeof window!=='undefined'&&'Notification' in window&&Notification.permission==='granted'){new Notification('BEHIND DEL MUNDO',{body:newVideos.length===1?'Tu vídeo ya está listo para revisar.':'Tus vídeos ya están listos para revisar.'});}
  videoIdsRef.current=nextVideos.map((item:any)=>item.id);videoLoadRef.current=true;setVideos(nextVideos);setPosts(p.data||[]);setAnalytics(a.data||[]);setSettings(c.data);setSeries(ser.data||[]);
  setBusy(false);
 },[session]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{const active=scripts.some(s=>['queued','in_production'].includes(s.status))||jobs.some(j=>['queued','voicing','rendering','quality_check'].includes(j.status));if(!session||!active)return;const timer=window.setInterval(()=>{load()},20000);return()=>window.clearInterval(timer)},[session,scripts,jobs,load]);
 useEffect(()=>{if(!selectedScript&&scripts.length)setSelectedScript(scripts[0]);else if(selectedScript){const fresh=scripts.find(x=>x.id===selectedScript.id);if(fresh)setSelectedScript(fresh)}},[scripts]);
 useEffect(()=>{let active=true;(async()=>{const next:Record<string,string>={};for(const v of videos.slice(0,20)){const {data}=await db.storage.from('nexo-videos').createSignedUrl(v.storage_path,3600);if(data?.signedUrl)next[v.id]=data.signedUrl;}if(active)setSigned(next)})();return()=>{active=false}},[videos]);
 async function enableNotifications(){if(!('Notification' in window)){setMessage('Este navegador no admite notificaciones.');return;}const permission=await Notification.requestPermission();setMessage(permission==='granted'?'Avisos activados en este dispositivo.':'No se han concedido permisos de notificación.');}
 async function submit(e:any){e.preventDefault();setMessage('');const r=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});setMessage(r.error?.message||(signup?'Revisa tu correo para confirmar la cuenta.':'Sesión iniciada.'))}
 async function addMemoryTopic(e:any){e.preventDefault();const topic=memoryTopic.trim();if(!topic)return;setBusy(true);const topicKey=topic.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');const {error}=await db.from('editorial_memory').insert({user_id:session.user.id,topic,topic_key:topicKey,angle:'Exclusión manual',summary:'Tema excluido desde el panel',source_urls:[],memory_status:'rejected',reason:memoryReason.trim()||'No volver a tratar este tema'});if(error)setMessage('No se pudo guardar el tema: '+error.message);else{setMemoryTopic('');setMemoryReason('');setMessage('Tema añadido a la lista de exclusión.');await load()}setBusy(false)}
 async function unzipJsonFiles(file:File):Promise<string[]>{
  if(!file.name.toLowerCase().endsWith('.zip'))throw new Error('Selecciona un archivo .zip.');
  if(file.size>12*1024*1024)throw new Error('El ZIP supera el límite de 12 MB.');
  const bytes=await file.arrayBuffer(),view=new DataView(bytes),u8=new Uint8Array(bytes);
  let eocd=-1;
  for(let p=u8.length-22;p>=Math.max(0,u8.length-65557);p--){if(view.getUint32(p,true)===0x06054b50){eocd=p;break;}}
  if(eocd<0)throw new Error('El ZIP está dañado o no tiene un directorio válido.');
  const count=view.getUint16(eocd+10,true),centralOffset=view.getUint32(eocd+16,true);
  if(count>100)throw new Error('El ZIP contiene demasiados archivos.');
  const found:string[]=[];let cursor=centralOffset;
  for(let n=0;n<count;n++){
   if(view.getUint32(cursor,true)!==0x02014b50)throw new Error('El índice interno del ZIP está dañado.');
   const method=view.getUint16(cursor+10,true),compressedSize=view.getUint32(cursor+20,true),nameLen=view.getUint16(cursor+28,true),extraLen=view.getUint16(cursor+30,true),commentLen=view.getUint16(cursor+32,true),localOffset=view.getUint32(cursor+42,true);
   const name=new TextDecoder().decode(u8.slice(cursor+46,cursor+46+nameLen));cursor+=46+nameLen+extraLen+commentLen;
   if(name.endsWith('/')||!name.toLowerCase().endsWith('.json'))continue;
   if(found.length>=3)throw new Error('El ZIP debe contener exactamente tres JSON, no más.');
   if(compressedSize>3*1024*1024)throw new Error('Uno de los JSON supera el límite permitido.');
   if(view.getUint32(localOffset,true)!==0x04034b50)throw new Error('Uno de los archivos del ZIP está dañado.');
   const localName=view.getUint16(localOffset+26,true),localExtra=view.getUint16(localOffset+28,true),dataStart=localOffset+30+localName+localExtra;
   const compressed=u8.slice(dataStart,dataStart+compressedSize);let plain:Uint8Array;
   if(method===0)plain=compressed;
   else if(method===8){
    if(typeof DecompressionStream==='undefined')throw new Error('Este navegador no permite descomprimir ZIP. Actualiza Chrome.');
    const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat));
    plain=new Uint8Array(await new Response(stream).arrayBuffer());
   }else throw new Error('El ZIP usa un método de compresión no compatible.');
   found.push(new TextDecoder('utf-8',{fatal:true}).decode(plain));
  }
  if(found.length!==3)throw new Error('El ZIP debe incluir exactamente tres archivos .json. Se han encontrado '+found.length+'.');
  return found;
 }
 function parseExternalScript(raw:string,index:number){
  const cleaned=raw.replace(/^\uFEFF/,'').trim().replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'').trim();
  let parsed:any;try{parsed=JSON.parse(cleaned)}catch(error:any){throw new Error('El JSON '+(index+1)+' no es válido ('+(error instanceof Error?error.message:'sintaxis incorrecta')+').');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('El JSON '+(index+1)+' debe contener un único objeto.');
  for(const key of ['title','hook','narration','scenes','sources','caption','category','models'])if(!(key in parsed))throw new Error('Al JSON '+(index+1)+' le falta el campo '+key+'.');
  const words=String(parsed.narration||'').trim().split(/\\s+/).filter(Boolean).length;
  if(words<145||words>205)throw new Error('El guion '+(index+1)+' tiene '+words+' palabras; debe tener entre 145 y 205.');
  if(!Array.isArray(parsed.scenes)||parsed.scenes.length!==14)throw new Error('El guion '+(index+1)+' debe incluir exactamente 14 escenas.');
  if(!Array.isArray(parsed.sources)||parsed.sources.length<3)throw new Error('El guion '+(index+1)+' necesita al menos 3 fuentes.');
  if(!parsed.models||typeof parsed.models!=='object'||!Object.keys(parsed.models).length)throw new Error('El guion '+(index+1)+' no incluye su catálogo de modelos 3D.');
  for(const [sceneIndex,scene] of parsed.scenes.entries()){
   if(!scene.visual||String(scene.visual).length<100||!['landscape','architecture','science','ocean','space','history','object','abstract'].includes(scene.scene_type)||!scene.setting||String(scene.setting).length<40||!scene.action||String(scene.action).length<35||!scene.camera||String(scene.camera).length<15||!scene.continuity||String(scene.continuity).length<20||!Array.isArray(scene.entities)||scene.entities.length<2||!scene.narration_excerpt)throw new Error('La escena '+(sceneIndex+1)+' del guion '+(index+1)+' está incompleta.');
   if(!String(parsed.narration).includes(scene.narration_excerpt))throw new Error('El fragmento de narración de la escena '+(sceneIndex+1)+' no coincide literalmente.');
   for(const entity of scene.entities){const model=parsed.models[entity.model_id];if(!entity.model_id||!model||model.version!==1||!Array.isArray(model.parts)||!model.parts.length||!Array.isArray(model.animations))throw new Error('La entidad '+(entity.name||entity.id)+' de la escena '+(sceneIndex+1)+' no tiene un blueprint 3D completo en el JSON.');}
  }
  for(const source of parsed.sources){try{const u=new URL(source.url);if(u.protocol!=='https:')throw 0}catch{throw new Error('Una fuente del guion '+(index+1)+' no tiene una URL HTTPS válida.');}}
  return parsed;
 }
 async function importAndProduce(){
  setDispatching(true);setMessage('');
  try{
   const parsed=scriptBatch.map((raw,i)=>parseExternalScript(raw,i));
   const titles=parsed.map(x=>String(x.title).trim());
   if(new Set(titles.map(x=>x.toLowerCase())).size!==3)throw new Error('Los tres guiones deben tener títulos distintos.');
   const {data:seriesRows,error:seriesError}=await db.from('series').select('id,slug').eq('is_active',true).order('slug');
   if(seriesError)throw seriesError;
   const rows=parsed.map((item,i)=>({user_id:session.user.id,series_id:seriesRows?.find((x:any)=>x.slug===item.category)?.id||seriesRows?.[i%Math.max(seriesRows.length,1)]?.id||null,title:item.title,hook:item.hook,narration:item.narration,visual_plan:{scenes:item.scenes,models:item.models},source_notes:item.sources,target_seconds:70,status:'in_production'}));
   const {data:created,error}=await db.from('scripts').insert(rows).select('id');
   if(error)throw error;
   if(!created||created.length!==3)throw new Error('No se pudieron guardar los tres guiones completos.');
   const {data:{session:activeSession}}=await db.auth.getSession();
   const response=await fetch('/api/production/dispatch',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+activeSession?.access_token},body:JSON.stringify({scriptIds:created.map((x:any)=>x.id)})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'GitHub no aceptó la producción.');
   setMessage('Los tres JSON se han importado y los vídeos han entrado en producción. No se publicará nada automáticamente.');
   setScriptBatch(['','','']);setZipName('');await load();
  }catch(error:any){setMessage(error?.message||'No se pudieron importar los guiones.');}
  finally{setDispatching(false)}
 }
 async function handleZip(file?:File){
  if(!file)return;setDispatching(true);setMessage('');
  try{const contents=await unzipJsonFiles(file);const parsed=contents.map((raw,i)=>parseExternalScript(raw,i));const titles=parsed.map(x=>String(x.title).trim());if(new Set(titles.map(x=>x.toLowerCase())).size!==3)throw new Error('Los tres JSON deben tener títulos distintos.');setScriptBatch(contents);setZipName(file.name);setMessage('ZIP leído correctamente: '+parsed.map(x=>x.title).join(' · ')+'. Ya puedes iniciar la producción.');}
  catch(error:any){setScriptBatch(['','','']);setZipName('');setMessage(error?.message||'No se pudo leer el ZIP.');}
  finally{setDispatching(false)}
 }
 async function retryScript(id:string){
  setBusy(true);setMessage('');
  try{
   const {data:{session:activeSession}}=await db.auth.getSession();
   const response=await fetch('/api/production/dispatch',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+activeSession?.access_token},body:JSON.stringify({scriptIds:[id]})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo iniciar el reintento.');
   setMessage('Reintento enviado a producción.');await load();
  }catch(error:any){setMessage(error?.message||'No se pudo reintentar el vídeo.');}
  finally{setBusy(false)}
 }
 async function updateScript(id:string,patch:any){setBusy(true);const {error}=await db.from('scripts').update(patch).eq('id',id);if(error)setMessage(error.message);else{setMessage('Guion actualizado.');await load()}setBusy(false)}
 async function updatePost(id:string,status:string){if(status==='manual_action_required'&&!window.confirm('¿Preparar este borrador para publicación manual? No se enviará automáticamente.'))return;setBusy(true);const {error}=await db.from('social_posts').update({status}).eq('id',id);if(error)setMessage(error.message);else{setMessage(status==='manual_action_required'?'Borrador preparado. Todavía debes subirlo en la plataforma.':'Borrador actualizado.');await load()}setBusy(false)}
 const ready=videos.length, pending=posts.filter(p=>p.status==='draft'||p.status==='pending_approval'||p.status==='manual_action_required').length, failed=jobs.filter(j=>j.status==='failed').length;
 const totalViews=analytics.reduce((n,a)=>n+Number(a.views||0),0),totalLikes=analytics.reduce((n,a)=>n+Number(a.likes||0),0);
 const latestJobs=jobs.slice(0,5);
 const seriesName=(id:string)=>series.find(s=>s.id===id)?.title||'Sin serie';
 if(!session)return <main className="auth-shell"><a className="brand" href="/"><span className="brand-mark brand-mark-world"><img src="/brand-mark.svg" alt=""/></span><span>BEHIND <b>DEL MUNDO</b><small>STUDIO / ACCESO</small></span></a><section className="auth-card"><div className="eyebrow">CENTRO DE PRODUCCIÓN</div><h1>{signup?'Crea tu acceso.':'Vuelve a la expedición.'}</h1><p>Accede al panel privado de Behind del Mundo.</p><form onSubmit={submit}><label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><button>{signup?'Crear cuenta':'Entrar'}</button></form><button className="link-button" onClick={()=>setSignup(!signup)}>{signup?'Ya tengo cuenta · Entrar':'Crear una cuenta'}</button>{message&&<p className="notice">{message}</p>}</section></main>;
 return <main className="studio-shell">
  <header className="studio-top"><a className="brand" href="/"><span className="brand-mark brand-mark-world"><img src="/brand-mark.svg" alt=""/></span><span>BEHIND <b>DEL MUNDO</b><small>STUDIO / CONTROL ROOM</small></span></a><div className="top-actions"><span className="user-email">{session.user.email}</span><button className="ghost-button" onClick={enableNotifications}>Activar avisos</button><button className="ghost-button" onClick={load}>{busy?'Actualizando…':'↻ Actualizar'}</button><button className="ghost-button" onClick={()=>db.auth.signOut()}>Salir</button></div></header>
  <section className="studio-heading"><div><div className="eyebrow">EXPLORA LO EXTRAORDINARIO / {stamp(new Date().toISOString())}</div><h1>Centro de <em>producción.</em></h1><p>Control editorial y seguimiento de Behind del Mundo.</p></div><div className="system-pill"><i/> PRODUCCIÓN EN GITHUB ACTIONS</div></section>
  <nav className="studio-nav">{tabs.map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}>{t.label}</button>)}</nav>
  {message&&<div className="studio-message">{message}<button onClick={()=>setMessage('')}>×</button></div>}
  {tab==='overview'&&<><div className="metric-grid"><Metric label="Vídeos guardados" value={ready} note="MP4 en biblioteca"/><Metric label="Borradores pendientes" value={pending} note="Revisión manual"/><Metric label="Trabajos fallidos" value={failed} note="Revisar incidencias"/><Metric label="Visualizaciones" value={totalViews.toLocaleString('es-ES')} note={totalLikes.toLocaleString('es-ES')+' me gusta'}/></div><div className="studio-columns"><section className="studio-card"><div className="card-kicker">PRODUCCIÓN / RECIENTE</div><h2>Últimos trabajos</h2>{latestJobs.length?latestJobs.map(j=><div className="data-row" key={j.id}><div><b>Trabajo {String(j.id).slice(0,8)}</b><small>{j.error_message||'Intentos: '+j.attempt_count}</small></div><Status value={j.status}/></div>):<Empty text="Aún no hay trabajos. Cuando inicies una generación aparecerá aquí."/>}</section></div><section className="studio-card"><div className="card-kicker">FLUJO EDITORIAL</div><div className="pipeline"><span>Investigación</span><i>→</i><span>Guion</span><i>→</i><span>Voz</span><i>→</i><span>Render</span><i>→</i><span>Revisión</span><i>→</i><span>Publicación</span></div><p className="muted-copy">La publicación automática está desactivada. Aprobar un borrador no lo envía a ninguna red.</p></section></>}
  {tab==='import'&&<section className="studio-card"><div className="card-kicker">ENTRADA EDITORIAL / JSON AUTOCONTENIDOS</div><h2>Importar ZIP de guiones</h2><p className="muted-copy">Sube un ZIP con exactamente tres archivos JSON. La web los descomprime en el navegador, comprueba las 14 escenas, fuentes y blueprints 3D, y conserva los modelos para el render.</p>{dispatchConfigured===false&&<p className="notice">Falta configurar GITHUB_ACTIONS_TOKEN en Vercel. Puedes cargar el ZIP, pero no iniciar los renders hasta añadir ese secreto.</p>}<label className="zip-drop"> <span>＋</span><b>Seleccionar ZIP</b><small>{zipName||'Un ZIP · tres JSON · sin carpetas obligatorias'}</small><input type="file" accept=".zip,application/zip" disabled={dispatching} onChange={e=>handleZip(e.target.files?.[0])}/></label>{scriptBatch.every(x=>x.trim())&&<div className="zip-preview">{scriptBatch.map((raw,i)=>{let title='JSON '+(i+1);try{title=JSON.parse(raw).title||title}catch{}return <div key={i}><span>0{i+1}</span><b>{title}</b><small>JSON validado · 14 escenas</small></div>})}</div>}<div className="button-row"><button className="primary-button" disabled={dispatching||busy||scriptBatch.some(x=>!x.trim())||dispatchConfigured===false} onClick={importAndProduce}>{dispatching?'Validando y enviando…':'Importar y generar los 3 vídeos'}</button><button className="ghost-button" disabled={dispatching} onClick={()=>{setScriptBatch(['','','']);setZipName('')}}>Vaciar selección</button></div><p className="muted-copy">La producción usa Edge TTS, Three.js, HyperFrames y FFmpeg. No se utiliza Groq ni otro modelo externo para redactar. Los vídeos quedan privados para revisión; no se publica nada automáticamente.</p></section>}
  {tab==='scripts'&&<div className="studio-columns scripts-layout"><section className="studio-card"><div className="card-kicker">ARCHIVO EDITORIAL</div><h2>Guiones ({scripts.length})</h2>{scripts.map(s=><button key={s.id} className={'script-choice '+(selectedScript?.id===s.id?'chosen':'')} onClick={()=>setSelectedScript(s)}><b>{s.title}</b><small>{fmt(s.created_at)} · {seriesName(s.series_id)}</small><Status value={s.status}/></button>)}{!scripts.length&&<Empty text="Todavía no hay guiones generados."/>}</section><section className="studio-card script-detail">{selectedScript?<><div className="card-kicker">REVISIÓN EDITORIAL</div><h2>{selectedScript.title}</h2><p className="hook-line">{selectedScript.hook}</p><label className="editor-label">Narración<textarea value={selectedScript.narration||''} onChange={e=>setSelectedScript({...selectedScript,narration:e.target.value})}/></label><div className="source-list"><b>Fuentes documentales</b>{(selectedScript.source_notes||[]).map((s:any,i:number)=><a key={i} href={s.url} target="_blank" rel="noreferrer">{s.title||s.url} ↗</a>)}</div><div className="button-row"><button className="primary-button" disabled={busy} onClick={()=>updateScript(selectedScript.id,{narration:selectedScript.narration})}>Guardar cambios</button>{selectedScript.status==='approved'&&<button className="primary-button" disabled={busy} onClick={()=>retryScript(selectedScript.id)}>Generar / reintentar vídeo</button>}<button className="ghost-button" disabled={busy} onClick={()=>updateScript(selectedScript.id,{status:'approved'})}>Aprobar guion</button><button className="ghost-button" disabled={busy} onClick={()=>updateScript(selectedScript.id,{status:'rejected'})}>Rechazar</button></div><p className="muted-copy">Los cambios aquí no regeneran un vídeo que ya se haya renderizado.</p></>:<Empty text="Selecciona un guion para revisarlo."/>}</section></div>}
  {tab==='memory'&&<><section className="studio-card"><div className="card-kicker">MEMORIA PERMANENTE / SUPABASE</div><h2>Temas que ya hemos tratado ({memory.length})</h2><p className="muted-copy">El generador compara cada nuevo guion con todo el historial. Los últimos 40 temas se envían a Groq como orientación compacta para ahorrar cuota; la detección local revisa la memoria completa.</p><form className="memory-form" onSubmit={addMemoryTopic}><label>Tema que no quieres volver a tratar<input value={memoryTopic} onChange={e=>setMemoryTopic(e.target.value)} placeholder="Ej. El incidente del paso Dyatlov" required/></label><label>Motivo (opcional)<input value={memoryReason} onChange={e=>setMemoryReason(e.target.value)} placeholder="Ya se ha cubierto o no encaja con el canal"/></label><button className="primary-button" disabled={busy||!memoryTopic.trim()}>Añadir a exclusiones</button></form></section><section className="studio-card"><div className="card-kicker">ARCHIVO / ÚLTIMOS 1000 REGISTROS</div>{memory.length?memory.map(item=><article className="data-row" key={item.id}><div><b>{item.topic}</b><small>{fmt(item.created_at)} · {item.angle||'Sin gancho registrado'} · {(item.source_urls||[]).length} fuentes{item.reason?' · '+item.reason:''}</small></div><Status value={item.memory_status}/></article>):<Empty text="Todavía no hay temas guardados. Se añadirán al completar la primera producción."/>}</section></>}

  {tab==='videos'&&<section className="studio-card"><div className="card-kicker">BIBLIOTECA / MP4</div><h2>Vídeos renderizados ({videos.length})</h2><div className="video-grid">{videos.map(v=><article className="video-card" key={v.id}>{signed[v.id]?<video controls playsInline preload="metadata" src={signed[v.id]}/>:<div className="video-placeholder">VÍDEO PRIVADO</div>}<b>{v.storage_path.split('/').pop()}</b><small>{fmt(v.created_at)} · {v.duration_seconds||'—'} s · {v.width}×{v.height}</small><div className="video-actions">{signed[v.id]&&<a href={signed[v.id]} target="_blank" rel="noreferrer">Abrir MP4 ↗</a>}<Status value={v.quality_check?.passed?'QC correcto':'QC pendiente'}/></div></article>)}</div>{!videos.length&&<Empty text="Aquí aparecerán los MP4 cuando una generación termine y se guarde en Supabase."/>}</section>}
  {tab==='posts'&&<section className="studio-card"><div className="card-kicker">DISTRIBUCIÓN / APROBACIÓN MANUAL</div><h2>Borradores sociales ({posts.length})</h2>{posts.map(p=><article className="post-row" key={p.id}><div className="post-platform">{p.platform==='youtube'?'▶':'♪'} {p.platform}</div><div className="post-content"><p>{p.caption}</p><small>{fmt(p.created_at)}{p.error_message?' · '+p.error_message:''}</small></div><Status value={p.status}/><div className="post-buttons">{(()=>{const videoId=videos.find((v:any)=>v.id===p.video_id)?.id;return videoId&&signed[videoId]?<a className="small-ghost" href={signed[videoId]} target="_blank" rel="noreferrer">Descargar vídeo</a>:null})()}<a className="small-ghost" href={p.platform==='youtube'?'https://studio.youtube.com/':'https://www.tiktok.com/tiktokstudio/upload'} target="_blank" rel="noreferrer">Abrir plataforma</a>{(p.status==='draft'||p.status==='pending_approval')&&<><button className="small-primary" disabled={busy} onClick={()=>updatePost(p.id,'manual_action_required')}>Preparar publicación</button><button className="small-ghost" disabled={busy} onClick={()=>updatePost(p.id,'rejected')}>Rechazar</button></>}</div></article>)}{!posts.length&&<Empty text="Los borradores de TikTok y YouTube aparecerán aquí al completar la primera producción."/>}<p className="muted-copy">La aprobación solo cambia el estado interno. No publica nada: faltan las integraciones OAuth y el publicador autorizado.</p></section>}
  {tab==='stats'&&<><div className="metric-grid"><Metric label="Visualizaciones" value={totalViews.toLocaleString('es-ES')} note="Datos recibidos"/><Metric label="Me gusta" value={totalLikes.toLocaleString('es-ES')} note="Todas las plataformas"/><Metric label="Comentarios" value={analytics.reduce((n,a)=>n+Number(a.comments||0),0).toLocaleString('es-ES')} note="Interacción"/><Metric label="Compartidos" value={analytics.reduce((n,a)=>n+Number(a.shares||0),0).toLocaleString('es-ES')} note="Difusión"/></div><section className="studio-card"><h2>Últimos datos por publicación</h2>{analytics.length?analytics.map(a=><div className="data-row" key={a.id}><div><b>{stamp(a.captured_at)}</b><small>{a.views} visualizaciones · {a.likes} me gusta · {a.comments} comentarios · {a.shares} compartidos</small></div><b>{a.retention_percent??'—'}% retención</b></div>):<Empty text="Todavía no hay métricas. Se mostrarán cuando conectemos las cuentas y recibamos estadísticas reales."/>}</section></>}
  {tab==='settings'&&<div className="studio-columns"><section className="studio-card"><div className="card-kicker">CONFIGURACIÓN DEL CANAL</div><h2>{settings?.channel_name||'Behind del Mundo'}</h2><Setting label="Idioma" value={settings?.content_locale||'es-ES'}/><Setting label="Presupuesto mensual" value={settings?.monthly_budget_cents!=null?(settings.monthly_budget_cents/100).toFixed(2)+' €':'—'}/><Setting label="Aprobación obligatoria" value={settings?.require_approval?'Sí':'No'}/><Setting label="Publicación automática" value={settings?.auto_publish_enabled?'Activada':'Desactivada'}/></section><section className="studio-card"><div className="card-kicker">SERIES EDITORIALES</div><h2>Identidad de contenido</h2>{series.map(s=><div className="data-row" key={s.id}><div><b>{s.title}</b><small>{s.description}</small></div><Status value={s.is_active?'Activa':'Pausada'}/></div>)}<div className="system-note"><b>Entrada editorial: guiones externos</b><small>Pega los tres guiones preparados; el render no necesita una API de redacción.</small></div><div className="system-note"><b>Producción: Edge TTS + Three.js + HyperFrames + FFmpeg</b><small>Voces en español, escenas 3D y montaje MP4 en GitHub Actions.</small></div></section></div>}
  <footer className="studio-footer">BEHIND DEL MUNDO © 2026 · DESCUBRE LO QUE HAY DETRÁS <span>Panel privado · {session.user.email}</span></footer>
 </main>;
}
function Metric({label,value,note}:{label:string,value:any,note:string}){return <article className="metric-card"><small>{label}</small><strong>{value}</strong><span>{note}</span></article>}
function Status({value}:{value:string}){return <span className={'status status-'+String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-')}>{value}</span>}
function Empty({text}:{text:string}){return <div className="empty-state">{text}</div>}
function Setting({label,value}:{label:string,value:string}){return <div className="setting-row"><span>{label}</span><b>{value}</b></div>}
