#!/usr/bin/env python3
"""General-purpose Blender JSON scene renderer for BEHIND DEL MUNDO.

Run:
  blender --background --python render3d/blender_renderer.py -- project.json output.mp4
"""
import bpy
import json
import math
import os
import random
import sys
import subprocess
from mathutils import Vector

def args_after_double_dash():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(args) != 2:
        raise SystemExit("Usage: blender --background --python blender_renderer.py -- project.json output.mp4")
    return args

def vec(value, default=(0, 0, 0)):
    return Vector(value if value is not None else default)

def hex_color(value, default=(0.5, 0.5, 0.5, 1.0)):
    if not value:
        return default
    value = value.lstrip("#")
    if len(value) != 6:
        return default
    rgb = [int(value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    # Convert sRGB to linear for Blender's shader inputs.
    return tuple(((c / 12.92) if c <= .04045 else ((c + .055) / 1.055) ** 2.4) for c in rgb) + (1.0,)

def aim(obj, target):
    direction = vec(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)

def make_material(spec):
    spec = spec or {}
    mat = bpy.data.materials.new(spec.get("name", "BDM_PBR_Material"))
    mat.diffuse_color = hex_color(spec.get("base_color", "#808080"))
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = hex_color(spec.get("base_color", "#808080"))
        bsdf.inputs["Roughness"].default_value = float(spec.get("roughness", .55))
        bsdf.inputs["Metallic"].default_value = float(spec.get("metallic", 0))
        if "alpha" in spec:
            alpha = float(spec["alpha"])
            bsdf.inputs["Alpha"].default_value = alpha
            if alpha < 1 and hasattr(mat, "surface_render_method"):
                mat.surface_render_method = "DITHERED"
    return mat

def create_primitive(entity):
    primitive = entity.get("primitive", "UV_SPHERE")
    if primitive == "UV_SPHERE":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32)
    elif primitive == "ICO_SPHERE":
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4)
    elif primitive == "CUBE":
        bpy.ops.mesh.primitive_cube_add()
    elif primitive == "CYLINDER":
        bpy.ops.mesh.primitive_cylinder_add(vertices=48)
    elif primitive == "CONE":
        bpy.ops.mesh.primitive_cone_add(vertices=48)
    elif primitive == "TORUS":
        bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=16)
    elif primitive == "PLANE":
        bpy.ops.mesh.primitive_plane_add()
    else:
        raise ValueError("Unsupported primitive: " + str(primitive))
    obj = bpy.context.object
    obj.name = entity.get("name", entity["id"])
    if primitive in ("UV_SPHERE", "ICO_SPHERE", "CYLINDER", "CONE", "TORUS"):
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def create_custom_mesh(entity):
    details = entity.get("details", {})
    vertices = details.get("vertices", [])
    faces = details.get("faces", [])
    if len(vertices) < 3 or not faces:
        raise ValueError("Custom mesh requires at least 3 vertices and one face: " + entity["id"])
    mesh = bpy.data.meshes.new(entity.get("name", entity["id"]) + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=True)
    mesh.update()
    obj = bpy.data.objects.new(entity.get("name", entity["id"]), mesh)
    bpy.context.scene.collection.objects.link(obj)
    for poly in mesh.polygons:
        poly.use_smooth = bool(details.get("smooth", True))
    return obj

def create_curve(entity):
    details = entity.get("details", {})
    points = details.get("points", [])
    if len(points) < 2:
        raise ValueError("Curve requires at least two points: " + entity["id"])
    curve = bpy.data.curves.new(entity.get("name", entity["id"]) + "_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = int(details.get("resolution", 16))
    curve.bevel_depth = float(details.get("bevel_depth", .05))
    curve.bevel_resolution = int(details.get("bevel_resolution", 4))
    spline = curve.splines.new("BEZIER" if details.get("bezier", True) else "POLY")
    if spline.type == "BEZIER":
        spline.bezier_points.add(len(points) - 1)
        for point, co in zip(spline.bezier_points, points):
            point.co = co
            point.handle_left_type = "AUTO"
            point.handle_right_type = "AUTO"
    else:
        spline.points.add(len(points) - 1)
        for point, co in zip(spline.points, points):
            point.co = (*co, 1)
    spline.use_cyclic_u = bool(details.get("cyclic", False))
    obj = bpy.data.objects.new(entity.get("name", entity["id"]), curve)
    bpy.context.scene.collection.objects.link(obj)
    return obj

def import_asset(entity, project_dir):
    rel = entity.get("asset")
    if not rel:
        raise ValueError("Asset entity requires asset path: " + entity["id"])
    path = os.path.abspath(os.path.join(project_dir, rel))
    if not path.startswith(os.path.abspath(project_dir) + os.sep) or not os.path.isfile(path):
        raise FileNotFoundError("Asset path missing or outside project directory: " + path)
    ext = os.path.splitext(path)[1].lower()
    before = set(bpy.data.objects)
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise ValueError("Unsupported asset format: " + ext)
    imported = [o for o in bpy.data.objects if o not in before]
    if not imported:
        raise RuntimeError("Asset importer returned no objects: " + path)
    root = bpy.data.objects.new(entity.get("name", entity["id"]), None)
    bpy.context.scene.collection.objects.link(root)
    for obj in imported:
        obj.parent = root
    return root

def create_entity(entity, project_dir):
    kind = entity.get("kind", "primitive")
    if kind == "asset":
        obj = import_asset(entity, project_dir)
    elif kind == "primitive":
        obj = create_primitive(entity)
    elif kind == "mesh":
        obj = create_custom_mesh(entity)
    elif kind == "curve":
        obj = create_curve(entity)
    elif kind == "text":
        bpy.ops.object.text_add()
        obj = bpy.context.object
        obj.name = entity.get("name", entity["id"])
        obj.data.body = entity.get("text", entity.get("name", ""))
        obj.data.extrude = float(entity.get("details", {}).get("extrude", .005))
    else:
        raise ValueError("Unsupported entity kind: " + str(kind))
    tr = entity.get("transform", {})
    obj.location = vec(tr.get("location"))
    obj.rotation_euler = vec(tr.get("rotation"))
    obj.scale = vec(tr.get("scale"), (1, 1, 1))
    material_spec = entity.get("material")
    if material_spec and kind in ("primitive", "mesh", "curve", "asset", "text"):
        mat = make_material(material_spec)
        for child in [obj] + list(obj.children):
            if hasattr(child.data, "materials"):
                child.data.materials.clear()
                child.data.materials.append(mat)
    for track in entity.get("animation", []):
        prop = track.get("property", "location")
        axis = int(track.get("axis", 2))
        start = int(track.get("start_frame", 1))
        end = int(track.get("end_frame", bpy.context.scene.frame_end))
        values = track.get("values", [])
        if prop not in ("location", "rotation_euler", "scale"):
            raise ValueError("Invalid animation property: " + prop)
        for item in values:
            frame = int(item["frame"])
            current = getattr(obj, prop).copy()
            current[axis] = float(item["value"])
            setattr(obj, prop, current)
            obj.keyframe_insert(data_path=prop, frame=frame)
        if not values and track.get("amplitude") is not None:
            base = float(getattr(obj, prop)[axis])
            amplitude = float(track["amplitude"])
            frequency = float(track.get("cycles", 1))
            for frame in range(start, end + 1, max(1, int(track.get("step", 2)))):
                phase = (frame - start) / max(1, end - start)
                current = getattr(obj, prop).copy()
                current[axis] = base + amplitude * math.sin(phase * math.tau * frequency)
                setattr(obj, prop, current)
                obj.keyframe_insert(data_path=prop, frame=frame)
    return obj

def setup_camera(spec, frame_end):
    data = bpy.data.cameras.new("BDM_Camera")
    camera = bpy.data.objects.new("BDM_Camera", data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = vec(spec.get("position"), (7, -10, 7))
    aim(camera, spec.get("target", (0, 0, 0)))
    data.lens = float(spec.get("lens_mm", 50))
    data.dof.use_dof = bool(spec.get("dof", False))
    bpy.context.scene.camera = camera
    for move in spec.get("movement", []):
        frame = int(move["frame"])
        camera.location = vec(move.get("position"), camera.location)
        if "target" in move:
            aim(camera, move["target"])
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
    return camera

def setup_lights(specs):
    for index, spec in enumerate(specs or []):
        data = bpy.data.lights.new("BDM_Light_%02d" % index, spec.get("type", "AREA"))
        data.energy = float(spec.get("power", 1200))
        data.color = hex_color(spec.get("color", "#ffffff"))[:3]
        if data.type == "AREA":
            data.shape = "DISK"
            data.size = float(spec.get("size", 5))
        obj = bpy.data.objects.new(data.name, data)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = vec(spec.get("position"), (4, -4, 6))
        if "target" in spec:
            aim(obj, spec["target"])

def setup_world(environment):
    world = bpy.data.worlds.new("BDM_World") if not bpy.data.worlds else bpy.data.worlds[0]
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = hex_color(environment.get("background", "#101b2a"))
        bg.inputs["Strength"].default_value = float(environment.get("ambient_strength", .35))
    scene = bpy.context.scene
    scene.render.film_transparent = False
    if environment.get("ground", True):
        bpy.ops.mesh.primitive_plane_add(size=200, location=(0, -0.1, 0))
        ground = bpy.context.object
        ground.name = "BDM_Ground"
        ground_mat = make_material(environment.get("ground_material", {"base_color":"#172d35","roughness":.9}))
        ground.data.materials.append(ground_mat)

def build_shot(shot, project, project_dir, output_dir, shot_index):
    clear_scene()
    scene = bpy.context.scene
    requested_engine = project["project"].get("render_engine", "BLENDER_EEVEE_NEXT")
    supported_engines = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    if requested_engine not in supported_engines:
        requested_engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in supported_engines else "BLENDER_EEVEE"
    scene.render.engine = requested_engine
    scene.render.resolution_percentage = int(project["project"].get("resolution_percentage", 100))
    if scene.render.engine == "BLENDER_WORKBENCH":
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "MATERIAL"
        scene.display.shading.show_shadows = True
        scene.display.shading.show_cavity = True
        scene.display.shading.cavity_type = "BOTH"
    elif hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = int(project["project"].get("render_samples", 16))
    scene.render.resolution_x = int(project["resolution"][0])
    scene.render.resolution_y = int(project["resolution"][1])
    scene.render.resolution_percentage = 100
    scene.render.fps = int(project["fps"])
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    if "AgX" in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items.keys():
        scene.view_settings.view_transform = "AgX"
    setup_world(shot.get("environment", {}))
    for entity in shot.get("entities", []):
        create_entity(entity, project_dir)
    setup_lights(shot.get("lights", []))
    frames = max(2, int(round(float(shot["duration_seconds"]) * project["fps"])))
    scene.frame_start, scene.frame_end = 1, frames
    setup_camera(shot["camera"], frames)
    scene.render.filepath = os.path.join(output_dir, "shot_%03d_" % shot_index)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(animation=True)
    return frames

def main():
    project_path, output_path = args_after_double_dash()
    project_path = os.path.abspath(project_path)
    project_dir = os.path.dirname(project_path)
    output_path = os.path.abspath(output_path)
    with open(project_path, "r", encoding="utf-8") as handle:
        project = json.load(handle)
    if project.get("version") != 2 or not project.get("shots"):
        raise ValueError("Expected a version 2 project with at least one shot")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    temp_dir = output_path + ".frames"
    os.makedirs(temp_dir, exist_ok=True)
    total_frames = 0
    for index, shot in enumerate(project["shots"], 1):
        total_frames += build_shot(shot, project["project"], project_dir, temp_dir, index)
    fps = int(project["project"]["fps"])
    pattern = os.path.join(temp_dir, "shot_%03d_") + "%04d.png"
    command = ["ffmpeg", "-y", "-framerate", str(fps), "-i", pattern,
               "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output_path]
    # A single numbered sequence is required by FFmpeg; concatenate per-shot sequences.
    concat_file = os.path.join(temp_dir, "concat.txt")
    frame_paths = []
    for index in range(1, len(project["shots"]) + 1):
        prefix = os.path.join(temp_dir, "shot_%03d_" % index)
        frame_paths.extend(sorted(os.path.join(temp_dir, f) for f in os.listdir(temp_dir)
                                  if f.startswith(os.path.basename(prefix)) and f.endswith(".png")))
    if not frame_paths:
        raise RuntimeError("Blender produced no frames")
    with open(concat_file, "w", encoding="utf-8") as handle:
        for path in frame_paths:
            handle.write("file '%s'\n" % path.replace("'", "'\\''"))
    concat_command = ["ffmpeg", "-y", "-r", str(fps), "-f", "concat", "-safe", "0", "-i", concat_file,
                      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output_path]
    subprocess.run(concat_command, check=True)
    print("Rendered %d shots / %d frames -> %s" % (len(project["shots"]), total_frames, output_path))

if __name__ == "__main__":
    main()
