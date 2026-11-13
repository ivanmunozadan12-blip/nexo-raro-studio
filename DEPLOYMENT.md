# Despliegue de BEHIND DEL MUNDO

## Web
- Next.js en Vercel.
- La ruta /studio conserva el acceso privado con Supabase Auth.
- El panel recibe tres prompts de texto y envía tres trabajos a GitHub Actions.
- La ruta /api/production/dispatch requiere sesión Supabase y GITHUB_ACTIONS_TOKEN.

## Motor de vídeo
- GitHub Actions ejecuta un trabajo independiente por prompt.
- Python + Pillow + NumPy dibujan las escenas y sus elementos animados.
- FFmpeg codifica MP4 vertical H.264 1080×1920.
- Edge TTS genera narración masculina es-ES.
- La cama musical y los efectos de cada escena se sintetizan localmente.
- No hay cron ni selección automática de temas: los prompts los introduce el usuario.

## Variables de Vercel
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- GITHUB_ACTIONS_TOKEN (permiso Actions: write en el repositorio)\n- NEXT_PUBLIC_SITE_URL (URL HTTPS de la web desplegada)\n- SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (solo servidor; nunca prefijo NEXT_PUBLIC)\n- YOUTUBE_CLIENT_ID y YOUTUBE_CLIENT_SECRET (cliente OAuth de Google)\n- TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET (app de TikTok con Content Posting API)

## Secrets de GitHub Actions
Generación:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- GROQ_API_KEY
- GROQ_MODEL (opcional)

YouTube:
- YOUTUBE_CLIENT_ID
- YOUTUBE_CLIENT_SECRET
- YOUTUBE_REFRESH_TOKEN
- YOUTUBE_PRIVACY (opcional, public por defecto)

TikTok:
- TIKTOK_CLIENT_KEY
- TIKTOK_CLIENT_SECRET
- TIKTOK_REFRESH_TOKEN (preferido para rotación segura)
- TIKTOK_ACCESS_TOKEN (opcional)
- TIKTOK_PRIVACY (opcional)

## Supabase
- Se mantiene el proyecto actual, autenticación, bucket privado nexo-videos y tablas de producción.
- La tabla social_connections almacena tokens de TikTok solo en servidor; RLS está activado y no hay políticas para usuarios finales.
- Migración aplicada: social_connections.
- No se borran vídeos, guiones ni registros históricos.

## Publicación
- La web solicita publicación automática al enviar los tres prompts.
- Los MP4 siguen guardándose aunque una red no esté conectada o rechace la publicación.
- YouTube usa OAuth y la API oficial de subida reanudable.
- TikTok requiere una app registrada, Content Posting API, scope video.publish y autorización OAuth del propietario.
- TikTok limita a privado las apps sin auditoría; para publicar al público la app debe superar la auditoría oficial.
