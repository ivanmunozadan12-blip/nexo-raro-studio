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
const slot = process.env.MANUAL_SLOT || slots.find(s => s === localTime);
if (!slot || !slots.includes(slot)) {
  console.log(`No coincide con un horario de producción (${localTime} ${tz}). Se omite sin crear trabajo.`);
  process.exit(0);
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
  throw new Error(`SUPABASE_URL apunta al proyecto "${actualProjectRef}", pero Nexo Raro está configurado en "${expectedProjectRef}". Corrige el secreto SUPABASE_URL en GitHub.`);
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
const existing = await supabase('production_jobs', { query: `?user_id=eq.${userId}&scheduled_for=eq.${encodeURIComponent(scheduledAt)}&select=id,status,attempt_count&limit=1` });
if (existing.length && ['queued', 'voicing', 'rendering', 'ready'].includes(existing[0].status)) {
  console.log(`El horario ${local} ${slot} ya tiene un trabajo (${existing[0].status}); se evita duplicar.`);
  process.exit(0);
}
const seriesRows = await supabase('series', { query: `?user_id=eq.${userId}&is_active=eq.true&select=id,slug,title,description&order=slug.asc` });
const series = seriesRows.length ? seriesRows[(slots.indexOf(slot) + Number(local.replaceAll('-', ''))) % seriesRows.length] : null;

const editorialMemory = await supabase('editorial_memory', { query: `?user_id=eq.${userId}&select=topic,topic_key,angle,summary,source_urls,memory_status,created_at&order=created_at.desc&limit=300` });
const memoryBrief = editorialMemory.slice(0,100).map(item => ({ tema:item.topic, enfoque:String(item.angle||'').slice(0,90), resumen:String(item.summary||'').slice(0,140), estado:item.memory_status, fuentes:(item.source_urls||[]).slice(0,2).map(x=>x.url||x) }));
console.log(`Memoria editorial cargada: ${memoryBrief.length} temas históricos.`);
const researchPrompt = `Busca en la web un hecho real, poco conocido y visualmente atractivo para un vídeo documental breve en español de España. Fecha: ${local}; horario: ${slot}; serie editorial: ${series?.title || 'curiosidades reales y ciencia sorprendente'}. Evita temas virales quemados. MEMORIA EDITORIAL OBLIGATORIA: no propongas el mismo acontecimiento, descubrimiento, lugar, personaje, experimento ni historia que aparezca en esta memoria, aunque cambies el título o el enfoque. Elige un asunto claramente distinto y explica por qué no se solapa. Historial (últimos 300 temas): ${JSON.stringify(memoryBrief)}. Si una idea se parece a un tema del historial, descártala y busca otra. Contrasta el hecho con al menos 3 fuentes independientes, preferiblemente fuentes primarias, universidades, organismos oficiales o publicaciones científicas. Devuelve un resumen claro de los hechos verificables, qué partes son inciertas, las URLs exactas y una línea TOPIC: con el tema principal. No inventes referencias.`;
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
const prompt = `A partir EXCLUSIVAMENTE de esta investigación web, escribe un vídeo vertical documental para Nexo Raro en español natural de España. Fecha ${local}; horario ${slot}. Duración hablada 60-68 segundos, con 125-145 palabras reales de narración. Abre con un gancho intrigante en los primeros 2 segundos, plantea una pregunta concreta, desarrolla el hecho con claridad y termina con una revelación o idea memorable. Evita frases genéricas como “no te lo vas a creer”, clickbait engañoso, exageraciones y afirmaciones que no estén respaldadas. No inventes cifras, citas, lugares, testimonios ni fuentes. Distingue claramente hechos de hipótesis. No menciones que eres una IA ni pidas seguir la cuenta dentro de la narración.\n\nDIRECCIÓN EDITORIAL: ${categoryGuide}\n\nINVESTIGACIÓN Y FUENTES:\n${research}\n\nDevuelve SOLO un objeto JSON válido con: title (máx 70 caracteres, concreto y atractivo), hook (máx 12 palabras, primera frase potente), narration (125-145 palabras, locutable y natural, sin indicaciones de cámara), scenes (exactamente 7 objetos con visual, overlay y narration_excerpt; cada visual debe describir una imagen o plano concreto que pueda ilustrar la escena, cada overlay debe tener como máximo 8 palabras y narration_excerpt debe copiar literalmente un fragmento de la narración), sources (mínimo 3 fuentes independientes con title y url; usa únicamente URLs HTTPS presentes literalmente en la investigación), caption (descripción breve para redes con 3-5 hashtags pertinentes), category (usa exactamente el slug de la serie asignada). No añadas explicaciones fuera del JSON.`;
const aiResponse = await groqChat({
    model: groqModel,
    messages: [
      { role: 'system', content: 'Eres el editor jefe de Nexo Raro. Responde únicamente con un objeto JSON válido, sin Markdown ni texto fuera del JSON. No añadas fuentes ni URLs que no estén en la investigación proporcionada.' },
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
  return [...new Set(String(value || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').match(/[a-z0-9]{3,}/g) || [])].filter(x => !stop.has(x));
}
function overlap(a, b) {
  const A = new Set(topicTokens(a)), B = new Set(topicTokens(b));
  if (!A.size || !B.size) return 0;
  return [...A].filter(x => B.has(x)).length / new Set([...A, ...B]).size;
}
const candidateText = [script.title, script.hook, script.narration].join(' ');
const candidateUrls = new Set((script.sources || []).map(x => String(x.url || '').replace(/\\/$/, '').toLowerCase()));
const collision = editorialMemory.find(item => {
  const oldText = [item.topic, item.angle, item.summary].join(' ');
  const titleScore = overlap(script.title, item.topic);
  const storyScore = overlap(candidateText, oldText);
  const oldUrls = (item.source_urls || []).map(x => String(x.url || x || '').replace(/\\/$/, '').toLowerCase());
  const sharedSources = oldUrls.filter(url => url && candidateUrls.has(url)).length;
  return titleScore >= 0.62 || (storyScore >= 0.46 && titleScore >= 0.25) || sharedSources >= 2;
});
if (collision) throw new Error(`MEMORIA EDITORIAL: producción bloqueada para evitar repetir "${script.title}". Se parece al tema histórico "${collision.topic}". No se ha guardado ni renderizado el vídeo.`);
const wordCount = String(script.narration || '').trim().split(/\s+/).filter(Boolean).length;
if (wordCount < 105 || wordCount > 165) throw new Error(`El guion tiene ${wordCount} palabras; se requieren entre 105 y 165.`);
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

const topicKey = String(script.title || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
await supabase('editorial_memory', { method: 'POST', body: {
  user_id: userId, script_id: scriptId, topic: script.title, topic_key: topicKey,
  angle: script.hook || '', summary: String(script.narration || '').slice(0, 1200),
  source_urls: script.sources || [], memory_status: 'produced',
}});
let jobId;
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
await command('python', ['-m', 'edge_tts', '--voice', 'es-ES-AlvaroNeural', '--rate=-4%', '--text', script.narration, '--write-media', voicePath]);
await supabase('production_jobs', { method: 'PATCH', query: `?id=eq.${jobId}`, body: { status: 'rendering' } });
const escaped = value => String(value || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sceneSeconds = 64 / 7;
const clips = script.scenes.map((scene, i) => {
  const start = (i * sceneSeconds).toFixed(3);
  const duration = sceneSeconds.toFixed(3);
  const tint = i % 2 ? '#172630' : '#101c25';
  return `<section id="scene-${i+1}" class="clip scene" data-start="${start}" data-duration="${duration}" data-track-index="0" style="background:${tint}"><div class="grid"></div><div class="eyebrow">NEXO RARO / ARCHIVO ${String(i + 1).padStart(2,'0')}</div><div class="number">0${i + 1}<span>— 07</span></div><div class="visual">${escaped(scene.visual)}</div><h1>${escaped(scene.overlay)}</h1><div class="subtitle">${escaped(scene.narration_excerpt)}</div><div class="rule"></div><div class="footer">EXPLORA LO EXTRAORDINARIO <b>●</b> ${local}</div></section>`;
}).join('');
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#0b1218;color:#f1eee5;font-family:Arial,sans-serif}.scene{position:absolute;inset:0;width:1080px;height:1920px;padding:120px 88px;overflow:hidden}.grid{position:absolute;inset:0;opacity:.16;background-image:linear-gradient(#8fd8c2 1px,transparent 1px),linear-gradient(90deg,#8fd8c2 1px,transparent 1px);background-size:90px 90px;mask-image:linear-gradient(transparent,#000 30%,transparent)}.eyebrow,.footer{position:absolute;left:88px;right:88px;font:22px monospace;letter-spacing:6px;color:#8fd8c2}.eyebrow{top:112px}.number{position:absolute;top:280px;right:88px;font:42px monospace;color:#f0a65b}.number span{font-size:20px;color:#87959b}.visual{position:absolute;left:88px;right:88px;top:560px;min-height:300px;font-size:40px;line-height:1.2;color:#f0a65b;letter-spacing:-1px}.scene h1{position:absolute;left:88px;right:88px;top:880px;margin:0;font-size:82px;line-height:1.08;letter-spacing:-4px;font-weight:800}.subtitle{position:absolute;left:88px;right:88px;top:1320px;font-size:38px;line-height:1.3;color:#f1eee5;background:#172630dd;padding:24px 28px;border-left:6px solid #f0a65b}.rule{position:absolute;left:88px;bottom:250px;width:150px;height:6px;background:#8fd8c2}.footer{bottom:120px;font-size:17px;color:#87959b;letter-spacing:3px}.footer b{color:#f0a65b}</style></head><body><div id="root" data-composition-id="nexo-raro" data-start="0" data-width="1080" data-height="1920">${clips}<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script><script>const tl=gsap.timeline({paused:true});document.querySelectorAll('.scene').forEach((el)=>{tl.fromTo(el,{opacity:0,scale:1.025},{opacity:1,scale:1,duration:.55},Number(el.dataset.start));tl.to(el,{opacity:0,duration:.4},Number(el.dataset.start)+Number(el.dataset.duration)-.4)});tl.set({}, {}, 64);window.__timelines=window.__timelines||{};window.__timelines['nexo-raro']=tl;</script></div></body></html>`;
await writeFile(path.join(work, 'index.html'), html);
await command('npx', ['--yes', 'hyperframes@0.9.37', 'lint'], { cwd: work });
const rawVideo = path.join(work, 'video-silent.mp4');
await command('npx', ['--yes', 'hyperframes@0.9.37', 'render', '-c', 'index.html', '-o', rawVideo, '--fps', '30', '--quality', 'standard', '--workers', '1'], { cwd: work });
const finalPath = path.join(root, 'renders', `nexo-raro-${local}-${slot.replace(':','')}.mp4`);
await command('ffmpeg', ['-y','-i',rawVideo,'-i',voicePath,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',finalPath]);
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
const storagePath = `${userId}/${local}/${slot.replace(':','')}.mp4`;
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
  quality_check:{passed:true, duration_seconds:actualDuration, bytes:stat.size, has_audio:true, sources:script.sources.length, word_count:wordCount, voice:'es-ES-AlvaroNeural', rendered_by:'HyperFrames'},
}});
await supabase('social_posts', { method:'POST', body: ['youtube','tiktok'].map(platform => ({
  user_id:userId, video_id:video[0].id, platform, caption:script.caption || script.title,
  status:'draft',
}))});
await supabase('production_jobs', { method:'PATCH', query:`?id=eq.${jobId}`, body:{status:'ready',completed_at:new Date().toISOString()} });
console.log(`Vídeo listo: ${finalPath} (${stat.size} bytes). Guardado en Supabase; publicación en borrador por seguridad.`);
