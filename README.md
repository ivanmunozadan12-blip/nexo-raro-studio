# Nexo Raro Studio

Panel y pipeline de producción para el canal Nexo Raro.

## Objetivo
Tres vídeos verticales diarios a las 07:30, 14:30 y 20:30 (`Europe/Madrid`), con investigación web, guion, voz, composición HyperFrames, render MP4, almacenamiento privado y revisión antes de publicar.

## Arquitectura actual
- **Web/PWA:** Next.js desplegado en Vercel.
- **Datos y archivos:** Supabase (Postgres, Auth y bucket privado `nexo-videos`).
- **Producción:** GitHub Actions ejecuta `npm run produce` en los tres horarios.
- **IA:** Groq; el mismo modelo investiga y redacta (`GROQ_MODEL`, por defecto `openai/gpt-oss-120b`).
- **Memoria editorial:** Supabase conserva temas, enfoque, narración y fuentes de los vídeos terminados; el worker compara los nuevos guiones con todo el historial y bloquea coincidencias. El estudio permite añadir temas excluidos manualmente. Para ahorrar cuota, solo se envía a Groq un resumen compacto de los 40 temas más recientes.
- **Voz:** `edge-tts` en español de España.
- **Vídeo:** HyperFrames + FFmpeg, formato vertical 1080×1920, imágenes de Wikimedia Commons con atribución de autor/licencia cuando hay resultados disponibles y control técnico con `ffprobe` (duración, resolución y pista de audio).
- **Publicación:** se crean borradores de YouTube y TikTok. La publicación automática permanece desactivada y requiere configurar OAuth y activar el flujo de aprobación correspondiente.

## Estado de verificación
El panel y la memoria editorial están desplegados. El worker de producción está implementado, pero una ejecución completa todavía debe confirmarse con un MP4 real, su objeto en Supabase Storage, las filas correspondientes en la base de datos y los borradores visibles en el estudio. No se debe considerar la producción validada solo porque GitHub Actions termine correctamente.

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
