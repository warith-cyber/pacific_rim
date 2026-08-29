"""Export the web-ready Striker model without modifying pacific_rim.blend.

Run with:
  blender --background pacific_rim.blend --python assets/export_pacific_rim_glb.py
"""

from __future__ import annotations

import json
import struct
from collections import Counter
from pathlib import Path

import bpy
from mathutils import Vector


SOURCE_COLLECTIONS = ("STRIKER_V4_MODEL", "STRIKER_V4_DETAILS")
SOURCE_ROOT = "STRIKER_V4_ROOT"
OUTPUT_NAME = "pacific-rim-striker.glb"
REPORT_NAME = "pacific-rim-striker.export.json"
GEOMETRY_TYPES = {"MESH", "CURVE", "SURFACE", "FONT", "META"}


def rounded(values):
    return [round(float(value), 6) for value in values]


def evaluated_stats(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    bounds_min = Vector((float("inf"),) * 3)
    bounds_max = Vector((float("-inf"),) * 3)
    vertices = 0
    triangles = 0
    geometry_objects = 0

    for source_object in objects:
        if source_object.type not in GEOMETRY_TYPES:
            continue

        evaluated_object = source_object.evaluated_get(depsgraph)
        mesh = evaluated_object.to_mesh()
        if mesh is None:
            continue

        geometry_objects += 1
        vertices += len(mesh.vertices)
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        world_matrix = evaluated_object.matrix_world
        for vertex in mesh.vertices:
            world_position = world_matrix @ vertex.co
            bounds_min.x = min(bounds_min.x, world_position.x)
            bounds_min.y = min(bounds_min.y, world_position.y)
            bounds_min.z = min(bounds_min.z, world_position.z)
            bounds_max.x = max(bounds_max.x, world_position.x)
            bounds_max.y = max(bounds_max.y, world_position.y)
            bounds_max.z = max(bounds_max.z, world_position.z)
        evaluated_object.to_mesh_clear()

    size = bounds_max - bounds_min
    center = (bounds_min + bounds_max) * 0.5
    return {
        "geometry_objects": geometry_objects,
        "vertices": vertices,
        "triangles": triangles,
        "bounds_min": rounded(bounds_min),
        "bounds_max": rounded(bounds_max),
        "bounds_size": rounded(size),
        "bounds_center": rounded(center),
    }


def read_glb_json(path):
    with path.open("rb") as handle:
        magic, version, total_length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2:
            raise RuntimeError(f"Not a glTF 2 GLB: {path}")
        chunk_length, chunk_type = struct.unpack("<II", handle.read(8))
        if chunk_type != 0x4E4F534A:
            raise RuntimeError(f"First GLB chunk is not JSON: {path}")
        document = json.loads(handle.read(chunk_length).decode("utf-8"))
    document["_glb_total_length"] = total_length
    return document


def glb_triangle_count(document):
    accessors = document.get("accessors", [])
    triangles = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            mode = primitive.get("mode", 4)
            if mode != 4:
                continue
            if "indices" in primitive:
                primitive_vertices = accessors[primitive["indices"]]["count"]
            else:
                position_accessor = primitive["attributes"]["POSITION"]
                primitive_vertices = accessors[position_accessor]["count"]
            triangles += primitive_vertices // 3
    return triangles


def names_matching(names, fragments):
    return [
        name
        for name in names
        if any(fragment.lower() in name.lower() for fragment in fragments)
    ]


blend_path = Path(bpy.data.filepath)
if not blend_path.name:
    raise RuntimeError("This script must run with pacific_rim.blend loaded.")

output_dir = blend_path.parent / "assets"
output_dir.mkdir(parents=True, exist_ok=True)
glb_path = output_dir / OUTPUT_NAME
report_path = output_dir / REPORT_NAME

missing_collections = [
    name for name in SOURCE_COLLECTIONS if bpy.data.collections.get(name) is None
]
if missing_collections:
    raise RuntimeError(f"Missing source collections: {missing_collections}")

included = {}
for collection_name in SOURCE_COLLECTIONS:
    for source_object in bpy.data.collections[collection_name].objects:
        included[source_object.name] = source_object
included_objects = [included[name] for name in sorted(included)]

root_object = bpy.data.objects.get(SOURCE_ROOT)
if root_object is None or SOURCE_ROOT not in included:
    raise RuntimeError(f"Missing included source root: {SOURCE_ROOT}")

source_names = [source_object.name for source_object in included_objects]
source_geometry_names = [
    source_object.name
    for source_object in included_objects
    if source_object.type in GEOMETRY_TYPES
]
source_material_names = sorted(
    {
        material.name
        for source_object in included_objects
        for slot in source_object.material_slots
        if (material := slot.material) is not None
    }
)
source_stats = evaluated_stats(included_objects)
source_type_counts = dict(
    sorted(Counter(source_object.type for source_object in included_objects).items())
)
source_modifier_count = sum(
    len(source_object.modifiers) for source_object in included_objects
)

bpy.ops.object.select_all(action="DESELECT")
for source_object in included_objects:
    source_object.hide_set(False)
    source_object.select_set(True)
bpy.context.view_layer.objects.active = root_object

result = bpy.ops.export_scene.gltf(
    filepath=str(glb_path),
    check_existing=False,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials="EXPORT",
    export_attributes=True,
    export_extras=True,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_skins=False,
    export_morph=False,
)
if "FINISHED" not in result:
    raise RuntimeError(f"glTF export failed: {result}")

glb_document = read_glb_json(glb_path)
glb_node_names = [node.get("name", "") for node in glb_document.get("nodes", [])]
glb_mesh_names = [mesh.get("name", "") for mesh in glb_document.get("meshes", [])]
glb_material_names = [
    material.get("name", "") for material in glb_document.get("materials", [])
]
scene_index = glb_document.get("scene", 0)
scene_roots = []
if glb_document.get("scenes"):
    scene_root_indices = glb_document["scenes"][scene_index].get("nodes", [])
    scene_roots = [glb_node_names[index] for index in scene_root_indices]

# Re-import the actual GLB into a clean in-memory Blender session. This validates
# that it loads and gives independent post-export geometry/bounds measurements.
bpy.ops.wm.read_factory_settings(use_empty=True)
import_result = bpy.ops.import_scene.gltf(filepath=str(glb_path))
if "FINISHED" not in import_result:
    raise RuntimeError(f"GLB validation import failed: {import_result}")
imported_objects = list(bpy.context.scene.objects)
imported_stats = evaluated_stats(imported_objects)
imported_type_counts = dict(
    sorted(Counter(source_object.type for source_object in imported_objects).items())
)
imported_names = sorted(source_object.name for source_object in imported_objects)

component_groups = {
    "Head": names_matching(
        source_geometry_names,
        ("Head", "Face Mask", "Visor", "Neck Core", "Neck Ring", "Sensor"),
    ),
    "Chest": names_matching(
        source_geometry_names,
        (
            "Torso",
            "Pectoral",
            "Sternum",
            "Abdomen",
            "Chest Vent",
            "Chest Marking",
        ),
    ),
    "Shoulders": names_matching(source_geometry_names, ("Shoulder",)),
    "Arms": names_matching(
        source_geometry_names,
        (
            "Upper Arm",
            "Elbow",
            "Forearm",
            "Wrist",
            "Palm",
            "Finger",
            "Thumb",
            "Arm Cable",
        ),
    ),
    "Blades": names_matching(source_geometry_names, ("Shoulder Blade",)),
    "Legs": names_matching(
        source_geometry_names,
        (
            "Hip",
            "Thigh",
            "Knee",
            "Shin",
            "Calf",
            "Ankle",
            "Foot",
            "Toe",
            "Heel",
        ),
    ),
    "Backpack": names_matching(
        source_geometry_names,
        (
            "Rear Reactor",
            "Scapula",
            "Dorsal Fin",
            "Rear Spine",
            "Rear Vent",
            "Rear Waist Cable",
        ),
    ),
}

report = {
    "source_file": blend_path.name,
    "source_file_was_saved": False,
    "output_file": glb_path.name,
    "output_bytes": glb_path.stat().st_size,
    "exported_collections": list(SOURCE_COLLECTIONS),
    "excluded_collection": "STRIKER_V4_ENVIRONMENT",
    "root_object": SOURCE_ROOT,
    "centering": (
        "Source transforms preserved; use the reported bounds center to center "
        "the model at runtime."
    ),
    "source": {
        "object_count": len(included_objects),
        "type_counts": source_type_counts,
        "modifier_count": source_modifier_count,
        "material_count": len(source_material_names),
        "material_names": source_material_names,
        "evaluated": source_stats,
        "object_names": source_names,
    },
    "glb": {
        "version": glb_document.get("asset", {}).get("version"),
        "generator": glb_document.get("asset", {}).get("generator"),
        "scene_count": len(glb_document.get("scenes", [])),
        "scene_roots": scene_roots,
        "node_count": len(glb_node_names),
        "node_names": glb_node_names,
        "mesh_count": len(glb_mesh_names),
        "mesh_names": glb_mesh_names,
        "material_count": len(glb_material_names),
        "material_names": glb_material_names,
        "triangle_count_from_accessors": glb_triangle_count(glb_document),
        "camera_count": len(glb_document.get("cameras", [])),
        "animation_count": len(glb_document.get("animations", [])),
        "extensions_used": glb_document.get("extensionsUsed", []),
    },
    "validation_import": {
        "succeeded": True,
        "object_count": len(imported_objects),
        "type_counts": imported_type_counts,
        "object_names": imported_names,
        "evaluated": imported_stats,
    },
    "component_groups": component_groups,
}

report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

print("PACIFIC_RIM_EXPORT_OK")
print(json.dumps({
    "glb": str(glb_path),
    "report": str(report_path),
    "bytes": report["output_bytes"],
    "source": report["source"]["evaluated"],
    "glb_nodes": report["glb"]["node_count"],
    "glb_meshes": report["glb"]["mesh_count"],
    "glb_materials": report["glb"]["material_count"],
    "glb_triangles": report["glb"]["triangle_count_from_accessors"],
    "validated": report["validation_import"]["succeeded"],
    "validation": report["validation_import"]["evaluated"],
}, indent=2))
