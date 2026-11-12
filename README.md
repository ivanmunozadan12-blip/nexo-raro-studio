# Nexo Raro Studio

Panel y pipeline de producción para el canal Nexo Raro.

## Objetivo
Tres vídeos verticales diarios a las 07:30, 14:30 y 20:30 (`Europe/Madrid`), con investigación web, guion, voz, composición HyperFrames, render MP4, almacenamiento privado y revisión antes de publicar.

## Arquitectura actual
- **Web/PWA:** Next.js desplegado en Vercel.
- **Datos y archivos:** Supabase (Postgres, Auth y bucket privado `nexo-videos`).
- **Producción:** GitHub Actions ejecuta `npm run produce` en los tres horarios.
- **IA:** Groq; el modelo se selecciona con `GROQ_MODEL` y por defecto es `openai/gpt-oss-120b`.
- **Voz:** `edge-tts` en español de España.
- **Vídeo:** HyperFrames + FFmpeg, formato vertical 1080×1920.
- **Publicación:** se crean borradores de YouTube y TikTok. La publicación automática permanece desactivada y requiere configurar OAuth y activar el flujo de aprobación correspondiente.

## Estado de verificación
El worker de producción está implementado, pero una ejecución completa todavía debe confirmarse con un MP4 real, su objeto en Supabase Storage, las filas correspondientes en la base de datos y los borradores visibles en el estudio. No se debe considerar la producción validada solo porque GitHub Actions termine correctamente.

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
