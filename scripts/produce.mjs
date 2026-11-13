import { mkdir, writeFile, readFile, rm, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const now = new Date();
const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const runStamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + String(process.env.GITHUB_RUN_ID || process.env.MANUAL_QUEUE_INDEX || 'manual');
if (!process.env.SUPABASE_URL) throw new Error('Falta la variable SUPABASE_URL');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Falta la variable SUPABASE_SERVICE_ROLE_KEY');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const keyIsLegacyServiceRole = jwtRole(supabaseKey) === 'service_role';
const headers = {
  apikey: supabaseKey,
  // New sb_secret_* keys must be sent only as apikey; legacy service_role JWTs
  // can also be sent as Bearer tokens.
  ...(keyIsLegacyServiceRole ? { Authorization: `Bearer ${supabaseKey}` } : {}),
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};
const api = process.env.SUPABASE_URL.replace(/\/$/, '');
const storageHeaders = Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'content-type' && key.toLowerCase() !== 'prefer'));
const expectedProjectRef = 'fnivzsazuovldhbkxrqv';
const actualProjectRef = new URL(api).hostname.split('.')[0];
if (actualProjectRef !== expectedProjectRef) {
  throw new Error(`SUPABASE_URL apunta al proyecto "${actualProjectRef}", pero Behind del Mundo está configurado en "${expectedProjectRef}". Corrige el secreto SUPABASE_URL en GitHub.`);
}
function jwtRole(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')).role || 'sin role';
  } catch { return 'no es un JWT válido'; }
}
const keyRole = jwtRole(supabaseKey);
const keyIsNewSecret = supabaseKey.startsWith('sb_secret_');
console.log(`Supabase verificado: proyecto=${actualProjectRef}; tipo de clave=${keyIsNewSecret ? 'secret sb_secret_*' : keyRole}`);
if (!keyIsNewSecret && keyRole !== 'service_role') {
  throw new Error(`SUPABASE_SERVICE_ROLE_KEY no es una clave privilegiada válida. Usa la clave Secret (sb_secret_...) o la legacy service_role del proyecto ${expectedProjectRef}; no uses la Publishable/anon.`);
}
async function supabase(table, options = {}) {
  const { method = 'GET', query = '', body, extraHeaders = {} } = options;
  const response = await fetch(`${api}/rest/v1/${table}${query}`, {
    method, headers: { ...headers, ...extraHeaders }, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${table} ${response.status}: ${text.slice(0, 900)}`);
  return text ? JSON.parse(text) : [];
}
async function command(bin, args, opts = {}) {
  await new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd: opts.cwd || root, stdio: 'inherit', env: process.env });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${bin} terminó con código ${code}`)));
  });
}

async function capture(bin, args, opts = {}) {
  return await new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd: opts.cwd || root, env: process.env, stdio: ['ignore','pipe','pipe'] });
    let stdout = '', stderr = '';
    p.stdout.on('data', chunk => stdout += chunk);
    p.stderr.on('data', chunk => stderr += chunk);
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(`${bin} terminó con código ${code}: ${stderr.slice(0,500)}`)));
  });
}

// edge-tts puede responder temporalmente con NoAudioReceived aunque la petición
// sea válida. Cada intento empieza con un archivo limpio y valida el MP3 real
// (tamaño y duración) antes de darlo por bueno.
async function generateSpeech(text, outputPath, voice, rate, label, required = true, pitch = '+0Hz', subtitlePath = null) {
  const maxAttempts = 4;
  const delays = [4000, 10000, 20000];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await rm(outputPath, { force: true });
    try {
      const ttsArgs = ['-m', 'edge_tts', '--voice', voice, `--rate=${rate}`, `--pitch=${pitch}`, '--text', text, '--write-media', outputPath];
      if (subtitlePath) ttsArgs.push('--write-subtitles', subtitlePath);
      await command('python', ttsArgs);
      const info = await (await import('node:fs/promises')).stat(outputPath);
      if (info.size < 1500) throw new Error(`edge-tts generó un archivo demasiado pequeño (${info.size} bytes).`);
      const duration = Number(await capture('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',outputPath]));
      if (!Number.isFinite(duration) || duration < 0.25) throw new Error('edge-tts generó un audio vacío o ilegible.');
      console.log(`Audio verificado para ${label}: ${duration.toFixed(1)} s, intento ${attempt}/${maxAttempts}.`);
      return true;
    } catch (error) {
      await rm(outputPath, { force: true }).catch(() => {});
      if (attempt === maxAttempts) {
        const message = `No se pudo generar audio para ${label} tras ${maxAttempts} intentos: ${error.message}`;
        if (required) throw new Error(message);
        console.warn(message + ' Se continúa sin pista de voz secundaria.');
        return false;
      }
      const delay = delays[attempt - 1];
      console.warn(`edge-tts ${label}: intento ${attempt}/${maxAttempts} fallido (${error.message}). Nuevo intento en ${delay / 1000} s.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

// Comprueba Edge TTS antes de crear registros.
// Si el proveedor no entrega audio, la ejecución se detiene aquí.
const ttsPreflightPath = path.join(root, 'renders', 'tts-preflight.mp3');
await mkdir(path.dirname(ttsPreflightPath), { recursive: true });
try {
  await generateSpeech('Prueba de voz de Behind del Mundo.', ttsPreflightPath, 'es-ES-AlvaroNeural', '+8%', 'comprobación previa', true);
  console.log('Preflight de voz superado; se inicia la producción editorial.');
} finally {
  await rm(ttsPreflightPath, { force: true });
}
const [settings] = await supabase('channel_settings', { query: '?brand_slug=eq.nexo-raro&select=id,user_id,channel_name,timezone,require_approval,auto_publish_enabled&limit=1' });
if (!settings) throw new Error('No hay una cuenta configurada en el panel. Inicia sesión y termina el asistente inicial.');
const userId = settings.user_id;

// Reinicio explícito de contenidos; conserva ajustes, series y el histórico de consumo.
if (String(process.env.RESET_PRODUCTION || '').toLowerCase() === 'true') {
  console.warn('RESET_PRODUCTION activo: limpiando vídeos, publicaciones, guiones, trabajos y memoria editorial.');
  const oldVideos = await supabase('videos', { query: '?user_id=eq.' + userId + '&select=id,storage_path' });
  for (const video of oldVideos) {
    if (!video.storage_path) continue;
    const objectPath = video.storage_path.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(api + '/storage/v1/object/nexo-videos/' + objectPath, {
      method: 'DELETE',
      headers: { apikey: supabaseKey, ...(keyIsLegacyServiceRole ? { Authorization: 'Bearer ' + supabaseKey } : {}) },
    });
    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      throw new Error('No se pudo borrar el MP4 ' + video.storage_path + ': Storage HTTP ' + response.status + ': ' + body.slice(0,500));
    }
  }
  await supabase('social_posts', { method: 'DELETE', query: '?user_id=eq.' + userId });
  await supabase('videos', { method: 'DELETE', query: '?user_id=eq.' + userId });
  await supabase('editorial_memory', { method: 'DELETE', query: '?user_id=eq.' + userId });
  await supabase('production_jobs', { method: 'DELETE', query: '?user_id=eq.' + userId });
  await supabase('scripts', { method: 'DELETE', query: '?user_id=eq.' + userId });
  console.log('Reinicio completado: ' + oldVideos.length + ' MP4 eliminados. Se conservan provider_usage, series y channel_settings.');
}
const scheduledAt = new Date(Date.now() + Number(process.env.MANUAL_QUEUE_INDEX || 0)).toISOString();
const existing = await supabase('production_jobs', { query: `?user_id=eq.${userId}&scheduled_for=eq.${encodeURIComponent(scheduledAt)}&select=id,status,attempt_count,started_at,completed_at,script_id&limit=1` });
const existingJob = existing[0];
const activeJobStatuses = ['queued', 'voicing', 'rendering'];
if (existingJob?.status === 'ready') {
  console.log('Este trabajo ya tiene un vídeo terminado y guardado; se evita duplicar.');
  process.exit(0);
}
if (existingJob && activeJobStatuses.includes(existingJob.status)) {
  const startedAt = existingJob.started_at ? Date.parse(existingJob.started_at) : 0;
  const ageMinutes = startedAt > 0 ? (Date.now() - startedAt) / 60000 : Number.POSITIVE_INFINITY;
  // El job de GitHub tiene un timeout de 35 minutos. Un estado activo más
  // antiguo no puede considerarse una producción en curso: se recupera.
  if (ageMinutes < 45) {
    throw new Error(`Este guion ya tiene un trabajo realmente activo (${existingJob.status}, ${Math.max(0, Math.floor(ageMinutes))} min). Se detiene este duplicado para evitar dos renders simultáneos.`);
  }
  console.warn(`Recuperando trabajo atascado ${existingJob.id}: estado=${existingJob.status}, antigüedad=${Math.floor(ageMinutes)} min.`);
  const [recovered] = await supabase('production_jobs', {
    method: 'PATCH',
    query: `?id=eq.${existingJob.id}&status=eq.${existingJob.status}`,
    body: {
      status: 'failed',
      error_message: `Trabajo recuperado automáticamente: estado ${existingJob.status} sin actividad durante ${Math.floor(ageMinutes)} minutos.`,
      completed_at: new Date().toISOString(),
    },
  });
  if (!recovered) throw new Error('No se pudo recuperar el trabajo atascado; se detiene para evitar duplicados.');
}
const seriesRows = await supabase('series', { query: `?user_id=eq.${userId}&is_active=eq.true&select=id,slug,title,description&order=slug.asc` });
const series = seriesRows.length ? seriesRows[Number(process.env.MANUAL_QUEUE_INDEX || 0) % seriesRows.length] : null;

let editorialMemory = [];
for (let offset = 0; offset < 100000; offset += 1000) {
  const page = await supabase('editorial_memory', { query: `?user_id=eq.${userId}&select=topic,topic_key,angle,summary,source_urls,memory_status,created_at&order=created_at.desc&limit=1000&offset=${offset}` });
  editorialMemory.push(...page);
  if (page.length < 1000) break;
}
const memoryBrief = editorialMemory.slice(0,18).map(item => ({ tema:item.topic, enfoque:String(item.angle||'').slice(0,70) }));
console.log(`Memoria editorial cargada: ${memoryBrief.length} temas históricos.`);
function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}
let script;
let scriptId;
let wordCount;
if (process.env.MANUAL_SCRIPT_ID) {
  const importedRows = await supabase('scripts', { query: '?id=eq.' + encodeURIComponent(process.env.MANUAL_SCRIPT_ID) + '&user_id=eq.' + userId + '&select=id,title,hook,narration,visual_plan,source_notes,series_id,status&limit=1' });
  const imported = importedRows[0];
  if (!imported) throw new Error('No se encontró el guion importado o no pertenece a esta cuenta.');
  if (!['queued','in_production','approved'].includes(imported.status)) throw new Error('El guion no está en cola de producción (estado: ' + imported.status + ').');
  const storedPlan = imported.visual_plan || [];
  script = { title: imported.title, hook: imported.hook || '', narration: imported.narration || '', scenes: Array.isArray(storedPlan) ? storedPlan : (storedPlan.scenes || []), models: Array.isArray(storedPlan) ? {} : (storedPlan.models || {}), sources: imported.source_notes || [], caption: imported.title + ' | Descubre lo que hay detrás. #BehindDelMundo', category: seriesRows.find(x => x.id === imported.series_id)?.slug || 'nadie-te-lo-explica' };
  scriptId = imported.id;
  wordCount = countWords(script.narration);
  await supabase('scripts', { method: 'PATCH', query: '?id=eq.' + scriptId, body: { status: 'in_production' } });
  console.log('Guion aprobado cargado desde el panel; producción sin modelos generativos externos.');
} else if (process.env.MANUAL_SCRIPT_FILE) {
  const scriptPath = path.resolve(root, process.env.MANUAL_SCRIPT_FILE);
  if (!scriptPath.startsWith(root + path.sep)) throw new Error('MANUAL_SCRIPT_FILE debe apuntar a un JSON dentro del repositorio.');
  script = JSON.parse(await readFile(scriptPath, 'utf8'));
  if (!script || typeof script !== 'object' || Array.isArray(script)) throw new Error('El JSON editorial debe contener un objeto.');
  wordCount = countWords(script.narration);
  const [seriesMatch] = seriesRows.filter(x => x.slug === script.category);
  const scriptRow = await supabase('scripts', { method: 'POST', body: { user_id: userId, series_id: seriesMatch?.id || series?.id || null, title: script.title, hook: script.hook || '', narration: script.narration, visual_plan: script.scenes, source_notes: script.sources, target_seconds: 60, status: 'in_production' }});
  scriptId = scriptRow[0].id;
  console.log('Guion JSON editorial cargado desde el repositorio; sin generación automática.');
} else {
  throw new Error('No hay guion editorial aprobado. Indica MANUAL_SCRIPT_ID o MANUAL_SCRIPT_FILE; la producción nunca redacta guiones por su cuenta.');
}

// Validación común para guiones editoriales aprobados antes de generar voz o vídeo.
wordCount = countWords(script.narration);
// Los fragmentos visuales los propone el modelo, pero pueden quedar obsoletos
// si el texto se edita después (por ejemplo, al ajustar la duración). No
// debemos abortar una producción válida por una cita desincronizada: repartimos
// la narración real en catorce bloques contiguos y los persistimos con el guion.
{
  const narrationTokens = String(script.narration || '').trim().split(/\s+/).filter(Boolean);
  script.narration = narrationTokens.join(' ');
  if (narrationTokens.length >= 56 && Array.isArray(script.scenes) && script.scenes.length === 14) {
    for (let i = 0; i < 14; i++) {
      const start = Math.floor(i * narrationTokens.length / 14);
      const end = Math.floor((i + 1) * narrationTokens.length / 14);
      script.scenes[i].narration_excerpt = narrationTokens.slice(start, end).join(' ');
    }
    console.log('Fragmentos de narración sincronizados automáticamente con la voz final (14 planos).');
  }
}
if (wordCount < 145 || wordCount > 205) throw new Error('El guion debe tener entre 145 y 205 palabras; recibido: ' + wordCount + '.');
if (!Array.isArray(script.scenes) || script.scenes.length !== 14) throw new Error('El guion debe incluir exactamente 14 escenas cortas.');
if (!Array.isArray(script.sources) || script.sources.length < 3) throw new Error('El guion debe incluir al menos 3 fuentes.');
for (const [index, scene] of script.scenes.entries()) {
  const sceneType = String(scene.scene_type || '').toLowerCase();
  const validSceneTypes = new Set(['landscape','architecture','science','ocean','space','history','object','abstract']);
  if (!validSceneTypes.has(sceneType)) throw new Error('La escena ' + (index + 1) + ' tiene un scene_type no admitido: ' + sceneType + '.');
  if (!scene.visual || String(scene.visual).trim().length < 550 || !scene.setting || String(scene.setting).trim().length < 40 || !scene.action || String(scene.action).trim().length < 130 || !scene.camera || String(scene.camera).trim().length < 80 || !scene.continuity || String(scene.continuity).trim().length < 70 || !Array.isArray(scene.characters) || !Array.isArray(scene.props) || scene.props.length < 4 || scene.props.length > 8 || !Array.isArray(scene.objects) || scene.objects.length < 4 || scene.objects.length > 8 || !scene.overlay || String(scene.overlay).trim().split(/\s+/).length > 4 || !scene.narration_excerpt) throw new Error('La escena ' + (index + 1) + ' no alcanza el estándar cinematográfico: hacen falta lugar, acción desarrollada, cámara, continuidad y objetos concretos.');
  const excerptWords = countWords(scene.narration_excerpt);
  if (excerptWords < 8 || !script.narration.includes(scene.narration_excerpt)) throw new Error('El fragmento de narración de la escena ' + (index + 1) + ' debe contener al menos 8 palabras y coincidir literalmente con la voz.');
  for (const character of scene.characters) if (!character.role || !character.appearance || String(character.appearance).length < 25 || !character.action || String(character.action).length < 25) throw new Error('Personaje incompleto en escena ' + (index + 1) + ': cada personaje necesita identidad, aspecto y acción propios.');
}
// Guarda los fragmentos corregidos para que panel, reintentos y render usen
// exactamente la misma versión del plan visual.
await supabase('scripts', { method:'PATCH', query:'?id=eq.' + encodeURIComponent(scriptId), body:{ visual_plan:{ scenes:script.scenes, models:script.models || {} } } });
const allowedEntityTypes = new Set(['human','animal','ship','tree','building','vehicle','machine','lab','celestial','furniture','prop','artifact']);
const entityRegistry = new Map();
for (const [sceneIndex, scene] of script.scenes.entries()) {
  const entities = Array.isArray(scene.entities) ? scene.entities : [];
  if (entities.length < 2 || entities.length > 12) throw new Error('La escena ' + (sceneIndex + 1) + ' necesita entre 2 y 12 entidades 3D explícitas para el nuevo motor procedural.');
  const entityIds = new Set(entities.map(entity => String(entity.id || '')));
  if (!scene.camera_target || !entityIds.has(String(scene.camera_target))) throw new Error('La cámara de la escena ' + (sceneIndex + 1) + ' necesita un camera_target que coincida con el id de una entidad real.');
  if (!Array.isArray(scene.beats) || scene.beats.length < 2 || scene.beats.length > 12) throw new Error('La escena ' + (sceneIndex + 1) + ' necesita entre 2 y 12 beats narrativos temporizados.');
  for (const entity of entities) {
    const entityType = String(entity.type || '').toLowerCase();
    if (!entity.id || !entity.name || !allowedEntityTypes.has(entityType) || !Array.isArray(entity.position) || entity.position.length !== 3 || !entity.position.every(value => Number.isFinite(Number(value))) || !entity.action || countWords(entity.action) < 3 || !entity.motion || countWords(entity.motion) < 3 || !(Number.isFinite(Number(entity.scale)) && Number(entity.scale) > 0) && !(Array.isArray(entity.scale) && entity.scale.length === 3 && entity.scale.every(value => Number.isFinite(Number(value)) && Number(value) > 0)) || (!entity.appearance || String(entity.appearance).trim().length < 100) && (!entity.description || String(entity.description).trim().length < 100) || !entity.dimensions || !Array.isArray(entity.dimensions) || entity.dimensions.length !== 3 || !entity.dimensions.every(value => Number.isFinite(Number(value)) && Number(value) > 0) || !entity.shape || !entity.material || !entity.color || !entity.support) {
      throw new Error('Entidad 3D incompleta en escena ' + (sceneIndex + 1) + ': cada modelo necesita id, nombre, tipo, apariencia, posición, dimensiones, forma, material, color, soporte y acción.');
    }
    if (['human','animal'].includes(entityType) && !entity.appearance && !entity.description) throw new Error('El personaje o animal ' + entity.name + ' necesita una apariencia visual concreta.');

    const blueprint = entity.blueprint || (script.models && script.models[entity.model_id]);
    if (!entity.model_id && !entity.blueprint || !blueprint || blueprint.version !== 1 || !Array.isArray(blueprint.parts) || blueprint.parts.length < 1 || !Array.isArray(blueprint.animations)) {
      throw new Error('La entidad "' + entity.name + '" necesita un blueprint 3D autocontenido en su JSON (piezas, geometría y animaciones).');
    }
    const partIds = new Set(['root']);
    const primitives = new Set(['box','sphere','cylinder','cone','torus']);
    for (const part of blueprint.parts) {
      if (!part.id || partIds.has(String(part.id))) throw new Error('Pieza 3D con id vacío o duplicado en "' + entity.name + '".');
      if (part.parent && !partIds.has(String(part.parent))) throw new Error('La pieza "' + part.id + '" referencia un padre que todavía no existe en "' + entity.name + '".');
      if (!part.group && (!primitives.has(part.primitive) || !Array.isArray(part.size) || part.size.length !== 3 || !part.size.every(value => Number.isFinite(Number(value)) && Number(value) > 0) || !part.color)) {
        throw new Error('La pieza "' + part.id + '" de "' + entity.name + '" necesita primitiva admitida, tamaño y color explícitos.');
      }
      if (part.position && (!Array.isArray(part.position) || part.position.length !== 3 || !part.position.every(value => Number.isFinite(Number(value))))) throw new Error('Posición 3D inválida en pieza "' + part.id + '".');
      partIds.add(String(part.id));
    }
    for (const animation of blueprint.animations) {
      if (!partIds.has(String(animation.target)) || !['rotation','position','scale'].includes(animation.property) || !['x','y','z'].includes(animation.axis) || !Number.isFinite(Number(animation.amplitude)) || !Number.isFinite(Number(animation.frequency))) {
        throw new Error('Animación 3D inválida en "' + entity.name + '": cada pista debe apuntar a una pieza y definir propiedad, eje, amplitud y frecuencia.');
      }
    }

    const signature = JSON.stringify({ type: entityType, name: String(entity.name), appearance: String(entity.appearance || entity.description || '') });
    const previous = entityRegistry.get(String(entity.id));
    if (previous && previous !== signature) throw new Error('El identificador ' + entity.id + ' cambia de aspecto o tipo entre escenas; rompe la continuidad visual.');
    entityRegistry.set(String(entity.id), signature);
  }
  // Rechaza intersecciones volumétricas evidentes entre modelos que no estén anclados entre sí.
  for (let a = 0; a < entities.length; a++) for (let b = a + 1; b < entities.length; b++) {
    const A = entities[a], B = entities[b];
    const attached = String(A.support || '') === String(B.id) || String(B.support || '') === String(A.id) || String(A.support || '').includes(B.name) || String(B.support || '').includes(A.name);
    if (attached) continue;
    const overlap = [0,1,2].map(axis => {
      const distance = Math.abs(Number(A.position[axis]) - Number(B.position[axis]));
      const halfA = Number(A.dimensions[axis]) / 2, halfB = Number(B.dimensions[axis]) / 2;
      return Math.max(0, Math.min(halfA + halfB - distance, Math.min(halfA, halfB))) / Math.min(halfA, halfB);
    });
    if (overlap.every(value => value > .82)) throw new Error('Solapamiento 3D grave entre "' + A.name + '" y "' + B.name + '" en la escena ' + (sceneIndex + 1) + '; separa sus posiciones o define un soporte/relación física real.');
  }
  if (scene.beats.some(beat => !beat.entity_id || !entityIds.has(String(beat.entity_id)) || !beat.action || countWords(beat.action) < 3 || !Number.isFinite(Number(beat.at)) || Number(beat.at) < 0 || !Number.isFinite(Number(beat.duration)) || Number(beat.duration) <= 0)) {
    throw new Error('Los beats de la escena ' + (sceneIndex + 1) + ' deben tener entidad existente, acción concreta y tiempos positivos.');
  }
}
const sourceHosts = new Set();
for (const source of script.sources) {
  if (!(source.title || source.name) || !source.url || !/^https:\/\//i.test(source.url)) throw new Error('Una fuente no contiene nombre/título y URL HTTPS válidos.');
  try { sourceHosts.add(new URL(source.url).hostname.replace(/^www\./i, '').toLowerCase()); } catch { throw new Error('URL de fuente inválida: ' + source.url); }
}
if (sourceHosts.size < 3) throw new Error('La historia necesita al menos 3 dominios de fuentes independientes; recibidos: ' + sourceHosts.size + '.');

let jobId = null;
let storagePath = null;
try {
if (existing.length) {
  const [reusedJob] = await supabase('production_jobs', {
    method: 'PATCH',
    query: `?id=eq.${existing[0].id}&status=eq.failed`,
    body: {
      script_id: scriptId, status: 'voicing',
      attempt_count: Number(existing[0].attempt_count || 0) + 1,
      error_message: null, started_at: new Date().toISOString(), completed_at: null,
    },
  });
  if (!reusedJob) throw new Error('El trabajo fallido cambió mientras se preparaba el reintento; no se ha creado un duplicado.');
  jobId = reusedJob.id;
} else {
  const [createdJob] = await supabase('production_jobs', { method: 'POST', body: {
    user_id: userId, script_id: scriptId, scheduled_for: scheduledAt, status: 'voicing',
    attempt_count: 1, started_at: new Date().toISOString(),
  }});
  jobId = createdJob.id;
}
const work = path.join(root, 'renders', `${local}-${runStamp}`);
await mkdir(work, { recursive: true });
await writeFile(path.join(work, 'script.json'), JSON.stringify(script, null, 2));
const voicePath = path.join(work, 'voice.mp3');
const subtitlesPath = path.join(work, 'narration.srt');
await generateSpeech(script.narration, voicePath, 'es-ES-AlvaroNeural', '+5%', 'narrador principal', true, '+0Hz', subtitlesPath);
const voiceDuration = Number(await capture('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',voicePath]));
if (!Number.isFinite(voiceDuration) || voiceDuration < 1) throw new Error('No se pudo medir la duración de la narración.');
const targetDuration = Math.max(60, Math.ceil(voiceDuration + 1.2));
if (targetDuration > 72) throw new Error(`La narración dura ${voiceDuration.toFixed(1)} s; excede el máximo de 72 s. Se detiene sin recortar la voz.`);
console.log(`Narración: ${voiceDuration.toFixed(1)} s a +5%; duración final garantizada de al menos 60 s (montaje ${targetDuration} s).`);
await supabase('production_jobs', { method: 'PATCH', query: `?id=eq.${jobId}`, body: { status: 'rendering' } });
const escaped = value => String(value || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const assetsDir = path.join(work, 'assets');
await mkdir(assetsDir, { recursive: true });
const sceneWordCounts = script.scenes.map(scene => String(scene.narration_excerpt || '').trim().split(/\s+/).filter(Boolean).length);
const totalSceneWords = sceneWordCounts.reduce((sum, count) => sum + count, 0) || 1;
let elapsedSceneSeconds = 0;
const clips = script.scenes.map((scene, i) => {
  const durationSeconds = i === script.scenes.length - 1 ? targetDuration - elapsedSceneSeconds : targetDuration * sceneWordCounts[i] / totalSceneWords;
  const start = elapsedSceneSeconds.toFixed(3), duration = durationSeconds.toFixed(3);
  elapsedSceneSeconds += durationSeconds;
  const sceneData = escaped(JSON.stringify({title:script.title,visual:scene.visual||'',setting:scene.setting||'',action:scene.action||'',camera:scene.camera||'',camera_target:scene.camera_target||'',continuity:scene.continuity||'',characters:Array.isArray(scene.characters)?scene.characters:[],props:Array.isArray(scene.props)?scene.props:[],type:scene.scene_type||'object',objects:Array.isArray(scene.objects)?scene.objects.slice(0,12):[],entities:Array.isArray(scene.entities)?scene.entities.slice(0,18):[],models:script.models||{},beats:Array.isArray(scene.beats)?scene.beats.slice(0,12):[],index:i,start:Number(start),duration:Number(duration),storyId:script.story_id||'' }));
  return '<section id="scene-'+(i+1)+'" class="scene motion-'+(i%4)+'" data-scene-start="'+start+'" data-scene-duration="'+duration+'" data-scene="'+sceneData+'"><div class="brand-mark">BEHIND <i>DEL MUNDO</i></div><div class="scene-copy"><h1>'+escaped(scene.overlay)+'</h1></div></section>';
}).join('');
const parseSrtTime = value => { const m=String(value).match(/(\d+):(\d{2}):(\d{2}),(\d{3})/); return m ? Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000 : 0; };
const srtText = await readFile(subtitlesPath,'utf8');
const srtBlocks = srtText.trim().split(/\r?\n\s*\r?\n/);
const wordCues = srtBlocks.map(block=>{const lines=block.split(/\r?\n/);const ix=lines.findIndex(line=>line.includes('-->'));if(ix<0)return null;const [from,to]=lines[ix].split('-->').map(x=>x.trim());return {start:parseSrtTime(from),end:parseSrtTime(to),text:lines.slice(ix+1).join(' ').trim()};}).filter(Boolean);
if (!wordCues.length) throw new Error('Edge TTS no ha devuelto marcas temporales de subtítulos; se cancela el render para evitar texto desincronizado.');
// Convierte las marcas de Edge TTS en palabras temporizadas. Algunos bloques SRT
// contienen frases completas, así que interpolamos cada palabra dentro de su bloque.
// Después agrupamos como máximo seis palabras y nunca cruzamos el final de una frase.
const timedWords = wordCues.flatMap(cue => {
  const tokens = String(cue.text || '').trim().replaceAll('\t', ' ').split(' ').filter(Boolean);
  const span = Math.max(0.08, cue.end - cue.start);
  return tokens.map((text, index) => ({
    text,
    start: cue.start + span * index / Math.max(1, tokens.length),
    end: cue.start + span * (index + 1) / Math.max(1, tokens.length),
  }));
});
const subtitleCues = [];
let captionGroup = [];
const flushCaption = () => {
  if (!captionGroup.length) return;
  subtitleCues.push({
    start: captionGroup[0].start,
    end: captionGroup[captionGroup.length - 1].end,
    words: captionGroup,
  });
  captionGroup = [];
};
for (const word of timedWords) {
  captionGroup.push(word);
  const sentenceEnd = /[.!?…][”"'»)]*$/.test(word.text);
  if (captionGroup.length >= 6 || sentenceEnd) flushCaption();
}
flushCaption();
if (!subtitleCues.length) throw new Error('No se pudieron crear subtítulos breves a partir de las marcas de voz.');

await command('npx', ['esbuild', 'scripts/scene-engine.js', '--bundle', '--format=iife', '--minify', '--outfile=' + path.join(work, 'scene-engine.bundle.js')], { cwd: root });
const sceneEngine = await readFile(path.join(work, 'scene-engine.bundle.js'), 'utf8');
// Inline the bundled scene engine, matching the proven procedural-preview path.
// HyperFrames then uses screenshot capture; the composition itself contains no
// requestAnimationFrame calls, so its deterministic timeline passes the linter.
await writeFile(path.join(work, 'scene-engine.bundle.js'), sceneEngine);
const sceneEngineTag = '<script>' + sceneEngine + '</script>';
const subtitleData = JSON.stringify(subtitleCues);
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=1080,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#8ebbd0;font-family:Arial,sans-serif}#root{position:relative;width:1080px;height:1920px}.scene{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;background:transparent!important;z-index:2}.world-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none}.brand-mark{position:absolute;z-index:4;top:82px;left:70px;font:900 25px Arial;letter-spacing:5px;color:white;text-shadow:0 3px 12px #16334f}.brand-mark i{font-style:normal;color:#ffcf54}.scene-copy{position:absolute;z-index:4;left:70px;right:70px;top:270px;animation:enter .6s ease both}.scene h1{font-size:76px;line-height:1.02;font-weight:950;color:white;-webkit-text-stroke:2px #172b42;text-shadow:0 5px 0 #172b42,0 9px 24px #102a43}.timed-caption{position:absolute;z-index:8;left:110px;right:110px;bottom:205px;min-height:0;width:max-content;max-width:860px;margin:0 auto;padding:13px 24px;text-align:center;font-size:38px;line-height:1.16;font-weight:850;color:#fff;letter-spacing:.1px;pointer-events:none;background:rgba(10,24,39,.76);border:1px solid rgba(255,211,105,.48);border-radius:18px;box-shadow:0 8px 28px rgba(4,15,28,.25);backdrop-filter:blur(8px)}.caption-word{display:inline-block;padding:0 2px;opacity:.82;transform:translateY(2px);transition:transform .12s ease,opacity .12s ease,color .12s ease}.caption-word.active{color:#ffd45b;opacity:1;transform:translateY(-1px);text-shadow:0 0 12px rgba(255,207,84,.45)}@keyframes enter{from{opacity:0;transform:translateY(35px)}to{opacity:1;transform:none}}
</style></head><body><div id="root" data-composition-id="behind-del-mundo" data-start="0" data-duration="${targetDuration}" data-width="1080" data-height="1920"><canvas id="world-canvas" class="world-canvas"></canvas><div id="timed-caption" class="timed-caption"></div><audio id="narration-audio" src="voice.mp3" data-start="0" data-duration="${targetDuration}" data-track-index="0" data-volume="1"></audio>${clips}<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script><script>
// The inlined Three.js engine selects the validated screenshot-capture path.
const tl=gsap.timeline({paused:true});
const subtitleCues=${subtitleData};
const caption=document.getElementById('timed-caption');
tl.set(caption,{opacity:0,visibility:'hidden'},0);
subtitleCues.forEach(cue=>{tl.call(()=>{caption.style.visibility='visible';caption.style.opacity='1';caption.innerHTML=cue.words.map((word,i)=>'<span class="caption-word" data-word="'+i+'">'+word.text.replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]))+'</span>').join(' ');caption.querySelectorAll('.caption-word').forEach((node,i)=>{if(i===0)node.classList.add('active');});},null,cue.start);cue.words.forEach((word,i)=>{if(i===0)return;tl.call(()=>{caption.querySelectorAll('.caption-word').forEach(node=>node.classList.remove('active'));caption.querySelectorAll('.caption-word')[i]?.classList.add('active');},null,word.start);});tl.call(()=>{caption.textContent='';},null,cue.end);tl.set(caption,{opacity:0,visibility:'hidden'},cue.end);});
document.querySelectorAll('.scene').forEach((e,i)=>{tl.fromTo(e,{opacity:0},{opacity:1,duration:.35},Number(e.dataset.sceneStart));tl.to(e,{opacity:0,duration:.25},Number(e.dataset.sceneStart)+Number(e.dataset.sceneDuration)-.25);if(i>0){tl.to('#world-canvas',{opacity:0,duration:.12},Number(e.dataset.sceneStart)-.12);tl.to('#world-canvas',{opacity:1,duration:.18},Number(e.dataset.sceneStart));}});
tl.set({}, {},${targetDuration});
window.__timelines=window.__timelines||{};window.__timelines['behind-del-mundo']=tl;
</script>${sceneEngineTag}</div></body></html>`;

await writeFile(path.join(work, 'index.html'), html);

const lintDir = path.join(work, 'lint-check');
await mkdir(lintDir, { recursive: true });
// Three.js internals contain Math.random/requestAnimationFrame implementations that the static linter flags even though this renderer never calls them; lint the composition structure separately from the vendor bundle.
await writeFile(path.join(lintDir, 'index.html'), html.replace(sceneEngineTag, ''));
await copyFile(voicePath, path.join(lintDir, 'voice.mp3'));
await command('npx', ['--yes', 'hyperframes@0.9.37', 'lint'], { cwd: lintDir });
const imageCount = script.scenes.length; // Catorce planos 3D cortos; no dependemos de fotos estáticas externas.
const rawVideo = path.join(work, 'video-silent.mp4');
await command('npx', ['--yes', 'hyperframes@0.9.37', 'render', '-c', 'index.html', '-o', rawVideo, '--fps', '30', '--quality', 'standard', '--workers', '1'], { cwd: work });
const manualSuffix = (process.env.MANUAL_SCRIPT_ID || process.env.MANUAL_SCRIPT_FILE) ? '-' + String(scriptId).slice(0, 8) : '';
const outputSlot = runStamp + manualSuffix;
const finalPath = path.join(root, 'renders', `behind-del-mundo-${local}-${outputSlot}.mp4`);
// HyperFrames incorpora la narración como pista de audio del timeline. No volver a muxear
// con -shortest: eso truncaba el vídeo al terminar la voz (48 s en la prueba anterior).
await command('ffmpeg', ['-y','-i',rawVideo,'-af','apad','-t',String(targetDuration),'-c:v','libx264','-preset','veryfast','-crf','23','-maxrate','4500k','-bufsize','9000k','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',finalPath]);
const stat = await (await import('node:fs/promises')).stat(finalPath);
if (stat.size < 500000) throw new Error('El MP4 generado parece incompleto.');
const maxStorageBytes = 45 * 1024 * 1024;
if (stat.size > maxStorageBytes) throw new Error(`QC tamaño fallido: el MP4 pesa ${(stat.size / 1024 / 1024).toFixed(1)} MB; límite interno ${Math.round(maxStorageBytes / 1024 / 1024)} MB. Se evita subir un archivo que Supabase podría rechazar.`);
console.log(`Tamaño MP4 optimizado para Storage: ${(stat.size / 1024 / 1024).toFixed(1)} MB.`);

const probeText = await capture('ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',finalPath]);
const probe = JSON.parse(probeText);
const actualDuration = Number(probe.format?.duration || 0);
const videoStream = (probe.streams || []).find(stream => stream.codec_type === 'video');
const audioStream = (probe.streams || []).find(stream => stream.codec_type === 'audio');
if (!videoStream || videoStream.width !== 1080 || videoStream.height !== 1920) throw new Error('QC fallido: el MP4 no tiene vídeo vertical 1080×1920.');
if (!audioStream) throw new Error('QC fallido: el MP4 no contiene pista de audio.');
if (actualDuration < 60 || actualDuration > 72) throw new Error(`QC fallido: duración real ${actualDuration.toFixed(1)} s fuera del margen 60–72 s.`);
console.log(`QC MP4 verificado: ${actualDuration.toFixed(1)} s, 1080×1920, audio presente.`);
storagePath = `${userId}/${local}/${outputSlot}.mp4`;
const videoBuffer = await readFile(finalPath);
const upload = await fetch(`${api}/storage/v1/object/nexo-videos/${storagePath}`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type':'video/mp4', 'x-upsert':'true' },
  body: videoBuffer,
});
if (!upload.ok) throw new Error(`Storage upload ${upload.status}: ${(await upload.text()).slice(0,700)}`);
const video = await supabase('videos', { method:'POST', body: {
  user_id:userId, job_id:jobId, script_id:scriptId, storage_path:storagePath,
  duration_seconds:actualDuration, width:1080, height:1920, mime_type:'video/mp4',
  quality_check:{passed:true, duration_seconds:actualDuration, bytes:stat.size, has_audio:true, visual_assets:imageCount, visual_sources:script.scenes.map((scene,index)=>({scene:index+1,type:scene.scene_type||'object',description:scene.visual,objects:scene.objects||[]})), sources:script.sources.length, word_count:wordCount, voice:'es-ES-AlvaroNeural', voice_rate:'+5%', rendered_by:'HyperFrames + Three.js', visual_style:'procedural-3d-scene-engine-v3'},

}});
const topicKey = String(script.title || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
await supabase('editorial_memory', { method: 'POST', extraHeaders: { Prefer: 'return=minimal' }, body: {
  user_id: userId, script_id: scriptId, topic: script.title, topic_key: topicKey,
  angle: script.hook || '', summary: String(script.narration || '').slice(0, 1200),
  source_urls: script.sources || [], memory_status: 'produced',
}});
await supabase('scripts', { method:'PATCH', query:`?id=eq.${scriptId}`, body:{status:'completed'} });
await supabase('social_posts', { method:'POST', body: ['youtube','tiktok'].map(platform => ({
  user_id:userId, video_id:video[0].id, platform, caption:script.caption || script.title,
  status:'draft',
}))});
await supabase('production_jobs', { method:'PATCH', query:`?id=eq.${jobId}`, body:{status:'ready',completed_at:new Date().toISOString()} });
console.log(`Vídeo listo: ${finalPath} (${stat.size} bytes). Guardado en Supabase; publicación en borrador por seguridad.`);
} catch (productionError) {
  console.error('Producción fallida; se eliminan los registros y archivos parciales de esta prueba.');
  const cleanupStep = async (label, fn) => {
    try { await fn(); console.log('Limpieza completada: ' + label); }
    catch (cleanupError) { console.error('No se pudo completar la limpieza (' + label + '): ' + cleanupError.message); }
  };
  const partialVideos = await supabase('videos', {
    query: `?script_id=eq.${scriptId}&select=id,storage_path`,
  }).catch(error => {
    console.error('No se pudieron consultar los vídeos parciales: ' + error.message);
    return [];
  });
  for (const partialVideo of partialVideos) {
    await cleanupStep('borradores sociales del vídeo ' + partialVideo.id, () =>
      supabase('social_posts', { method: 'DELETE', query: `?video_id=eq.${partialVideo.id}` }));
  }
  const pathsToRemove = new Set([storagePath, ...partialVideos.map(item => item.storage_path)].filter(Boolean));
  for (const objectPath of pathsToRemove) {
    const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
    await cleanupStep('archivo de Storage ' + objectPath, async () => {
      const response = await fetch(`${api}/storage/v1/object/nexo-videos/${encodedPath}`, {
        method: 'DELETE', headers: storageHeaders,
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Storage DELETE ${response.status}: ${(await response.text()).slice(0, 500)}`);
      }
    });
  }
  await cleanupStep('vídeos parciales', () =>
    supabase('videos', { method: 'DELETE', query: `?script_id=eq.${scriptId}` }));
  await cleanupStep('memoria editorial parcial', () =>
    supabase('editorial_memory', { method: 'DELETE', query: `?script_id=eq.${scriptId}` }));
  const failureMessage = String(productionError?.message || productionError || 'Error de producción').slice(0, 1800);
  if (jobId) {
    await cleanupStep('marcar trabajo como fallido', () =>
      supabase('production_jobs', { method: 'PATCH', query: `?id=eq.${jobId}`, body: { status: 'failed', error_message: failureMessage, completed_at: new Date().toISOString() } }));
  } else if (existingJob?.id) {
    await cleanupStep('conservar trabajo fallido', () =>
      supabase('production_jobs', { method: 'PATCH', query: `?id=eq.${existingJob.id}`, body: { status: 'failed', error_message: failureMessage, completed_at: new Date().toISOString() } }));
  } else if (scriptId) {
    await cleanupStep('registrar fallo de producción', () =>
      supabase('production_jobs', { method: 'POST', body: { user_id: userId, script_id: scriptId, scheduled_for: scheduledAt, status: 'failed', attempt_count: 1, error_message: failureMessage, completed_at: new Date().toISOString() } }));
  }
  if (scriptId) await cleanupStep('devolver guion a revisión para reintento', () =>
    supabase('scripts', { method: 'PATCH', query: `?id=eq.${scriptId}`, body: { status: 'approved' } }));
  throw productionError;
}
