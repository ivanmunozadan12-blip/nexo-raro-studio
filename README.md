# Behind del Mundo Studio

Panel y pipeline de producción para el canal Behind del Mundo.

## Objetivo
Tres vídeos verticales diarios a las 07:30, 14:30 y 20:30 (`Europe/Madrid`), con investigación web, guion, voz, composición HyperFrames, render MP4, almacenamiento privado y revisión antes de publicar.

## Arquitectura actual
- **Web/PWA:** Next.js desplegado en Vercel.
- **Datos y archivos:** Supabase (Postgres, Auth y bucket privado `nexo-videos`).
- **Producción:** GitHub Actions ejecuta `npm run produce` en los tres horarios.
- **Entrada editorial:** tres guiones JSON preparados en ChatGPT y pegados en el panel; la ruta de guiones importados no llama a Groq ni a otra API de redacción. La ruta antigua de generación automática con Groq se conserva solo para compatibilidad.
- **Memoria editorial:** Supabase conserva temas, enfoque, narración y fuentes de los vídeos terminados; el worker compara los nuevos guiones con todo el historial y bloquea coincidencias. El estudio permite añadir temas excluidos manualmente. Para ahorrar cuota, solo se envía a Groq un resumen compacto de los 40 temas más recientes.
- **Voz:** `edge-tts` en español de España.
- **Vídeo:** escenas procedurales 3D con Three.js, animación de cámara y objetos, HyperFrames + FFmpeg, formato vertical 1080×1920; voces Edge TTS (narrador `es-ES-AlvaroNeural` y reacciones de Enzo `es-ES-ArnauNeural`), subtítulos por fragmento y control con `ffprobe` (duración, resolución, audio).
- **Publicación:** se crean borradores para YouTube y TikTok, se descargan los MP4 y se abren los estudios oficiales. La publicación directa desde la web aún requiere credenciales OAuth/API de ambas plataformas; no se marca como publicada sin confirmación.

## Flujo de guiones externos
1. En el panel privado, abre **Importar guiones** y pega los tres JSON completos.
2. El panel valida 145–205 palabras, siete escenas completas, fragmentos literales, objetos, overlays y al menos tres fuentes HTTPS.
3. Se crean tres registros y se disparan tres ejecuciones `workflow_dispatch` independientes, sin `GROQ_API_KEY`.
4. GitHub Actions genera narración y reacciones de Enzo con Edge TTS, renderiza las escenas y sube los MP4 a Supabase Storage.
5. El panel consulta el estado mientras haya trabajos en curso y envía notificaciones del navegador cuando se completa o falla un vídeo (el usuario debe activar los avisos).
6. Los errores quedan guardados como trabajos fallidos y el guion vuelve a estado `approved` para permitir reintento.

**Configuración pendiente para activar el botón de generación:** añadir `GITHUB_ACTIONS_TOKEN` como variable cifrada en Vercel (token GitHub fine-grained con permiso Actions: Read and write sobre este repositorio). Sin ese secreto, el panel guarda los guiones pero GitHub no acepta el dispatch.

## Estado de verificación
El panel se compila y se despliega como preview. La validación automática comprueba sintaxis del worker y TypeScript. La generación completa de un lote real todavía debe probarse después de configurar `GITHUB_ACTIONS_TOKEN`; no se ha lanzado una producción normal ni se ha publicado contenido.

El endpoint `/api/health` informa del estado de la aplicación web. No puede comprobar los secretos privados del worker, que residen en GitHub Actions. El endpoint `/api/cron` no es el planificador activo: GitHub Actions es el reloj de producción.

## Desarrollo
- Node.js 22+
- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm run build`

## Variables
Configura las credenciales en el entorno correspondiente. Nunca publiques `.env.local`, `GROQ_API_KEY` ni `SUPABASE_SERVICE_ROLE_KEY`.

### GitHub Actions secrets
- `GROQ_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### GitHub Actions variable opcional
- `GROQ_MODEL` (por defecto `openai/gpt-oss-120b`)

### Vercel
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Costes y seguridad
Diseño compatible con planes gratuitos dentro de sus límites. No se activa ningún servicio de pago ni publicación automática sin autorización. Los MP4 se almacenan en un bucket privado y las publicaciones permanecen como borradores.
