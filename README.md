# Nexo Raro Studio

Panel y pipeline de producción para el canal Nexo Raro.

## Objetivo
Tres vídeos verticales diarios a las 07:30, 14:30 y 20:30 (`Europe/Madrid`), con investigación verificable, guion, voz, composición HyperFrames, render MP4, revisión y publicación en YouTube Shorts y TikTok.

## Estado real
Esta primera base incluye la interfaz PWA, endpoint de salud y endpoint de scheduler protegido. **Todavía no genera ni publica vídeos**: faltan implementar y verificar el worker HyperFrames y configurar proveedores y credenciales oficiales de publicación. El endpoint de cron no crea archivos de prueba ni simula trabajos completados.

## Desarrollo
- Node.js 22+
- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm run build`

## Variables
Copia `.env.example` a `.env.local` y configura únicamente credenciales propias. Nunca publiques `.env.local` ni `SUPABASE_SERVICE_ROLE_KEY`.

## Planificador
GitHub Actions será el reloj externo para los tres horarios locales. Se programarán las dos variantes UTC de verano/invierno y el proceso validará `Europe/Madrid` para evitar duplicados. Los trabajos se activarán solo después de completar el worker.

## Costes
Diseño inicial compatible con planes gratuitos. No se activa ningún servicio de pago ni publicación hasta comprobar límites, credenciales y autorizaciones.
