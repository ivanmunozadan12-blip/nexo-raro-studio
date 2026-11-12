# Producción automática

El workflow diario se ejecuta a las 07:30, 14:30 y 20:30 en Europe/Madrid. Genera un guion investigado mediante Responses API + web_search, crea voz española con Edge TTS, compone el diseño 9:16 con HyperFrames, mezcla audio con FFmpeg y guarda el MP4 en Supabase Storage. Los posts quedan en borrador: la publicación automática no se activa sin credenciales y permisos oficiales de las plataformas.

Variables necesarias en GitHub Actions → Settings → Secrets and variables → Actions:
- OPENAI_API_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Variable opcional:
- OPENAI_MODEL (default gpt-6-astra)

El workflow puede ejecutarse manualmente desde Actions → Nexo Raro · producción diaria → Run workflow. Requiere que el panel haya creado la fila de channel_settings para brand_slug nexo-raro.
