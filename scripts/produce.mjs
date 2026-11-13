import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slots = ['07:30', '14:30', '20:30'];
const tz = 'Europe/Madrid';
const now = new Date();
const currentLocalDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
const requestedDate = String(process.env.MANUAL_DATE || '').trim();
if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
  throw new Error('MANUAL_DATE debe tener formato YYYY-MM-DD.');
}
const local = requestedDate || currentLocalDate;
if (requestedDate) {
  const parsedDate = new Date(requestedDate + 'T12:00:00Z');
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== requestedDate) {
    throw new Error('MANUAL_DATE no contiene una fecha de calendario válida.');
  }
  if (requestedDate < currentLocalDate) {
    throw new Error('No se permiten fechas pasadas en MANUAL_DATE.');
  }
}
const minutesOfDay = value => {
  const [hour, minute] = String(value).split(':').map(Number);
  return hour * 60 + minute;
};
const nearestSlot = slots
  .map(value => ({ value, distance: Math.abs(minutesOfDay(localTime) - minutesOfDay(value)) }))
  .sort((a, b) => a.distance - b.distance)[0];
const slot = process.env.MANUAL_SLOT || (nearestSlot?.distance <= 90 ? nearestSlot.value : null);
if (!slot || !slots.includes(slot)) {
  throw new Error(`Ejecución fuera de la ventana de producción: hora local ${localTime} (${tz}); horarios válidos ${slots.join(', ')}. Se marca como fallo y no como éxito vacío.`);
}
// Evita que un clic accidental en un horario ya pasado se convierta
// en una producción retroactiva del mismo día.
if (!process.env.MANUAL_SCRIPT_ID && local === currentLocalDate && minutesOfDay(slot) < minutesOfDay(localTime) - 90) {
  throw new Error(`El horario ${slot} ya pasó hoy (hora local ${localTime}). Para producir ese horario otro día, indica MANUAL_DATE con una fecha futura.`);
}
if (!process.env.MANUAL_SLOT && nearestSlot.distance > 0) {
  console.warn(`Inicio de GitHub Actions a las ${localTime}; se asigna al horario más cercano ${slot} (desfase ${nearestSlot.distance} min).`);
}
if (!process.env.MANUAL_SCRIPT_ID && !process.env.GROQ_API_KEY) throw new Error('Falta GROQ_API_KEY para producción editorial automática.');
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

// Comprueba Edge TTS antes de gastar cuota de Groq o crear registros.
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

// Reinicio explícito y acotado de producción; conserva configuración y memoria editorial.
if (String(process.env.RESET_PRODUCTION || '').toLowerCase() === 'true') {
  console.warn('RESET_PRODUCTION activo: limpiando vídeos, guiones, trabajos y consumo.');
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
  await supabase('videos', { method: 'DELETE', query: '?user_id=eq.' + userId });
  await supabase('scripts', { method: 'DELETE', query: '?user_id=eq.' + userId });
  await supabase('production_jobs', { method: 'DELETE', query: '?user_id=eq.' + userId });
  await supabase('provider_usage', { method: 'DELETE', query: '?user_id=eq.' + userId });
  console.log('Reinicio de producción completado: ' + oldVideos.length + ' MP4 eliminados y tablas de producción vaciadas.');
}
const scheduledAt = process.env.MANUAL_SCRIPT_ID ? new Date(Date.now() + Number(process.env.MANUAL_QUEUE_INDEX || 0) * 60000).toISOString() : new Date(new Date(`${local}T${slot}:00`).toLocaleString('en-US', { timeZone: tz })).toISOString();
const existing = await supabase('production_jobs', { query: `?user_id=eq.${userId}&scheduled_for=eq.${encodeURIComponent(scheduledAt)}&select=id,status,attempt_count,started_at,completed_at,script_id&limit=1` });
const existingJob = existing[0];
const activeJobStatuses = ['queued', 'voicing', 'rendering'];
if (existingJob?.status === 'ready') {
  console.log(`El horario ${local} ${slot} ya tiene un vídeo terminado y guardado; se evita duplicar.`);
  process.exit(0);
}
if (existingJob && activeJobStatuses.includes(existingJob.status)) {
  const startedAt = existingJob.started_at ? Date.parse(existingJob.started_at) : 0;
  const ageMinutes = startedAt > 0 ? (Date.now() - startedAt) / 60000 : Number.POSITIVE_INFINITY;
  // El job de GitHub tiene un timeout de 35 minutos. Un estado activo más
  // antiguo no puede considerarse una producción en curso: se recupera.
  if (ageMinutes < 45) {
    throw new Error(`El horario ${local} ${slot} ya tiene un trabajo realmente activo (${existingJob.status}, ${Math.max(0, Math.floor(ageMinutes))} min). Se detiene este duplicado con error explícito; no se registra como producción completada.`);
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
const series = seriesRows.length ? seriesRows[(slots.indexOf(slot) + Number(local.replaceAll('-', ''))) % seriesRows.length] : null;

let editorialMemory = [];
for (let offset = 0; offset < 100000; offset += 1000) {
  const page = await supabase('editorial_memory', { query: `?user_id=eq.${userId}&select=topic,topic_key,angle,summary,source_urls,memory_status,created_at&order=created_at.desc&limit=1000&offset=${offset}` });
  editorialMemory.push(...page);
  if (page.length < 1000) break;
}
const memoryBrief = editorialMemory.slice(0,18).map(item => ({ tema:item.topic, enfoque:String(item.angle||'').slice(0,70) }));
console.log(`Memoria editorial cargada: ${memoryBrief.length} temas históricos.`);
const researchPrompt = `Busca en la web un hecho real, poco conocido y visualmente atractivo para un vídeo documental breve en español de España. Fecha: ${local}; horario: ${slot}; serie editorial: ${series?.title || 'curiosidades reales y ciencia sorprendente'}. Evita temas virales quemados. MEMORIA EDITORIAL OBLIGATORIA: no propongas el mismo acontecimiento, descubrimiento, lugar, personaje, experimento ni historia que aparezca en esta memoria, aunque cambies el título o el enfoque. Elige un asunto claramente distinto y explica por qué no se solapa. Historial reciente (40 temas; la comprobación completa se hace contra toda la base): ${JSON.stringify(memoryBrief)}. Si una idea se parece a un tema del historial, descártala y busca otra. Contrasta el hecho con al menos 3 fuentes independientes, preferiblemente fuentes primarias, universidades, organismos oficiales o publicaciones científicas. Devuelve un resumen claro de los hechos verificables, qué partes son inciertas, las URLs exactas y una línea TOPIC: con el tema principal. No inventes referencias.`;
const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
// GPT OSS en Groq se utiliza tanto para investigar como para redactar el guion.
async function groqChat(payload, label) {
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) return response;
    const body = await response.text();
    const dailyTokenLimit = response.status === 429 && /tokens per day|TPD/i.test(body);
    const retryable = (response.status === 429 || response.status >= 500) && !dailyTokenLimit;
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`Groq ${label} ${response.status}${dailyTokenLimit ? ' (cuota diaria agotada; no tiene sentido reintentar este mismo modelo)' : ''}: ${body.slice(0, 1200)}`);
    }
    const retryAfterHeader = Number(response.headers.get('retry-after'));
    const retryAfterBody = body.match(/try again in ([0-9.]+)s/i);
    const waitSeconds = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader
      : retryAfterBody ? Number(retryAfterBody[1]) + 2 : Math.min(15 * attempt, 60);
    const waitMs = Math.min(Math.max(waitSeconds * 1000, 5000), 90000);
    console.warn(`Groq ${label}: HTTP ${response.status}; intento ${attempt}/${maxAttempts}. Reintento en ${Math.ceil(waitMs / 1000)} s.`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  throw new Error(`Groq ${label}: se agotaron los reintentos.`);
}
// Groq browser_search no debe compartir la misma llamada con la salida JSON:
// primero se investiga en texto libre y después se genera JSON en una llamada separada.
// La API Responses devuelve el texto final de browser_search en output_text.
async function groqResearch(input) {
  const endpoint = 'https://api.groq.com/openai/v1/responses';
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: groqModel,
        input: 'Eres un investigador documental. Usa browser_search para contrastar fuentes reales. Devuelve notas con títulos, URLs exactas y hechos respaldados; no redactes aún el guion.\\n\\n' + input,
        tools: [{ type: 'browser_search' }],
        tool_choice: 'required',
        reasoning: { effort: 'low' },
        max_output_tokens: 950,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      const outputText = data.output_text || (data.output || [])
        .filter(item => item.type === 'message')
        .flatMap(item => item.content || [])
        .filter(item => item.type === 'output_text')
        .map(item => item.text || '').join('\\n').trim();
      if (outputText.length >= 200) return outputText;
      throw new Error(`Groq browser_search terminó sin texto útil (status=${data.status || 'desconocido'}, output_items=${(data.output || []).length}).`);
    }
    const body = await response.text();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === maxAttempts) throw new Error(`Groq investigación ${response.status}: ${body.slice(0, 1200)}`);
    const retryMatch = body.match(/try again in ([0-9.]+)s/i);
    const waitSeconds = retryMatch ? Number(retryMatch[1]) + 2 : Math.min(15 * attempt, 60);
    console.warn(`Groq investigación: HTTP ${response.status}; reintento en ${waitSeconds}s.`);
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
  }
  throw new Error('Groq investigación: se agotaron los reintentos.');
}
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
  script = {
    title: imported.title,
    hook: imported.hook || '',
    narration: imported.narration || '',
    scenes: imported.visual_plan || [],
    sources: imported.source_notes || [],
    caption: imported.title + ' | Descubre lo que hay detrás. #BehindDelMundo',
    category: seriesRows.find(x => x.id === imported.series_id)?.slug || 'nadie-te-lo-explica',
  };
  scriptId = imported.id;
  wordCount = countWords(script.narration);
  await supabase('scripts', { method: 'PATCH', query: '?id=eq.' + scriptId, body: { status: 'in_production' } });
  console.log('Guion externo cargado desde el panel; no se llama a Groq.');
} else {
const research = await groqResearch(researchPrompt);
const categoryGuide = 'La categoría debe ser exactamente uno de estos slugs: nadie-te-lo-explica, detras-de-la-puerta, como-es-posible. La serie asignada para esta entrega es: ' + (series?.slug || 'nadie-te-lo-explica') + ' (' + (series?.title || 'Nadie te lo explica') + '). Mantén el tema dentro de esa línea editorial.';
const prompt = `A partir EXCLUSIVAMENTE de esta investigación web, escribe un vídeo vertical documental para Behind del Mundo en español natural de España. Fecha ${local}; horario ${slot}. Duración hablada objetivo 65-70 segundos, con 180-195 palabras reales de narración. Prioriza llegar a la duración mínima sin relleno: desarrolla contexto, progresión del descubrimiento y consecuencias verificables, manteniendo ritmo ágil y dicción clara. Abre con una imagen mental potente y un gancho intrigante en la primera frase. Construye una miniaventura: curiosidad inmediata, descubrimiento progresivo, giro o dato sorprendente a mitad, y cierre memorable. Habla como un narrador joven-adulto cercano, curioso y cinematográfico, nunca como un profesor dando una clase. Usa frases cortas y variadas, preguntas directas, contrastes y pausas naturales. Cuenta los hechos como un documental visual inmersivo. No existe presentador, avatar ni personaje recurrente: los protagonistas son los personajes históricos, animales, objetos, lugares y procesos reales de cada historia. Evita frases genéricas como “no te lo vas a creer”, clickbait engañoso, exageraciones y afirmaciones que no estén respaldadas. No inventes cifras, citas, lugares, testimonios ni fuentes. Distingue claramente hechos de hipótesis. No menciones que eres una IA ni pidas seguir la cuenta dentro de la narración.\n\nDIRECCIÓN EDITORIAL: ${categoryGuide}\n\nINVESTIGACIÓN Y FUENTES:\n${research}\n\nDevuelve SOLO un objeto JSON válido con: title (máx 70 caracteres, concreto y atractivo), hook (máx 12 palabras, primera frase potente), narration (180-195 palabras, locutable y natural, español de España, sin indicaciones de cámara), scenes (exactamente 7 objetos con visual, scene_type, setting, characters, props, action, camera, continuity, objects, overlay y narration_excerpt. setting: lugar y época concretos, mínimo 40 palabras. characters: array de personajes con role, appearance y action; [] si no hay personas. props: 3-8 objetos físicos concretos. action: acción visible específica, mínimo 35 palabras. camera: plano, ángulo y movimiento, mínimo 15 palabras. continuity: elementos que deben mantenerse o conectar con la siguiente escena, mínimo 20 palabras. visual: descripción cinematográfica completa, mínimo 100 palabras. Sin presentadores ni avatares. scene_type debe ser landscape, architecture, science, ocean, space, history, object o abstract; objects debe contener 3-8 elementos concretos; overlay máximo 4 palabras; narration_excerpt copia literalmente la narración), sources (mínimo 3 fuentes independientes con title y url; usa únicamente URLs HTTPS presentes literalmente en la investigación), caption (descripción breve para redes con 3-5 hashtags pertinentes), category (usa exactamente el slug de la serie asignada). No añadas explicaciones fuera del JSON.`;
const aiResponse = await groqChat({
    model: groqModel,
    messages: [
      { role: 'system', content: 'Eres el editor jefe de Behind del Mundo. Responde únicamente con un objeto JSON válido, sin Markdown ni texto fuera del JSON. No añadas fuentes ni URLs que no estén en la investigación proporcionada.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    reasoning_effort: 'low',
    temperature: 0.7,
    max_completion_tokens: 1750,
    stream: false,
  }, 'guion');
const ai = await aiResponse.json();
const outputText = ai.choices?.[0]?.message?.content?.trim();
if (!outputText) {
  const reason = ai.choices?.[0]?.finish_reason || 'sin respuesta';
  throw new Error(`Groq no devolvió texto de guion (motivo: ${reason}).`);
}
script = null;
try {
  const cleaned = outputText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('No se encontró objeto JSON.');
  script = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
} catch {
  throw new Error('Groq no devolvió JSON válido; se detiene antes de guardar datos incompletos.');
}

// Una sola llamada de redacción: evitamos gastar una segunda cuota de Groq
// corrigiendo longitud. El prompt pide 180-195 palabras y validamos un margen
// seguro; la duración final se comprueba sobre el MP4 real.
function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}
wordCount = countWords(script.narration);
if (wordCount < 145 || wordCount > 205) {
  throw new Error(`El guion tiene ${wordCount} palabras; fuera del margen técnico 145-205. Se detiene antes de generar voces o guardar un vídeo incompleto.`);
}
console.log(`Guion aceptado en una sola llamada: ${wordCount} palabras.`);
function topicTokens(value) {
  const stop = new Set('para como donde cuando desde hasta sobre entre hacia este esta estos estas unos unas una uno por con sin del las los que cual quien cómo qué muy más menos pero porque también entonces'.split(' '));
  return [...new Set(String(value || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').match(/[a-z0-9]{3,}/g) || [])].filter(x => !stop.has(x));
}
function overlap(a, b) {
  const A = new Set(topicTokens(a)), B = new Set(topicTokens(b));
  if (!A.size || !B.size) return 0;
  const shared = [...A].filter(x => B.has(x)).length;
  return shared / Math.min(A.size, B.size);
}
const candidateCore = [script.title, script.hook].join(' ');
const candidateNarration = script.narration || '';
const candidateUrls = new Set((script.sources || []).map(x => String(x.url || '').replace(/\/$/, '').toLowerCase()));
const collision = editorialMemory.find(item => {
  const oldCore = [item.topic, item.angle].join(' ');
  const titleScore = overlap(candidateCore, oldCore);
  const storyScore = overlap(candidateNarration, item.summary || '');
  const oldUrls = (item.source_urls || []).map(x => String(x.url || x || '').replace(/\/$/, '').toLowerCase());
  const sharedSources = oldUrls.filter(url => url && candidateUrls.has(url)).length;
  return titleScore >= 0.45 || (storyScore >= 0.24 && titleScore >= 0.18) || sharedSources >= 2;
});
if (collision) throw new Error(`MEMORIA EDITORIAL: producción bloqueada para evitar repetir "${script.title}". Se parece al tema histórico "${collision.topic}". No se ha guardado ni renderizado el vídeo.`);
if (!Array.isArray(script.scenes) || script.scenes.length !== 7) throw new Error('El guion debe incluir exactamente 7 escenas.');
if (!Array.isArray(script.sources) || script.sources.length < 3) throw new Error('El guion debe incluir al menos 3 fuentes verificables.');
for (const source of script.sources) {
  if (!source.url || !/^https:\/\//i.test(source.url)) throw new Error('Una fuente del guion no contiene una URL HTTPS válida.');
}
const [seriesMatch] = seriesRows.filter(x => x.slug === script.category);
const scriptRow = await supabase('scripts', { method: 'POST', body: {
  user_id: userId, series_id: seriesMatch?.id || series?.id || null,
  title: script.title, hook: script.hook || '', narration: script.narration,
  visual_plan: script.scenes, source_notes: script.sources,
  target_seconds: 60, status: 'in_production',
}});
scriptId = scriptRow[0].id;
}

// Validación común para guiones externos y automáticos antes de generar voz o vídeo.
wordCount = countWords(script.narration);
if (wordCount < 145 || wordCount > 205) throw new Error('El guion debe tener entre 145 y 205 palabras; recibido: ' + wordCount + '.');
if (!Array.isArray(script.scenes) || script.scenes.length !== 7) throw new Error('El guion debe incluir exactamente 7 escenas.');
if (!Array.isArray(script.sources) || script.sources.length < 3) throw new Error('El guion debe incluir al menos 3 fuentes.');
for (const [index, scene] of script.scenes.entries()) {
  if (!scene.visual || String(scene.visual).length < 100 || !scene.scene_type || !scene.setting || String(scene.setting).length < 40 || !scene.action || String(scene.action).length < 35 || !scene.camera || String(scene.camera).length < 15 || !scene.continuity || String(scene.continuity).length < 20 || !Array.isArray(scene.characters) || !Array.isArray(scene.props) || scene.props.length < 3 || scene.props.length > 8 || !Array.isArray(scene.objects) || scene.objects.length < 3 || scene.objects.length > 8 || !scene.overlay || !scene.narration_excerpt) throw new Error('La escena ' + (index + 1) + ' necesita dirección visual cinematográfica completa.');
  if (!script.narration.includes(scene.narration_excerpt)) throw new Error('El fragmento de narración de la escena ' + (index + 1) + ' no coincide con el texto hablado.');
}
for (const source of script.sources) if (!source.url || !/^https:\/\//i.test(source.url)) throw new Error('Una fuente no contiene una URL HTTPS válida.');

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
const work = path.join(root, 'renders', `${local}-${slot.replace(':', '')}`);
await mkdir(work, { recursive: true });
await writeFile(path.join(work, 'script.json'), JSON.stringify(script, null, 2));
const voicePath = path.join(work, 'voice.mp3');
const subtitlesPath = path.join(work, 'narration.srt');
await generateSpeech(script.narration, voicePath, 'es-ES-AlvaroNeural', '+0%', 'narrador principal', true, '+0Hz', subtitlesPath);
const voiceDuration = Number(await capture('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',voicePath]));
if (!Number.isFinite(voiceDuration) || voiceDuration < 1) throw new Error('No se pudo medir la duración de la narración.');
const targetDuration = Math.max(60, Math.ceil(voiceDuration + 1.2));
if (targetDuration > 72) throw new Error(`La narración dura ${voiceDuration.toFixed(1)} s; excede el máximo de 72 s. Se detiene sin recortar la voz.`);
console.log(`Narración: ${voiceDuration.toFixed(1)} s a +0%; duración final garantizada de al menos 60 s (montaje ${targetDuration} s).`);
await supabase('production_jobs', { method: 'PATCH', query: `?id=eq.${jobId}`, body: { status: 'rendering' } });
const escaped = value => String(value || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const assetsDir = path.join(work, 'assets');
await mkdir(assetsDir, { recursive: true });
const sceneSeconds = targetDuration / 7;
const clips = script.scenes.map((scene, i) => {
  const start = (i * sceneSeconds).toFixed(3), duration = sceneSeconds.toFixed(3);
  const sceneData = escaped(JSON.stringify({title:script.title,visual:scene.visual||'',setting:scene.setting||'',action:scene.action||'',camera:scene.camera||'',continuity:scene.continuity||'',characters:Array.isArray(scene.characters)?scene.characters:[],props:Array.isArray(scene.props)?scene.props:[],type:scene.scene_type||'object',objects:Array.isArray(scene.objects)?scene.objects.slice(0,8):[],index:i}));
  return '<section id="scene-'+(i+1)+'" class="clip scene motion-'+(i%4)+'" data-start="'+start+'" data-duration="'+duration+'" data-track-index="0"><canvas class="world-canvas" data-scene="'+sceneData+'"></canvas><div class="brand-mark">BEHIND <i>DEL MUNDO</i></div><div class="scene-copy"><h1>'+escaped(scene.overlay)+'</h1></div></section>';
}).join('');
const parseSrtTime = value => { const m=String(value).match(/(\\d+):(\\d{2}):(\\d{2}),(\\d{3})/); return m ? Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000 : 0; };
const srtText = await readFile(subtitlesPath,'utf8');
const srtBlocks = srtText.trim().split(/\\r?\\n\\s*\\r?\\n/);
const wordCues = srtBlocks.map(block=>{const lines=block.split(/\\r?\\n/);const ix=lines.findIndex(line=>line.includes('-->'));if(ix<0)return null;const [from,to]=lines[ix].split('-->').map(x=>x.trim());return {start:parseSrtTime(from),end:parseSrtTime(to),text:lines.slice(ix+1).join(' ').trim()};}).filter(Boolean);
const subtitleCues = [];
for(let i=0;i<wordCues.length;i+=4){const group=wordCues.slice(i,i+4);subtitleCues.push({start:group[0].start,end:group[group.length-1].end,text:group.map(x=>x.text).join(' ')});}
const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=1080,initial-scale=1"><style>'+
'*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#8ed0f0;font-family:Arial,sans-serif}.scene{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;background:linear-gradient(#82c9ef 0%,#c5e9f5 62%,#9bd38b 100%);isolation:isolate}.world-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0}.brand-mark{position:absolute;z-index:4;top:82px;left:70px;font:900 25px Arial;letter-spacing:5px;color:white;text-shadow:0 3px 12px #16334f}.brand-mark i{font-style:normal;color:#ffcf54}.scene-copy{position:absolute;z-index:4;left:70px;right:70px;top:270px;animation:enter .6s ease both}.scene h1{font-size:76px;line-height:1.02;font-weight:950;color:white;-webkit-text-stroke:2px #172b42;text-shadow:0 5px 0 #172b42,0 9px 24px #102a43}.timed-caption{position:absolute;z-index:8;left:70px;right:70px;bottom:190px;min-height:120px;text-align:center;font-size:48px;line-height:1.12;font-weight:950;color:#fff;-webkit-text-stroke:1.5px #101b2a;text-shadow:0 4px 0 #101b2a,0 7px 18px #101b2a;letter-spacing:.2px;pointer-events:none}@keyframes enter{from{opacity:0;transform:translateY(35px)}to{opacity:1;transform:none}}@keyframes word{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:none}}'+
'</style></head><body><div id="root" data-composition-id="behind-del-mundo" data-start="0" data-width="1080" data-height="1920"><div id="timed-caption" class="timed-caption"></div><audio id="narration-audio" src="voice.mp3" data-start="0" data-duration="'+targetDuration+'" data-track-index="0" data-volume="1"></audio>'+clips+'<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script><script type="module">'+
"import * as THREE from 'https://esm.sh/three@0.160.0';const M=c=>new THREE.MeshStandardMaterial({color:c,flatShading:true});const H=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};function cube(g,x,y,z,a,b,c,col){const o=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),M(col));o.position.set(x,y,z);g.add(o);return o}function ico(g,x,y,z,r,col){const o=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),M(col));o.position.set(x,y,z);g.add(o)}function makePerson(g,x,z,index){const group=new THREE.Group();group.position.set(x,0,z);const palette=['#6f3540','#315b79','#8c613d','#526b49','#8a784e'];const coat=M(palette[index%palette.length]),skin=M('#d5a47f'),dark=M('#352b28');const torso=new THREE.Mesh(new THREE.CylinderGeometry(.28,.4,1.05,7),coat);torso.position.y=1.05;group.add(torso);const head=new THREE.Mesh(new THREE.SphereGeometry(.27,8,7),skin);head.position.y=1.82;group.add(head);const hair=new THREE.Mesh(new THREE.SphereGeometry(.29,8,6),dark);hair.scale.set(1,.55,1);hair.position.y=2.02;group.add(hair);for(const side of [-1,1]){const arm=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.72,6),coat);arm.position.set(side*.38,1.18,0);arm.rotation.z=side*.18;group.add(arm);const leg=new THREE.Mesh(new THREE.CylinderGeometry(.11,.13,.72,6),dark);leg.position.set(side*.15,.36,0);group.add(leg);}g.add(group);return group;}function makeShip(g,x,z,index){const group=new THREE.Group();group.position.set(x,.1,z);group.userData.baseX=x;const wood=M('#68452f'),sail=M(index%2?'#e7dfc7':'#f2e8d2');const hull=new THREE.Mesh(new THREE.BoxGeometry(2.9,.48,1.05),wood);hull.position.y=.3;group.add(hull);const mast=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,2.5,6),wood);mast.position.set(-.1,1.65,0);group.add(mast);const sailMesh=new THREE.Mesh(new THREE.ConeGeometry(.85,1.5,3),sail);sailMesh.rotation.z=Math.PI/2;sailMesh.position.set(-.05,1.65,.08);group.add(sailMesh);g.add(group);return group;}function sceneFor(canvas,d){ const r=new THREE.WebGLRenderer({canvas,antialias:true});r.setPixelRatio(1);r.setSize(1080,1920,false);r.outputColorSpace=THREE.SRGBColorSpace; const s=new THREE.Scene();s.background=new THREE.Color('#8ed0f0');s.fog=new THREE.Fog('#b7e0ed',20,48); s.add(new THREE.HemisphereLight('#fff','#799d86',2));const l=new THREE.DirectionalLight('#fff0ce',2.4);l.position.set(-8,14,9);s.add(l); const g=new THREE.Group();s.add(g);const words=(d.title+' '+d.visual+' '+d.setting+' '+d.action+' '+d.continuity+' '+(d.objects||[]).join(' ')+' '+(d.props||[]).join(' ')).toLowerCase(); const water=d.type==='ocean'||/mar|oceano|agua|rio|barco|ballena|coral|submarin/.test(words); const space=d.type==='space'||/espacio|planeta|luna|estrella|orbita|galax|astronaut/.test(words); const arch=d.type==='architecture'||/edificio|constru|torre|puente|templo|ciudad|estructura|castillo/.test(words); const nature=d.type==='landscape'||/volcan|monta|bosque|arbol|selva|desierto|cueva|glaciar|cascada/.test(words); const science=d.type==='science'||/experimento|maquina|motor|energia|electric|laboratorio|fisica|robot/.test(words); const history=d.type==='history'||/antigu|romano|egipto|medieval|imperio|arqueolog|civilizacion|colon|reyes|castillo/.test(words);const actors=[];const movingProps=[];(d.characters||[]).slice(0,8).forEach((character,index)=>{actors.push(makePerson(g,(index-(Math.min((d.characters||[]).length,8)-1)/2)*1.8,1.8,index));});(d.props||[]).forEach((prop,index)=>{const name=String(prop).toLowerCase();if(/barco|carabela|navio|nave|ship/.test(name)){movingProps.push(makeShip(g,(index-1)*4,-2-index*.3,index));}else if(/castillo|palacio|fortaleza|torre/.test(name)){cube(g,(index-1)*3,1,-5,2.6,3,2.2,'#c9b99a');for(const side of [-1,1])cube(g,(index-1)*3+side*1.1,2.2,-5,.55,1.2,.55,'#a98d6b');}else if(/corona|crown/.test(name)){const ring=new THREE.Mesh(new THREE.TorusGeometry(.55,.13,6,12),M('#e8b83f'));ring.position.set((index-1)*2,1.4,1);ring.rotation.x=Math.PI/2;g.add(ring);}else if(/mapa|map|carta/.test(name)){cube(g,(index-1)*2,.18,1,2,.12,1.5,'#d9c18c');}else if(/muelle|puerto|embarcadero/.test(name)){cube(g,(index-1)*3,.2,-1,4,.4,1.2,'#805c3b');}else if(/arbol|palmera|tree/.test(name)){cube(g,(index-1)*2,.8,-2,.22,1.6,.22,'#765034');ico(g,(index-1)*2,1.9,-2,.9,'#398653');}else{cube(g,(index-1)*2,.6,1,1.25,1.2,.9,['#d8b47b','#7d9fb1','#b77b63','#718b69'][index%4]);}}); cube(g,0,-.55,-3,26,.8,26,water?'#247eaa':space?'#29366f':(arch||history)?'#a69a86':science?'#8294a3':'#8bcf79'); if(water){cube(g,0,-.04,-3,25,.16,25,'#269dc7');for(let i=0;i<32;i++)cube(g,(H(i)-.5)*20,.08,(H(i+9)-.5)*20,.4+H(i+4),.025,.08,'#b2f1ef');} if(space){s.background.set('#29366f');s.fog.color.set('#29366f');ico(g,-2,3,-5,2.1,'#e8a65d');for(let i=0;i<55;i++)ico(g,(H(i+2)-.5)*22,H(i+40)*12,-8-H(i+50)*10,.04+H(i)*.08,'#fff');} if(nature){for(let i=0;i<15;i++){const x=(H(i)-.5)*17,z=(H(i+10)-.5)*14;cube(g,x,.55,z,.22,1.1,.22,'#805b3b');for(let j=0;j<3;j++){const o=new THREE.Mesh(new THREE.ConeGeometry(.85-j*.13,1.25,5),M(j%2?'#4caa70':'#75bd70'));o.position.set(x,1.3+j*.55,z);g.add(o);}}if(/volcan/.test(words)){const cone=new THREE.Mesh(new THREE.ConeGeometry(4,6,7),M('#8d6555'));cone.position.set(0,2,-5);g.add(cone);ico(g,0,5,-5,1.1,'#f18b43');}} if(arch||history){s.background.set('#d8c7a8');s.fog.color.set('#d8c7a8');for(let y=0;y<4;y++){cube(g,0,y*.8+.3,-4,3,.16,2.5,'#e9e3d7');for(const x of [-1.3,1.3])cube(g,x,y*.8+.65,-4,.18,.8,.18,'#173b60');}for(let i=0;i<5;i++)cube(g,(i-2)*2.5,.7,1,1.2,1.4,1,['#f1c98e','#e8a6a0','#9cc8dc'][i%3]);if(/piram|egipto/.test(words)){for(let i=0;i<3;i++){const p=new THREE.Mesh(new THREE.ConeGeometry(2.7-i*.45,3.8-i*.5,4),M('#d6ad72'));p.rotation.y=Math.PI/4;p.position.set((i-1)*5,1.7,-7);g.add(p);}}} if(science){for(let i=0;i<4;i++){cube(g,(i-1.5)*2,.6,-3,.55,1.3,.55,['#ff9e57','#51c7bf','#a68de0','#f0cf62'][i]);ico(g,(i-1.5)*2,1.5,-3,.4,['#ffbd62','#63e0d0','#c1a4ff','#ffe07a'][i]);}} if(!water&&!space&&!arch&&!nature&&!science&&!history){for(let i=0;i<8;i++)cube(g,(i-3.5)*1.65,.5,-3,1,1,1,['#f5b85d','#5bc8bd','#ef8e9d','#8b9fe8'][i%4]);} (d.objects||[]).slice(0,4).forEach((label,i)=>{const name=String(label).toLowerCase();if(/barco|carabela|navio|nave/.test(name))movingProps.push(makeShip(g,(i-1.5)*3,3,i));else if(/persona|marinero|soldado|rey|reina|colon/.test(name))actors.push(makePerson(g,(i-1.5)*2.2,2.5,i));else cube(g,(i-1.5)*2.7,.7,2,1.3,1.4,1,['#d8b47b','#7d9fb1','#b77b63','#718b69'][i%4]);}); for(let i=0;i<5;i++)for(let j=0;j<3;j++)ico(g,(i-2)*4,6+j*.3,-8,.45,'#fff'); const cam=new THREE.PerspectiveCamera(43,1080/1920,.1,100);return q=>{const phase=(q%8)/8;cam.position.x=7*Math.sin(q*.22+d.index*.7)+(phase-.5)*2.2;cam.position.y=5.2+Math.sin(q*.38)*.8;cam.position.z=15-2.2*Math.sin(q*.19);if(/primer plano|detalle|close.?up/i.test(String(d.camera||''))){cam.position.z=9;cam.position.y=3.5;}if(/a[eé]reo|cenital|desde arriba|overhead/i.test(String(d.camera||''))){cam.position.y=13;cam.position.z=10;}if(/contrapicado|desde abajo|low angle/i.test(String(d.camera||''))){cam.position.y=2.1;cam.position.z=13;}cam.lookAt(Math.sin(q*.24),1,-3);g.rotation.y=Math.sin(q*.16+d.index)*.07;g.children.forEach((o,i)=>{if(i>2&&i<18){o.rotation.y=i*.035+Math.sin(q*1.2+i)*.12;}});actors.forEach((actor,i)=>{actor.position.y=.035*Math.sin(q*2+i);actor.rotation.y=.08*Math.sin(q*.8+i);});movingProps.forEach((prop,i)=>{prop.position.x=(prop.userData.baseX||0)+(/navega|avanza|sale del puerto|se acerca a la costa|llega a la playa/i.test(String(d.action||''))?q*.12:0)+.12*Math.sin(q*.7+i);prop.rotation.y=.025*Math.sin(q+i);});r.render(s,cam);};}const sceneRenderers=Array.from(document.querySelectorAll('.world-canvas')).map(c=>{try{return sceneFor(c,JSON.parse(c.dataset.scene))}catch(e){console.error(e);return ()=>{};}});const tl=gsap.timeline({paused:true});const subtitleCues='+JSON.stringify(subtitleCues)+';const caption=document.getElementById('timed-caption');subtitleCues.forEach(cue=>{tl.call(()=>{caption.textContent=cue.text;},null,cue.start);tl.call(()=>{caption.textContent='';},null,cue.end);});document.querySelectorAll('.scene').forEach(e=>{tl.fromTo(e,{opacity:0},{opacity:1,duration:.25},Number(e.dataset.start));tl.to(e,{opacity:0,duration:.2},Number(e.dataset.start)+Number(e.dataset.duration)-.2)});tl.set({}, {},"+targetDuration+");tl.eventCallback('onUpdate',()=>{const q=tl.time();sceneRenderers.forEach(render=>render(q));});sceneRenderers.forEach(render=>render(0));window.__timelines=window.__timelines||{};window.__timelines['behind-del-mundo']=tl;"+
'</script></div></body></html>';
await writeFile(path.join(work, 'index.html'), html);
await command('npx', ['--yes', 'hyperframes@0.9.37', 'lint'], { cwd: work });
const imageCount = script.scenes.length; // Siete escenas 3D renderizadas; ya no dependemos de siete fotos externas.
const rawVideo = path.join(work, 'video-silent.mp4');
await command('npx', ['--yes', 'hyperframes@0.9.37', 'render', '-c', 'index.html', '-o', rawVideo, '--fps', '30', '--quality', 'standard', '--workers', '1'], { cwd: work });
const finalPath = path.join(root, 'renders', `behind-del-mundo-${local}-${slot.replace(':','')}.mp4`);
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
storagePath = `${userId}/${local}/${slot.replace(':','')}.mp4`;
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
  quality_check:{passed:true, duration_seconds:actualDuration, bytes:stat.size, has_audio:true, visual_assets:imageCount, visual_sources:script.scenes.map((scene,index)=>({scene:index+1,type:scene.scene_type||'object',description:scene.visual,objects:scene.objects||[]})), sources:script.sources.length, word_count:wordCount, voice:'es-ES-AlvaroNeural', voice_rate:'+0%', rendered_by:'HyperFrames + Three.js', visual_style:'low-poly-3d-exploration-v1'},

}});
const topicKey = String(script.title || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
await supabase('editorial_memory', { method: 'POST', body: {
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
