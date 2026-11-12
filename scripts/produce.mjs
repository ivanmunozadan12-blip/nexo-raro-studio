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
for (const key of ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) throw new Error(`Falta la variable ${key}`);
}
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
const [settings] = await supabase('channel_settings', { query: '?brand_slug=eq.nexo-raro&select=id,user_id,channel_name,timezone,require_approval,auto_publish_enabled&limit=1' });
if (!settings) throw new Error('No hay una cuenta configurada en el panel. Inicia sesión y termina el asistente inicial.');
const userId = settings.user_id;
const scheduledAt = new Date(new Date(`${local}T${slot}:00`).toLocaleString('en-US', { timeZone: tz })).toISOString();
const existing = await supabase('production_jobs', { query: `?user_id=eq.${userId}&scheduled_for=eq.${encodeURIComponent(scheduledAt)}&select=id,status&limit=1` });
if (existing.length) {
  console.log(`El horario ${local} ${slot} ya tiene un trabajo (${existing[0].status}); se evita duplicar.`);
  process.exit(0);
}
const seriesRows = await supabase('series', { query: `?user_id=eq.${userId}&is_active=eq.true&select=id,slug,title,description&order=slug.asc` });
const series = seriesRows.length ? seriesRows[(slots.indexOf(slot) + Number(local.replaceAll('-', ''))) % seriesRows.length] : null;
const prompt = `Investiga y escribe un vídeo vertical en español de España para el canal documental Nexo Raro. Hoy es ${local}; horario ${slot}. Serie: ${series?.title || 'curiosidades reales y ciencia sorprendente'}. Tema: elige un hecho real, poco conocido y con gancho, evita temas virales quemados y no repitas el tópico de los últimos días si lo conoces. Usa búsqueda web para contrastar los datos. Duración hablada objetivo 60-68 segundos (125-145 palabras). No inventes cifras ni citas. Si la evidencia es incierta, dilo con claridad. Devuelve SOLO JSON con: title (máx 70 caracteres), hook (máx 12 palabras), narration (125-145 palabras, locutable y natural), scenes (exactamente 7 objetos con visual, overlay y narration_excerpt), sources (mínimo 3 fuentes independientes con title y url), caption (descripción para redes con 3-5 hashtags), category (una de las tres series editoriales). Evita Wikipedia como fuente principal. No incluyas datos sin respaldo en las fuentes.`;
const aiResponse = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || 'gpt-6-astra',
    instructions: 'Eres el editor jefe de un canal documental riguroso. Investiga con web search, contrasta fuentes primarias o instituciones fiables y separa hechos de hipótesis. Responde únicamente con JSON válido.',
    input: prompt,
    tools: [{ type: 'web_search' }],
    max_output_tokens: 2600,
  }),
});
if (!aiResponse.ok) throw new Error(`OpenAI ${aiResponse.status}: ${(await aiResponse.text()).slice(0, 1000)}`);
const ai = await aiResponse.json();
const outputText = ai.output_text || ai.output?.flatMap(x => x.content || []).find(x => x.type === 'output_text')?.text;
if (!outputText) throw new Error('La API no devolvió texto de guion.');
// Web Search is incompatible with Responses API JSON mode. Keep web research enabled
// and parse the model's JSON-only response defensively instead.
const cleanedOutput = outputText.trim()
  .replace(/^```(?:json)?\\s*/i, '')
  .replace(/\\s*```$/, '');
let script;
try {
  script = JSON.parse(cleanedOutput);
} catch {
  const first = cleanedOutput.indexOf('{');
  const last = cleanedOutput.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('OpenAI no devolvió un objeto JSON válido para el guion.');
  try { script = JSON.parse(cleanedOutput.slice(first, last + 1)); }
  catch { throw new Error('El JSON del guion está mal formado; se detiene antes de guardar datos incompletos.'); }
}
if (!script.title || !script.narration || !Array.isArray(script.scenes) || script.scenes.length !== 7 || !Array.isArray(script.sources) || script.sources.length < 3) throw new Error('El guion no cumple el formato editorial requerido.');
const wordCount = script.narration.trim().split(/\s+/).length;
if (wordCount < 105 || wordCount > 165) throw new Error(`Narración fuera de duración: ${wordCount} palabras.`);
for (const source of script.sources) {
  if (!/^https:\/\//.test(source.url || '')) throw new Error('Fuente sin URL HTTPS válida.');
}
const [seriesMatch] = seriesRows.filter(x => x.slug === script.category);
const scriptRow = await supabase('scripts', { method: 'POST', body: {
  user_id: userId, series_id: seriesMatch?.id || series?.id || null,
  title: script.title, hook: script.hook || '', narration: script.narration,
  visual_plan: script.scenes, source_notes: script.sources,
  target_seconds: 64, status: 'in_production',
}});
const scriptId = scriptRow[0].id;
const jobRow = await supabase('production_jobs', { method: 'POST', body: {
  user_id: userId, script_id: scriptId, scheduled_for: scheduledAt, status: 'voicing', attempt_count: 0,
}});
const jobId = jobRow[0].id;
const work = path.join(root, 'renders', `${local}-${slot.replace(':', '')}`);
await mkdir(work, { recursive: true });
await writeFile(path.join(work, 'script.json'), JSON.stringify(script, null, 2));
const voicePath = path.join(work, 'voice.mp3');
await command('python', ['-m', 'edge_tts', '--voice', 'es-ES-AlvaroNeural', '--rate', '-4%', '--text', script.narration, '--write-media', voicePath]);
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
  duration_seconds:64, width:1080, height:1920, mime_type:'video/mp4',
  quality_check:{passed:true, bytes:stat.size, sources:script.sources.length, word_count:wordCount, voice:'es-ES-AlvaroNeural', rendered_by:'HyperFrames'},
}});
await supabase('social_posts', { method:'POST', body: ['youtube','tiktok'].map(platform => ({
  user_id:userId, video_id:video[0].id, platform, caption:script.caption || script.title,
  status:'draft',
}))});
await supabase('production_jobs', { method:'PATCH', query:`?id=eq.${jobId}`, body:{status:'ready',completed_at:new Date().toISOString()} });
console.log(`Vídeo listo: ${finalPath} (${stat.size} bytes). Guardado en Supabase; publicación en borrador por seguridad.`);
