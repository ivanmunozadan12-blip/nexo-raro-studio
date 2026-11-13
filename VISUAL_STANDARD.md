# BEHIND DEL MUNDO — Visual Production Standard v1

This is the production contract for every manually authored 3D video. The attached reference video defines the minimum visual target: clean stylized 3D, large readable subjects, coherent environments, varied compositions, smooth motion, and concise infographic callouts. It is a visual reference only; the channel's topics, narration, identity, and editorial choices remain original.

## 1. Delivery target

- Vertical 9:16, 1080×1920.
- 60–72 seconds, normally 14 distinct shots.
- Spanish (Spain) male narration; narration is the story, visuals must illustrate the exact spoken passage.
- Procedural Three.js scenes, not static images or a slideshow.
- A finished render is not automatically approved. The MP4 must be inspected.

## 2. Root JSON contract

Required root fields:
- `title`, `hook`, `category`, `story_id`, `target_seconds`
- `narration`: final approved narration, 145–205 words.
- `sources`: at least three independent HTTPS domains.
- `scenes`: exactly 14 scenes.
- `models`: dictionary of reusable version-1 blueprints.

## 3. Scene contract

Every scene must define:
- `scene_type`: one of `landscape`, `architecture`, `science`, `ocean`, `space`, `history`, `object`, `abstract`.
- `visual`: at least 550 characters. Describe the actual composition, subject placement, foreground/midground/background, lighting, depth, and what changes during the shot.
- `setting`: concrete location and physical conditions, at least 40 characters.
- `action`: observable action with a beginning, development, and end, at least 130 characters.
- `camera`: intentional framing and camera path, at least 80 characters.
- `camera_target`: exact `id` of a real entity in that scene.
- `continuity`: identity, scale, palette, light direction, and transition logic, at least 70 characters.
- `characters`, `props`, `objects`: explicit arrays; props and objects each contain 4–8 concrete elements.
- `overlay`: concise on-screen heading, maximum four words.
- `narration_excerpt`: at least eight words, copied verbatim from the narration. The producer re-synchronizes the 14 excerpts to the final narration before rendering.
- `entities`: 2–12 actual 3D entities.
- `beats`: 2–12 timed actions, each tied to an entity that exists in the scene.
- `graphics` (optional): maximum two factual callout cards. Each has `label`, `value`, and `detail`; keep each short. Never invent measurements or scientific claims.

A scene must have a distinct narrative purpose. Do not reuse the same composition or camera movement for every shot. Macro, comparison, overview, overhead, tracking, orbit, and reveal shots should be chosen because they explain the narration.

## 4. Entity contract

Each entity must contain:
- `id`: unique within the scene and stable when continuity across scenes is required.
- `name`, `type`: type must be one of `human`, `animal`, `ship`, `tree`, `building`, `vehicle`, `machine`, `lab`, `celestial`, `furniture`, `prop`, `artifact`.
- `appearance`: at least 100 characters describing visible identity and distinguishing features.
- `position`: [x, y, z].
- `dimensions`: [width, height, depth], positive values in the scene's world units.
- `scale`: positive scalar or [x, y, z].
- `shape`: readable description of the intended silhouette and form.
- `material`: readable physical surface description; the procedural engine maps material keywords to roughness, metalness, and transparency defaults. Per-part blueprint values override defaults.
- `color`: explicit hex color.
- `support`: physical support or attachment; use another entity's id for a real attachment.
- `action` and `motion`: at least three words each, describing what the object does.
- `model_id` or inline `blueprint`: required. There are no placeholder or name-only models.
- Optional `palette`, `colorOverrides`, and supported `colorAnimation` may control a model's palette where implemented.

The engine uses `dimensions` for camera framing and spatial checks; `position` and `scale` place the model; `model_id` resolves the actual geometry; `color` is a fallback; `material` sets surface defaults; `support` describes physical relationships; and `action`/`motion` plus `beats` drive supported movement. `appearance` and `shape` are descriptive production metadata; the blueprint is the authoritative geometry.

## 5. Blueprint contract

Every reusable blueprint must have:
- `version: 1`
- `parts`: one or more ordered parts.
- `animations`: an array, including an empty array if static.

Allowed primitives: `box`, `sphere`, `cylinder`, `cone`, `torus`.
Each non-group part requires a unique `id`, `primitive`, positive `size: [x,y,z]`, and `color`. Optional fields include `parent`, `position`, `rotation`, `roughness`, `metalness`, `transparent`, and `opacity`. A parent must be declared before its children. Group parts create transform nodes.

Animation tracks must target an existing part and define:
- `property`: `position`, `rotation`, or `scale`.
- `axis`: `x`, `y`, or `z`.
- `amplitude` and `frequency`; optional `phase`, `base`, and `mode`.
- Scale animation is clamped above zero. Animation bases are captured once so frames do not accumulate drift.

## 6. Camera and action interpretation

Camera descriptions are not decorative prose. The engine recognizes:
- `macro`, `microscópico`, `detalle extremo`: close macro framing.
- `primer plano`, `detalle`, `acercamiento`, `zoom`: close framing.
- `cenital`, `aéreo`, `vista superior`: overhead framing.
- `órbita`, `rode`, `circular`: continuous orbit.
- `lateral`, `travelling`, `seguimiento`, `recorre`: lateral tracking.
- Other descriptions use a continuous controlled camera move around the target.

Beats must reference valid entity IDs and use positive `at` and `duration` values. Supported action wording can drive opening, expanding, retracting, crossing, approaching, escaping, swimming, flying, and other implemented movement patterns. If a required action is not supported by the engine, implement it explicitly before relying on it in a script.

## 7. Visual minimum

Every shot must meet the following:
1. Main subject is large, recognizable, correctly proportioned, and not hidden by overlays.
2. Background has depth and belongs to the subject's environment; foreground, subject, and background are visually separated.
3. Lighting, shadows, material response, and color contrast make the model readable.
4. At least one meaningful subject or environmental motion is visible; static explanatory diagrams are allowed only when the narration calls for comparison or microscopic explanation.
5. Camera framing and movement serve the explanation; no arbitrary repeated micro-cuts.
6. Graphics are concise, factual, legible, and placed clear of the subject and subtitles.
7. Adjacent shots change scale, angle, subject action, or information—not just the camera position.
8. No accidental overlaps, floating ground objects, clipping, broken geometry, flicker, or unexplained teleporting.
9. Captions and narration remain synchronized and readable.
10. The 14 shots collectively tell the story visually, not merely decorate the narration.

## 8. Approval gates

A video is approved only after all gates pass:
- **JSON gate:** all fields, IDs, references, blueprints, animations, beats, sources, and spatial relationships validate.
- **Engine gate:** syntax tests and procedural 3D smoke render pass.
- **Render gate:** actual MP4 is 1080×1920, 60–72 seconds, has audio, and contains all 14 shots.
- **Visual gate:** inspect representative frames from every shot and watch the full MP4. Reject if the models are generic, scenes repeat, actions are not visible, graphics obscure the subject, or the visuals do not match narration.

A green GitHub workflow only proves the automated steps passed. It does not replace visual approval. Never mark a video ready or publish it solely because rendering completed.
