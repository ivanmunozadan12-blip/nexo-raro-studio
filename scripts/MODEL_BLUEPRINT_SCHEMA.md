# JSON 3D model blueprints

Every production JSON is self-contained: it carries a `models` catalogue and each scene entity references one entry through `model_id`.

## Model entry

```json
{
  "version": 1,
  "coordinate_system": "Y-up; dimensions in metres; local origin at ground contact",
  "parts": [
    {
      "id": "body",
      "primitive": "sphere",
      "position": [0, 1, 0],
      "size": [0.5, 0.4, 0.3],
      "color": "#a65e4b",
      "roughness": 0.45,
      "metalness": 0
    },
    {
      "id": "left-arm",
      "group": true,
      "position": [-0.4, 1, 0]
    },
    {
      "id": "arm-segment",
      "parent": "left-arm",
      "primitive": "cylinder",
      "position": [0, -0.2, 0],
      "size": [0.1, 0.4, 0.1],
      "color": "#a65e4b"
    }
  ],
  "animations": [
    {
      "target": "left-arm",
      "property": "rotation",
      "axis": "z",
      "mode": "wave",
      "amplitude": 0.3,
      "frequency": 2,
      "phase": 0
    }
  ]
}
```

Supported primitives: `box`, `sphere`, `cylinder`, `cone`, `torus`. A group is a transform node with `group: true`. Parts are declared parent-first; children use `parent` to attach to a group or part. All dimensions, materials, colors, local positions and moving parts belong in the JSON.

Animation tracks target a part ID and define a transform channel. The engine evaluates the track at render time; no external model, image, asset download or model-generation service is needed.

## Scene usage

Each script has a root-level `models` object. Each entity includes a stable `model_id`, position, scale, dimensions, appearance and action. Every distinct visible object must be a model in this catalogue or be assembled from declared parts. Reuse the same `model_id` across scenes when the object is the same; create a distinct model entry when its shape or construction changes.

Do not leave important visible props, machinery, buildings, animals, vehicles, people or other objects only in descriptive prose. Give them a blueprint and add an entity reference in the scene. Static objects still need geometry and materials; they simply have no animation tracks. Moving objects need explicit animation tracks for the parts that move.

The producer validates model references, primitive types, parent order, part dimensions, colors and animation targets before rendering.
