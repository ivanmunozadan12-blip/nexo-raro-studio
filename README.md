# BEHIND DEL MUNDO — Studio

Centro de control del canal BEHIND DEL MUNDO. La web Next.js conserva autenticación, biblioteca privada y memoria editorial; la producción se ejecuta en GitHub Actions.

## Nueva línea editorial
1. **Cómo funciona** — objetos, mecanismos, tecnología y fenómenos cotidianos.
2. **Por dentro** — edificios, transportes, instalaciones e infraestructuras.
3. **Curiosidades** — preguntas sorprendentes, porqués y hechos poco conocidos.

## Producción diaria
Tres espacios editoriales: 07:30, 14:30 y 20:30 (Europe/Madrid). Cada ejecución genera un tema distinto, redacta una narración, prepara ocho escenas visuales, crea voz masculina es-ES, dibuja animación mediante Python/Pillow/NumPy y monta música/efectos con FFmpeg.

La salida es vertical 1080×1920, 60–72 segundos, con subtítulos temporizados, voz y música ambiental original. Los MP4 se guardan en el bucket privado `nexo-videos` de Supabase y quedan como borradores. **No se publica automáticamente.**

## Variables de GitHub Actions
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- Opcional: `GROQ_MODEL` (por defecto `openai/gpt-oss-120b`)

## Variables de Vercel
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GITHUB_ACTIONS_TOKEN` (permiso para ejecutar workflows)

## Ejecutar localmente
```bash
python -m pip install -r engine/requirements.txt
sudo apt-get install ffmpeg
VIDEO_SLOT=how-it-works python engine/produce.py
```

Slots válidos: `how-it-works`, `inside`, `curiosities`.

## Pruebas
```bash
python -m py_compile engine/produce.py engine/render_video.py engine/audio_bed.py
python -m unittest discover -s engine -p 'test_*.py'
npm install
npm run typecheck
npm run build
```

La generación programada está configurada en `.github/workflows/daily-video.yml`. Antes de activar el flujo en producción, revisar un MP4 completo de cada familia visual. Los vídeos nunca se publican automáticamente.
