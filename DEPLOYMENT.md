# Despliegue

## Web
- Framework: Next.js.
- Hosting: Vercel.
- Región: Frankfurt.
- Mantener las variables públicas de Supabase y añadir `GITHUB_ACTIONS_TOKEN` para que el panel pueda solicitar renders.

## Producción
GitHub Actions ejecuta `.github/workflows/daily-video.yml` en las tres franjas diarias. El worker instala Python, Pillow, NumPy, Edge TTS y FFmpeg. Groq genera el tema, el guion y el plan visual; el motor Python dibuja los fotogramas y el montaje final.

## Supabase
Se conserva el proyecto y la autenticación existentes, junto al bucket privado `nexo-videos`, tablas de guiones, trabajos, vídeos, publicaciones y memoria editorial. No se eliminan datos históricos.

## Seguridad editorial
Los vídeos se guardan como privados y los borradores sociales no se publican. La publicación automática permanece desactivada.
