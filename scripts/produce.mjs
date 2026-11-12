import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slots = ['07:30', '14:30', '20:30'];
const tz = 'Europe/Madrid';
const now = new Date();
const local = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
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
if (!process.env.MANUAL_SLOT && nearestSlot.distance > 0) {
  console.warn(`Inicio de GitHub Actions a las ${localTime}; se asigna al horario más cercano ${slot} (desfase ${nearestSlot.distance} min).`);
}
if (!process.env.GROQ_API_KEY) throw new Error('Falta GROQ_API_KEY (GroqCloud).');
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
const [settings] = await supabase('channel_settings', { query: '?brand_slug=eq.nexo-raro&select=id,user_id,channel_name,timezone,require_approval,auto_publish_enabled&limit=1' });
if (!settings) throw new Error('No hay una cuenta configurada en el panel. Inicia sesión y termina el asistente inicial.');
const userId = settings.user_id;
const scheduledAt = new Date(new Date(`${local}T${slot}:00`).toLocaleString('en-US', { timeZone: tz })).toISOString();
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
const memoryBrief = editorialMemory.slice(0,40).map(item => ({ tema:item.topic, enfoque:String(item.angle||'').slice(0,70) }));
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
        max_output_tokens: 2200,
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
const research = await groqResearch(researchPrompt);
const categoryGuide = 'La categoría debe ser exactamente uno de estos slugs: nadie-te-lo-explica, detras-de-la-puerta, como-es-posible. La serie asignada para esta entrega es: ' + (series?.slug || 'nadie-te-lo-explica') + ' (' + (series?.title || 'Nadie te lo explica') + '). Mantén el tema dentro de esa línea editorial.';
const prompt = `A partir EXCLUSIVAMENTE de esta investigación web, escribe un vídeo vertical documental para Behind del Mundo en español natural de España. Fecha ${local}; horario ${slot}. Duración hablada 62-68 segundos, con 165-180 palabras reales de narración, ritmo ágil y dicción clara. Abre con una imagen mental potente y un gancho intrigante en la primera frase. Construye una miniaventura: curiosidad inmediata, descubrimiento progresivo, giro o dato sorprendente a mitad, y cierre memorable. Habla como un narrador joven-adulto cercano, curioso y cinematográfico, nunca como un profesor dando una clase. Usa frases cortas y variadas, preguntas directas, contrastes y pausas naturales. Cuenta los hechos desde lo que nuestro explorador Enzo ha descubierto o vivido. Incluye en 2 o 3 escenas una intervención muy breve de Enzo (máximo 5 palabras, espontánea y expresiva, no infantil) en el campo enzo_line; el narrador principal sigue llevando la historia. Evita frases genéricas como “no te lo vas a creer”, clickbait engañoso, exageraciones y afirmaciones que no estén respaldadas. No inventes cifras, citas, lugares, testimonios ni fuentes. Distingue claramente hechos de hipótesis. No menciones que eres una IA ni pidas seguir la cuenta dentro de la narración.\n\nDIRECCIÓN EDITORIAL: ${categoryGuide}\n\nINVESTIGACIÓN Y FUENTES:\n${research}\n\nDevuelve SOLO un objeto JSON válido con: title (máx 70 caracteres, concreto y atractivo), hook (máx 12 palabras, primera frase potente), narration (165-180 palabras, locutable y natural, español de España, sin indicaciones de cámara), scenes (exactamente 7 objetos con visual, image_search_query, overlay, narration_excerpt y enzo_line; visual debe describir un plano concreto, cinematográfico y distinto de los demás; image_search_query debe ser una búsqueda corta en INGLÉS con el sujeto visual específico para encontrar fotografía real; overlay máximo 5 palabras, sin recuadros ni frases largas; narration_excerpt debe copiar literalmente un fragmento de la narración; enzo_line puede estar vacío o ser una reacción breve), sources (mínimo 3 fuentes independientes con title y url; usa únicamente URLs HTTPS presentes literalmente en la investigación), caption (descripción breve para redes con 3-5 hashtags pertinentes), category (usa exactamente el slug de la serie asignada). No añadas explicaciones fuera del JSON.`;
const aiResponse = await groqChat({
    model: groqModel,
    messages: [
      { role: 'system', content: 'Eres el editor jefe de Behind del Mundo. Responde únicamente con un objeto JSON válido, sin Markdown ni texto fuera del JSON. No añadas fuentes ni URLs que no estén en la investigación proporcionada.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    reasoning_effort: 'low',
    temperature: 0.7,
    max_completion_tokens: 2800,
    stream: false,
  }, 'guion');
const ai = await aiResponse.json();
const outputText = ai.choices?.[0]?.message?.content?.trim();
if (!outputText) {
  const reason = ai.choices?.[0]?.finish_reason || 'sin respuesta';
  throw new Error(`Groq no devolvió texto de guion (motivo: ${reason}).`);
}
let script;
try {
  const cleaned = outputText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('No se encontró objeto JSON.');
  script = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
} catch {
  throw new Error('Groq no devolvió JSON válido; se detiene antes de guardar datos incompletos.');
}

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
const wordCount = String(script.narration || '').trim().split(/\s+/).filter(Boolean).length;
if (wordCount < 165 || wordCount > 180) throw new Error(`El guion tiene ${wordCount} palabras; se requieren entre 165 y 180 para la duración editorial.`);
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
  target_seconds: 64, status: 'in_production',
}});
const scriptId = scriptRow[0].id;

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
await command('python', ['-m', 'edge_tts', '--voice', 'es-ES-AlvaroNeural', '--rate=+8%', '--text', script.narration, '--write-media', voicePath]);
await supabase('production_jobs', { method: 'PATCH', query: `?id=eq.${jobId}`, body: { status: 'rendering' } });
const escaped = value => String(value || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const assetsDir = path.join(work, 'assets');
await mkdir(assetsDir, { recursive: true });
const usedImagePages = new Set();
async function fetchSceneImage(scene, index) {
  const clean = value => String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const visualTerms = String(scene.image_search_query || '').trim() || topicTokens(scene.visual).slice(0, 5).join(' ');
  const titleTerms = topicTokens(script.title).slice(0, 4).join(' ');
  const queries = [...new Set([
    visualTerms,
    [titleTerms, visualTerms].filter(Boolean).join(' '),
    titleTerms,
  ].filter(Boolean))];
  for (const query of queries) {
    try {
      const endpoint = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=30&gsrwhat=text|title&gsrsearch=' + encodeURIComponent(query) + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&format=json';
      const search = await fetch(endpoint, { headers: { 'User-Agent': 'BehindDelMundoStudio/1.0 (documentary video production)' } });
      if (!search.ok) continue;
      const data = await search.json();
      const pages = Object.values(data.query?.pages || {});
      for (const page of pages) {
        const info = page.imageinfo?.[0];
        const pageKey = String(info?.descriptionurl || page.title || '');
        if (!info?.thumburl || usedImagePages.has(pageKey) || !/^https:\/\//i.test(info.thumburl)) continue;
        const response = await fetch(info.thumburl, { headers: { 'User-Agent': 'BehindDelMundoStudio/1.0' } });
        if (!response.ok) continue;
        const mime = response.headers.get('content-type') || '';
        if (!mime.startsWith('image/')) continue;
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length < 12000) continue;
        const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
        const filename = 'scene-' + (index + 1) + '.' + ext;
        await writeFile(path.join(assetsDir, filename), bytes);
        usedImagePages.add(pageKey);
        const artist = clean(info.extmetadata?.Artist?.value || 'Wikimedia Commons');
        const license = clean(info.extmetadata?.LicenseShortName?.value || 'Licencia indicada en Commons');
        return { filename, alt: scene.visual, credit: artist + ' · ' + license, page: info.descriptionurl || page.title };
      }
    } catch (error) {
      console.warn('Búsqueda visual de escena ' + (index + 1) + ' (' + query + ') fallida: ' + error.message);
    }
  }
  console.warn('No se encontró imagen válida para la escena ' + (index + 1) + ': ' + scene.visual);
  return null;
}
const sceneAssets = [];
for (let index = 0; index < script.scenes.length; index++) sceneAssets.push(await fetchSceneImage(script.scenes[index], index));
const imageCount = sceneAssets.filter(Boolean).length;
console.log('Recursos visuales: ' + imageCount + '/7 imágenes únicas de Wikimedia Commons descargadas.');
if (imageCount < 5) throw new Error(`QC visual fallido: solo se encontraron ${imageCount}/7 imágenes reales. Se cancela el render para evitar un vídeo con diapositivas vacías.`);
const sceneSeconds = 64 / 7;
const clips = script.scenes.map((scene, i) => {
  const start = (i * sceneSeconds).toFixed(3);
  const duration = sceneSeconds.toFixed(3);
  const asset = sceneAssets[i];
  const imageMarkup = asset
    ? '<img class="scene-image" src="./assets/' + asset.filename + '" alt="' + escaped(asset.alt) + '">'
    : '<div class="scene-atmosphere" aria-hidden="true"></div>';
  const words = String(scene.narration_excerpt || '').trim().split(/\\s+/).filter(Boolean);
  const captionMarkup = words.map((word, index) => '<span class="caption-word" style="--word:' + index + '">' + escaped(word) + '</span>').join(' ');
  return `<section id="scene-${i+1}" class="clip scene" data-start="${start}" data-duration="${duration}" data-track-index="0">
    ${imageMarkup}
    <div class="cinema-shade"></div>
    <div class="brand-mark">BEHIND <i>DEL MUNDO</i></div>
    <div class="scene-copy">
      <div class="scene-kicker">LO QUE HAY DETRÁS</div>
      <h1>${escaped(scene.overlay)}</h1>
    </div>
    <div class="caption" aria-label="${escaped(scene.narration_excerpt)}">${captionMarkup}</div>
  </section>`;
}).join('');
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=1080,initial-scale=1"><style>
*{box-sizing:border-box}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#080d12;color:#fff;font-family:Arial,Helvetica,sans-serif}
.scene{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;background:#101820;isolation:isolate}
.scene-image,.scene-atmosphere{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3;transform:scale(1.12);animation:slowPush 9.2s ease-out both}
.scene-atmosphere{background:radial-gradient(ellipse at 60% 35%,#315064 0%,#172630 42%,#080d12 100%)}
.cinema-shade{position:absolute;inset:0;z-index:-2;background:linear-gradient(180deg,rgba(5,10,15,.24) 0%,rgba(5,10,15,.05) 30%,rgba(5,10,15,.12) 50%,rgba(5,10,15,.86) 100%),linear-gradient(90deg,rgba(5,10,15,.22),transparent 75%)}
.brand-mark{position:absolute;top:92px;left:76px;font:800 25px Arial,sans-serif;letter-spacing:5px;color:#fff;text-shadow:0 2px 20px #0008}
.brand-mark i{font-style:normal;color:#8fd8c2}
.scene-copy{position:absolute;left:76px;right:76px;bottom:560px;animation:copyIn .65s cubic-bezier(.2,.8,.2,1) both}
.scene-kicker{display:inline-block;margin-bottom:28px;padding:0 0 12px;border-bottom:4px solid #f0a65b;font:800 19px Arial,sans-serif;letter-spacing:5px;color:#f0a65b}
.scene h1{margin:0;max-width:930px;font-size:94px;line-height:.98;letter-spacing:-5px;font-weight:900;text-wrap:balance;text-shadow:0 6px 34px #000b}
.caption{position:absolute;left:76px;right:76px;bottom:230px;min-height:150px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px 13px;font-size:43px;line-height:1.16;font-weight:900;letter-spacing:-1.4px;text-shadow:0 3px 16px #000,0 1px 4px #000}
.caption span{display:inline-block;opacity:0;transform:translateY(18px) scale(.96);animation:wordPop .26s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(var(--word)*.17s)}
.caption span:nth-child(4n+1){color:#fff}
.caption span:nth-child(4n+2){color:#8fd8c2}
.caption span:nth-child(4n+3){color:#fff}
.caption span:nth-child(4n){color:#f0a65b}
@keyframes slowPush{from{transform:scale(1.12)}to{transform:scale(1.02)}}
@keyframes copyIn{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:translateY(0)}}
@keyframes wordPop{to{opacity:1;transform:translateY(0) scale(1)}}
</style></head><body><div id="root" data-composition-id="behind-del-mundo" data-start="0" data-width="1080" data-height="1920"><audio id="narration-audio" src="voice.mp3" data-start="0" data-duration="64" data-track-index="0" data-volume="1"></audio>${clips}<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script><script>const tl=gsap.timeline({paused:true});document.querySelectorAll('.scene').forEach((el)=>{tl.fromTo(el,{opacity:0},{opacity:1,duration:.35},Number(el.dataset.start));tl.to(el,{opacity:0,duration:.28},Number(el.dataset.start)+Number(el.dataset.duration)-.28)});tl.set({}, {}, 64);window.__timelines=window.__timelines||{};window.__timelines['behind-del-mundo']=tl;</script></div></body></html>`;
await writeFile(path.join(work, 'index.html'), html);
await command('npx', ['--yes', 'hyperframes@0.9.37', 'lint'], { cwd: work });
const rawVideo = path.join(work, 'video-silent.mp4');
await command('npx', ['--yes', 'hyperframes@0.9.37', 'render', '-c', 'index.html', '-o', rawVideo, '--fps', '30', '--quality', 'standard', '--workers', '1'], { cwd: work });
const finalPath = path.join(root, 'renders', `behind-del-mundo-${local}-${slot.replace(':','')}.mp4`);
// HyperFrames incorpora la narración como pista de audio del timeline. No volver a muxear
// con -shortest: eso truncaba el vídeo al terminar la voz (48 s en la prueba anterior).
await command('ffmpeg', ['-y','-i',rawVideo,'-af','apad','-t','64','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',finalPath]);
const stat = await (await import('node:fs/promises')).stat(finalPath);
if (stat.size < 500000) throw new Error('El MP4 generado parece incompleto.');

const probeText = await capture('ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',finalPath]);
const probe = JSON.parse(probeText);
const actualDuration = Number(probe.format?.duration || 0);
const videoStream = (probe.streams || []).find(stream => stream.codec_type === 'video');
const audioStream = (probe.streams || []).find(stream => stream.codec_type === 'audio');
if (!videoStream || videoStream.width !== 1080 || videoStream.height !== 1920) throw new Error('QC fallido: el MP4 no tiene vídeo vertical 1080×1920.');
if (!audioStream) throw new Error('QC fallido: el MP4 no contiene pista de audio.');
if (actualDuration < 55 || actualDuration > 70) throw new Error(`QC fallido: duración real ${actualDuration.toFixed(1)} s fuera del margen 55–70 s.`);
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
  quality_check:{passed:true, duration_seconds:actualDuration, bytes:stat.size, has_audio:true, visual_assets:imageCount, visual_sources:sceneAssets.filter(Boolean).map(({page,credit,alt})=>({page,credit,alt})), sources:script.sources.length, word_count:wordCount, voice:'es-ES-AlvaroNeural', voice_rate:'+8%', rendered_by:'HyperFrames', visual_style:'cinematic-dynamic-v2'},

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
        method: 'DELETE', headers,
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
  if (jobId) {
    await cleanupStep('trabajo de producción', () =>
      supabase('production_jobs', { method: 'DELETE', query: `?id=eq.${jobId}` }));
  } else if (existingJob?.status === 'failed') {
    await cleanupStep('trabajo fallido previo', () =>
      supabase('production_jobs', { method: 'DELETE', query: `?id=eq.${existingJob.id}&status=eq.failed` }));
  } else {
    await cleanupStep('trabajos de producción parciales', () =>
      supabase('production_jobs', { method: 'DELETE', query: `?script_id=eq.${scriptId}` }));
  }
  await cleanupStep('guion de prueba', () =>
    supabase('scripts', { method: 'DELETE', query: `?id=eq.${scriptId}` }));
  throw productionError;
}
