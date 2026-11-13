# BEHIND DEL MUNDO — Prompt Video Studio

Private web studio for creating three short-form videos from three plain-language prompts.

## Daily workflow

1. Paste the three prompts prepared for the day into the web studio.
2. Press **Generar los 3 vídeos**.
3. GitHub Actions starts three independent renders.
4. Each prompt is expanded into an 8-scene narrated storyboard, rendered as original code-drawn animation, mixed with Spanish narration, music and scene-synchronized sound effects, and encoded as vertical MP4.
5. The finished MP4 is stored in the private Supabase bucket and automatically sent to YouTube/TikTok when the corresponding OAuth credentials are configured.

No daily topic scheduler or automatic prompt generation is used. The user supplies the prompts. No character/presenter is inserted.

## Video style and technical output

- Original Python animation engine based on the supplied Claude example: Pillow, NumPy and FFmpeg.
- 8 narrative scenes per video, with scene-specific visual primitives (shapes, gears, waves, arrows, labels, cutaways, animated motion), not a fixed slideshow.
- 60–72 seconds, vertical 1080×1920, H.264 MP4.
- Spanish (Spain) male narration using Edge TTS voice es-ES-AlvaroNeural.
- Timed captions, original generated ambient music and per-scene procedural sound accents.
- The LLM must follow the user's prompt as the main creative brief. The three text fields are editorial slots only, not topic selectors.

## Required GitHub Actions secrets

Generation:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- GROQ_API_KEY
- Optional GROQ_MODEL (default openai/gpt-oss-120b)

Web dispatch (Vercel):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- GITHUB_ACTIONS_TOKEN with permission to dispatch repository workflows

YouTube automatic publishing:
- YOUTUBE_CLIENT_ID
- YOUTUBE_CLIENT_SECRET
- YOUTUBE_REFRESH_TOKEN
- Optional YOUTUBE_PRIVACY (default public)

TikTok automatic publishing:
- TIKTOK_CLIENT_KEY
- TIKTOK_CLIENT_SECRET
- TIKTOK_ACCESS_TOKEN and/or TIKTOK_REFRESH_TOKEN
- Optional TIKTOK_PRIVACY (default PUBLIC_TO_EVERYONE)

TikTok tokens are refreshed and stored in the private social_connections table. Apply supabase/migrations/20261113180000_social_connections.sql before enabling token persistence. The TikTok app must have the Content Posting API and approved video.publish scope. TikTok restricts unaudited clients to private posts; public publishing requires TikTok's app audit. The account owner must complete the official OAuth authorization.

## Social publishing behaviour

- YouTube uses the official YouTube Data API resumable upload.
- TikTok uses the official Content Posting API Direct Post flow, including creator-info query, AI-generated-content disclosure and upload status.
- If credentials are missing, the MP4 is still saved privately and social rows remain drafts.
- Platform errors are reported separately and do not discard a successfully rendered MP4.

## Local checks

    python -m pip install -r engine/requirements.txt
    sudo apt-get install ffmpeg
    python -m py_compile engine/produce.py engine/render_video.py engine/audio_bed.py engine/publish.py
    python -m unittest discover -s engine -p 'test_*.py'
    npm install
    npm run typecheck
    npm run build

## Manual workflow

The web dashboard dispatches .github/workflows/daily-video.yml with one prompt per job. It intentionally has no cron schedule. For local production, set VIDEO_SLOT, USER_PROMPT, and the Supabase/Groq environment variables before running engine/produce.py.
