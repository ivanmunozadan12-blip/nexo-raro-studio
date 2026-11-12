# Puesta en marcha de Nexo Raro

## Panel
Despliegue de Vercel: `https://nexo-raro-studio-git-main-ivanmunozadan12-8334.vercel.app`
Acceso al estudio: añade `/studio`.

1. Abre el estudio y crea una cuenta con correo y contraseña.
2. Confirma el correo si Supabase solicita verificación.
3. El primer acceso crea automáticamente la configuración del canal y sus tres series editoriales.
4. El panel consulta los trabajos, guiones y vídeos del usuario autenticado mediante RLS.

## Activar producción automática
En GitHub abre Settings → Secrets and variables → Actions y añade estos tres **Repository secrets**:

- `OPENAI_API_KEY`: clave de API de OpenAI Platform. No es la contraseña de ChatGPT.
- `SUPABASE_URL`: `https://fnivzsazuovldhbkxrqv.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: clave secreta de Supabase (nunca la clave publishable/anon).

La clave de OpenAI consume saldo de API independiente de ChatGPT. Configura un límite de gasto mensual antes de activar el workflow. El presupuesto de referencia del proyecto es 20 €/mes; el pipeline no debe usarse sin un límite de gasto en el proveedor.

Después entra en Actions → Nexo Raro · producción diaria y ejecuta Run workflow para probar un horario. Los tres horarios automáticos están en Europe/Madrid. Los MP4 se guardan en el bucket privado `nexo-videos` y también como artefactos de Actions durante 14 días.

## Publicación en redes
Los vídeos quedan inicialmente en borrador para revisión. La publicación automática requiere registrar aplicaciones oficiales y completar OAuth de YouTube y TikTok; no se simula ni se activa sin credenciales válidas y permisos de las plataformas.

## Notas técnicas
- Render: HyperFrames CLI 0.9.37 + FFmpeg.
- Voz: Edge TTS, voz es-ES-AlvaroNeural.
- Guiones: Responses API con búsqueda web.
- Datos: Supabase Auth, Postgres y Storage privado.
- Horarios: GitHub Actions schedule con zona horaria IANA.
- No guardar secretos en el repositorio ni en archivos públicos.
