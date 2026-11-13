# BEHIND DEL MUNDO — 3D Studio v2

This is the new general-purpose Blender production backend. It is deliberately separate from the current Three.js renderer until it passes real visual and timing tests. The existing production path is not replaced by an unverified prototype.

## Architecture

1. Editorial input: a detailed JSON shot list (or a script converted into that JSON by an editorial planner).
2. Scene compiler: validates the shot specification and resolves reusable assets, procedural recipes, materials, rigs, camera plans and animation beats.
3. Blender renderer: builds actual Blender scenes through bpy in background mode, renders image sequences, and encodes a vertical MP4 with FFmpeg.
4. Quality gate: checks JSON/schema, missing assets, render output, frame dimensions, duration, black frames, frozen shots, and contact sheets. Human visual approval remains mandatory.

## General-purpose input

A project is not tied to a topic or a fixed list of scene types. Each shot contains:
- an explicit environment and world look;
- one or more subjects with either a licensed asset, a procedural recipe, or a Blender library asset;
- physical materials and surface maps;
- rig/animation instructions with timed actions;
- camera lens, framing, path, focus and movement;
- lighting and atmosphere;
- optional explanatory graphics;
- exact narration timing.

The preferred order for creating an asset is: (1) approved reusable library model, (2) generated/imported GLB with licence metadata, (3) a custom Blender procedural model/Geometry Nodes asset, (4) simple primitives only for intentional abstract elements or blocking. A name or prose description alone is never accepted as a finished model.

## Free asset sources

- Poly Haven: CC0 models, HDRIs and textures. The live API is free; identify Poly Haven when surfacing API-sourced assets in a product.
- ambientCG: CC0 PBR materials and HDRIs.
- Other sources may be added only with per-asset licence/attribution metadata.

Asset records must store source, original URL, licence, attribution requirement, local path, checksum, and intended use. Do not download or redistribute an asset if its licence is unclear.

## Rendering policy

- Render at 1080x1920 for final vertical delivery; use 540x960 or 720x1280 for previews.
- Prefer Eevee for affordable cloud previews and Cycles when render time and runner resources permit.
- Render frames first, encode with FFmpeg second; never depend on a browser screenshot as the final 3D render.
- Use deterministic seeds and pin Blender version in CI.
- Avoid downloading large assets on every shot; cache a versioned asset library between jobs where possible.
- Do not claim unlimited or guaranteed-realistic AI generation. AI mesh generation is an optional local/offline enhancement and requires suitable GPU hardware.

## Current status

The backend is a prototype foundation, not yet the default production renderer. It must pass a multi-subject demo render and visual inspection before integration with the existing publishing/storage workflow.
