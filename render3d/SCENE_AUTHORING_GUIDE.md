# Scene authoring contract — universal content

The 3D backend is topic-agnostic. Do not choose a fixed subject taxonomy. Every project is a sequence of shots, and every shot is a self-contained physical or stylized world with continuity references to earlier shots.

## Input modes

1. **Structured project JSON (production mode):** the authoritative source. It defines exact objects, models, materials, animation, camera, lighting, environment, timing and narration.
2. **Detailed creative brief (planning mode):** a natural-language prompt can be converted into the project JSON by an editorial planner. The planner must resolve vague language into explicit objects and observable actions; it must not pass a prompt directly to the renderer.
3. **Narration-first mode:** narration is split into meaningful visual beats, then each beat is assigned a unique shot purpose and duration. The sum of shot durations must match the video duration.

No mode is allowed to invent scientific facts, historical specifics, statistics, or citations. Each factual graphic must map to a source and a narration passage.

## Required planning pass

Before rendering, the planner creates:
- a visual treatment: realistic, cinematic stylized, miniature, macro science, historical reconstruction, space documentary, architectural visualization, product showcase, abstract motion design, or a deliberate combination;
- a subject inventory with stable IDs, scale, silhouette, anatomy/structure, materials, rig needs and continuity rules;
- an asset plan: approved local asset, CC0 library asset, procedural Blender model, or explicitly marked blockout;
- a shot list with distinct composition and editorial purpose;
- a camera plan (lens, height, distance, angle, target, movement, focus and transition);
- lighting plan (key/fill/rim, source size, color temperature, atmosphere, shadow intent);
- animation plan with start/end poses and timed beats;
- sound/narration timing and explanatory graphics.

## Entity/model requirements

Every hero subject must use one of:
- `kind: "asset"`: an imported GLB/glTF, FBX or OBJ model with a local asset path and licence record;
- `kind: "primitive"`: only for simple props, abstract forms, blockout or intentional design;
- `kind: "mesh"`: a custom mesh with vertices/faces for geometry that can be built procedurally;
- `kind: "curve"`: cables, tentacles, branches, paths, tubes and other spline-driven forms;
- `kind: "text"`: 3D typography or labels.

A hero character cannot be a single sphere/cube with a descriptive paragraph. Complex characters need a dedicated model, multiple meaningful parts, a rig or explicit deformable animation, and continuity across shots.

## Visual quality rules

- Compose for 9:16 safe area. Hero subject is large enough to read on a phone.
- Every shot must have foreground, subject plane and background depth unless a deliberate graphic/macro shot requires otherwise.
- Use at least a motivated key light and fill/rim where appropriate. Avoid default flat lighting.
- Vary shot scale and angle to serve the narration: establishing, wide, medium, close-up, macro, tracking, orbit, top-down, reveal, comparison, cutaway.
- The camera must move or the subject/environment must visibly animate in every shot. Static holds require editorial justification.
- Show physical cause and effect. A subject must not teleport, morph impossibly or change identity between shots.
- Materials must be chosen by physical surface, not just color: roughness, metalness, transmission/alpha, bump/normal and displacement where appropriate.
- Environmental motion should be subtle and layered: dust, water particles, foliage, smoke, cloth, mechanical vibration or other context-specific motion.
- Infographics are 3D/2D editorial overlays with legible type and factual provenance, never decorative clutter.

## Asset and model strategy

Use CC0 asset libraries first for high-quality environments, props, PBR materials and HDRIs. For hero subjects, choose animation-ready models whenever possible. Store asset metadata and licences. A static scanned model may be used for a close-up or background, but it must not be falsely presented as a rigged/animated character.

Text-to-3D models can be experimental inputs. They must pass mesh cleanup, normals, scale, texture and animation checks before production. Free local AI models require local GPU capacity and are not assumed to run in GitHub-hosted CPU runners.

## Final gates

1. JSON and asset validation.
2. Scene build validation (missing IDs, broken asset paths, empty meshes, invalid animation targets).
3. Low-resolution storyboard render for every shot.
4. Full-resolution render and FFmpeg encode.
5. Technical checks: duration, 1080x1920, audio, frame rate, no missing frames, black/frozen frame detection.
6. Visual inspection of contact sheet and actual MP4. Green CI alone never approves a video.
