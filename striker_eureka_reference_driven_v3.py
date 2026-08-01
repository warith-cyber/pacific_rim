
"""
Procedural Jaeger-style mech generator for Blender 4.x
Reference-driven Striker Eureka procedural model based on the supplied blueprint, front/back reference sheets, and publicly viewable concept/model imagery.

What it creates:
- Fully three-dimensional, symmetrical hard-surface mech
- Layered torso, shoulder pods, head, articulated-looking limbs
- Armor panels, vents, joints, pistons, missile cells, winglets and blades
- Metallic navy/silver materials, amber visor and cyan emission details
- Studio floor, camera, lighting, compositor glow and final PNG render

Important:
No publicly accessible image set provides the original ILM production mesh or complete orthographic construction drawings. This script therefore uses multiple front, rear, and three-quarter references to create a detailed procedural approximation rather than an exact film asset.

Tested for Blender 4.x API conventions. It should also work in late Blender 3.x
with the Eevee compatibility fallbacks included below.
"""

import bpy
import math
from mathutils import Vector
from pathlib import Path

# ---------------------------------------------------------------------------
# USER SETTINGS
# ---------------------------------------------------------------------------

AUTO_RENDER = True
AUTO_SAVE_BLEND = False
USE_CYCLES = False          # False = faster Eevee render
RENDER_SAMPLES = 128
RENDER_TURNTABLE_VIEWS = True   # front, rear, side and 3/4 renders
RESOLUTION_X = 900
RESOLUTION_Y = 1200
DETAIL_LEVEL = 2            # 1 = lighter scene, 2 = full procedural detailing
OUTPUT_IMAGE = "//striker_eureka_render.png"
OUTPUT_BLEND = "//striker_eureka_procedural.blend"

# Overall model dimensions are approximately 11 Blender metres high.
# Increase this only if you want a larger object in the scene.
MODEL_SCALE = 1.0

# ---------------------------------------------------------------------------
# BASIC UTILITIES
# ---------------------------------------------------------------------------

def radians_xyz(values):
    return tuple(math.radians(v) for v in values)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        # Remove only unused blocks. Materials are recreated later.
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def make_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def link_to_collection(obj, collection):
    for old_collection in list(obj.users_collection):
        old_collection.objects.unlink(obj)
    collection.objects.link(obj)


def make_material(
    name,
    base_color,
    metallic=0.0,
    roughness=0.45,
    emission_color=None,
    emission_strength=0.0,
    transmission=0.0,
    alpha=1.0,
):
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name=name)

    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")

    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness

        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = transmission
        elif "Transmission" in bsdf.inputs:
            bsdf.inputs["Transmission"].default_value = transmission

        if emission_color is not None:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = (*emission_color, 1.0)
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = (*emission_color, 1.0)

            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emission_strength

        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha

    material.diffuse_color = (*base_color, alpha)

    if alpha < 1.0:
        material.surface_render_method = "DITHERED" if hasattr(material, "surface_render_method") else None

    return material


def add_weathering(material, scale=5.0, bump_strength=0.10, rough_min=0.20, rough_max=0.42):
    """Add subtle cast-metal variation without requiring external textures."""
    if not material.use_nodes:
        return

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        return

    noise = nodes.new(type="ShaderNodeTexNoise")
    noise.name = material.name + " Surface Noise"
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.68

    bump = nodes.new(type="ShaderNodeBump")
    bump.name = material.name + " Micro Bump"
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.055
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    ramp = nodes.new(type="ShaderNodeValToRGB")
    ramp.name = material.name + " Roughness Variation"
    ramp.color_ramp.elements[0].position = 0.20
    ramp.color_ramp.elements[0].color = (rough_min, rough_min, rough_min, 1.0)
    ramp.color_ramp.elements[1].position = 0.82
    ramp.color_ramp.elements[1].color = (rough_max, rough_max, rough_max, 1.0)
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Roughness"])


def assign_material(obj, material):
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.append(material)


def add_bevel(obj, width=0.08, segments=3):
    if width <= 0:
        return
    modifier = obj.modifiers.new(name="Edge bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"


def add_box(
    name,
    location,
    dimensions,
    material,
    rotation=(0.0, 0.0, 0.0),
    bevel=0.08,
    collection=None,
):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    add_bevel(obj, min(bevel, min(dimensions) * 0.25), 3)
    assign_material(obj, material)
    if collection:
        link_to_collection(obj, collection)
    return obj


def add_wedge(
    name,
    location,
    dimensions,
    material,
    rotation=(0.0, 0.0, 0.0),
    top_scale_x=0.70,
    top_scale_y=0.80,
    bevel=0.06,
    collection=None,
):
    width, depth, height = dimensions
    bx = width * 0.5
    by = depth * 0.5
    tx = bx * top_scale_x
    ty = by * top_scale_y
    bz = height * 0.5

    vertices = [
        (-bx, -by, -bz),
        ( bx, -by, -bz),
        ( bx,  by, -bz),
        (-bx,  by, -bz),
        (-tx, -ty,  bz),
        ( tx, -ty,  bz),
        ( tx,  ty,  bz),
        (-tx,  ty,  bz),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (4, 0, 3, 7),
    ]

    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = rotation
    (collection or bpy.context.scene.collection).objects.link(obj)
    add_bevel(obj, min(bevel, min(dimensions) * 0.22), 3)
    assign_material(obj, material)
    return obj


def add_tri_fin(
    name,
    location,
    width,
    depth,
    height,
    material,
    rotation=(0.0, 0.0, 0.0),
    collection=None,
):
    y0 = -depth * 0.5
    y1 = depth * 0.5
    x = width * 0.5
    z = height * 0.5

    vertices = [
        (-x, y0, -z),
        ( x, y0, -z),
        (0.0, y0, z),
        (-x, y1, -z),
        ( x, y1, -z),
        (0.0, y1, z),
    ]
    faces = [
        (0, 1, 2),
        (3, 5, 4),
        (0, 3, 4, 1),
        (1, 4, 5, 2),
        (2, 5, 3, 0),
    ]

    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = rotation
    (collection or bpy.context.scene.collection).objects.link(obj)
    add_bevel(obj, min(width, depth, height) * 0.08, 2)
    assign_material(obj, material)
    return obj


def add_cylinder(
    name,
    location,
    radius,
    depth,
    material,
    rotation=(0.0, 0.0, 0.0),
    vertices=32,
    bevel=0.03,
    collection=None,
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    add_bevel(obj, min(bevel, radius * 0.25), 2)
    assign_material(obj, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if collection:
        link_to_collection(obj, collection)
    return obj


def add_cylinder_between(
    name,
    point_a,
    point_b,
    radius,
    material,
    vertices=24,
    bevel=0.02,
    collection=None,
):
    a = Vector(point_a)
    b = Vector(point_b)
    direction = b - a
    length = direction.length
    midpoint = (a + b) * 0.5

    obj = add_cylinder(
        name,
        midpoint,
        radius,
        length,
        material,
        vertices=vertices,
        bevel=bevel,
        collection=collection,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return obj


def add_sphere(
    name,
    location,
    radius,
    material,
    scale=(1.0, 1.0, 1.0),
    collection=None,
):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if collection:
        link_to_collection(obj, collection)
    return obj


def add_torus(
    name,
    location,
    major_radius,
    minor_radius,
    material,
    rotation=(0.0, 0.0, 0.0),
    collection=None,
):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if collection:
        link_to_collection(obj, collection)
    return obj


def add_cable(name, points, radius, material, collection=None):
    curve_data = bpy.data.curves.new(name=name + "_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 3

    spline = curve_data.splines.new(type="POLY")
    spline.points.add(len(points) - 1)
    for index, point in enumerate(points):
        spline.points[index].co = (*point, 1.0)

    obj = bpy.data.objects.new(name, curve_data)
    (collection or bpy.context.scene.collection).objects.link(obj)
    assign_material(obj, material)
    return obj


def add_panel_bolts(prefix, center, count, spacing, radius, material, axis="X", collection=None):
    for index in range(count):
        offset = (index - (count - 1) * 0.5) * spacing
        position = list(center)
        if axis == "X":
            position[0] += offset
        elif axis == "Y":
            position[1] += offset
        else:
            position[2] += offset
        add_sphere(
            f"{prefix}_{index:02d}",
            tuple(position),
            radius,
            material,
            collection=collection,
        )


def parent_objects(objects, parent):
    for obj in objects:
        if obj is not None:
            obj.parent = parent


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


# ---------------------------------------------------------------------------
# SCENE AND MATERIALS
# ---------------------------------------------------------------------------

clear_scene()

scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.render.resolution_x = RESOLUTION_X
scene.render.resolution_y = RESOLUTION_Y
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUTPUT_IMAGE
scene.render.film_transparent = False

if USE_CYCLES:
    scene.render.engine = "CYCLES"
    scene.cycles.samples = RENDER_SAMPLES
    scene.cycles.use_denoising = True
else:
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"

# Colour management
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.2

# World
world = scene.world
world.use_nodes = True
background = world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.008, 0.012, 0.020, 1.0)
background.inputs["Strength"].default_value = 0.18

# Collections
model_collection = make_collection("JAEGER_MODEL")
detail_collection = make_collection("JAEGER_DETAILS")
environment_collection = make_collection("RENDER_ENVIRONMENT")

# Root object
root = bpy.data.objects.new("JAEGER_ROOT", None)
model_collection.objects.link(root)
root.scale = (MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)

# Materials
MAT_NAVY = make_material("Armor Charcoal", (0.035, 0.044, 0.040), metallic=0.90, roughness=0.27)
MAT_BLUE = make_material("Armor Gunmetal", (0.115, 0.130, 0.120), metallic=0.86, roughness=0.29)
MAT_STEEL = make_material("Brushed Steel", (0.31, 0.33, 0.30), metallic=0.96, roughness=0.22)
MAT_DARK_STEEL = make_material("Dark Steel", (0.040, 0.046, 0.044), metallic=0.92, roughness=0.34)
MAT_BLACK = make_material("Mechanical Black", (0.008, 0.010, 0.010), metallic=0.58, roughness=0.30)
MAT_RUBBER = make_material("Joint Rubber", (0.012, 0.014, 0.014), metallic=0.04, roughness=0.70)
MAT_BRONZE = make_material("Weathered Bronze", (0.22, 0.145, 0.055), metallic=0.86, roughness=0.31)
MAT_CYAN = make_material(
    "Cool Reactor Light",
    (0.015, 0.18, 0.23),
    metallic=0.10,
    roughness=0.18,
    emission_color=(0.0, 0.48, 0.72),
    emission_strength=5.0,
)
MAT_AMBER = make_material(
    "Amber Visor",
    (0.32, 0.105, 0.008),
    metallic=0.12,
    roughness=0.12,
    emission_color=(1.0, 0.22, 0.008),
    emission_strength=10.0,
)
MAT_RED = make_material(
    "Warning Red",
    (0.24, 0.004, 0.002),
    metallic=0.20,
    roughness=0.24,
    emission_color=(0.95, 0.012, 0.004),
    emission_strength=4.5,
)
MAT_FLOOR = make_material("Floor", (0.012, 0.016, 0.018), metallic=0.35, roughness=0.42)

for weathered_material, weather_scale, weather_strength in (
    (MAT_NAVY, 4.2, 0.12),
    (MAT_BLUE, 5.0, 0.11),
    (MAT_STEEL, 7.0, 0.07),
    (MAT_DARK_STEEL, 5.8, 0.09),
    (MAT_BRONZE, 6.0, 0.08),
):
    add_weathering(weathered_material, scale=weather_scale, bump_strength=weather_strength)


created_model_parts = []

def register(obj, parent=root):
    created_model_parts.append(obj)
    obj.parent = parent
    return obj

# ---------------------------------------------------------------------------
# CORE BODY
# ---------------------------------------------------------------------------

# Pelvis and waist
register(add_wedge(
    "Pelvis Core",
    (0.0, 0.0, 5.15),
    (3.2, 1.65, 1.10),
    MAT_NAVY,
    top_scale_x=0.76,
    top_scale_y=0.78,
    bevel=0.10,
    collection=model_collection,
))
register(add_box(
    "Pelvis Front Plate",
    (0.0, -0.92, 5.18),
    (2.55, 0.28, 0.68),
    MAT_BLUE,
    bevel=0.06,
    collection=model_collection,
))
register(add_box(
    "Pelvis Lower Guard",
    (0.0, -0.82, 4.72),
    (1.28, 0.36, 0.52),
    MAT_STEEL,
    rotation=radians_xyz((12, 0, 0)),
    bevel=0.05,
    collection=model_collection,
))

register(add_cylinder(
    "Waist Rotary Core",
    (0.0, 0.0, 5.82),
    0.72,
    0.55,
    MAT_DARK_STEEL,
    vertices=48,
    bevel=0.04,
    collection=model_collection,
))
register(add_torus(
    "Waist Energy Ring",
    (0.0, 0.0, 5.82),
    0.73,
    0.055,
    MAT_CYAN,
    collection=detail_collection,
))

# Segmented abdomen
for i, z in enumerate((6.05, 6.36, 6.67)):
    width = 2.0 + i * 0.28
    register(add_box(
        f"Abdominal Armor {i+1}",
        (0.0, -0.38, z),
        (width, 1.05, 0.24),
        MAT_NAVY if i != 1 else MAT_BLUE,
        rotation=radians_xyz((-3, 0, 0)),
        bevel=0.055,
        collection=model_collection,
    ))
    register(add_box(
        f"Abdominal Cyan Strip {i+1}",
        (0.0, -0.96, z),
        (width * 0.72, 0.045, 0.042),
        MAT_CYAN,
        bevel=0.012,
        collection=detail_collection,
    ))

# Main torso mass
register(add_wedge(
    "Torso Core",
    (0.0, 0.0, 7.75),
    (5.15, 2.05, 2.55),
    MAT_NAVY,
    top_scale_x=1.12,
    top_scale_y=0.90,
    bevel=0.14,
    collection=model_collection,
))

# Pectoral armor plates
for side in (-1, 1):
    register(add_wedge(
        f"{'Left' if side < 0 else 'Right'} Chest Plate",
        (side * 1.42, -1.03, 8.05),
        (2.45, 0.48, 1.42),
        MAT_BLUE,
        rotation=radians_xyz((3, side * -4, side * -6)),
        top_scale_x=0.82,
        top_scale_y=0.96,
        bevel=0.08,
        collection=model_collection,
    ))

    register(add_box(
        f"{'Left' if side < 0 else 'Right'} Chest Rim",
        (side * 1.48, -1.31, 8.12),
        (2.10, 0.075, 0.105),
        MAT_STEEL,
        rotation=radians_xyz((0, 0, side * -6)),
        bevel=0.022,
        collection=detail_collection,
    ))

# Sternum and lower torso details
register(add_wedge(
    "Sternum Shield",
    (0.0, -1.19, 7.82),
    (0.92, 0.34, 1.82),
    MAT_STEEL,
    top_scale_x=0.55,
    top_scale_y=0.88,
    bevel=0.055,
    collection=model_collection,
))
register(add_box(
    "Sternum Energy Line",
    (0.0, -1.39, 7.95),
    (0.10, 0.045, 1.18),
    MAT_CYAN,
    bevel=0.018,
    collection=detail_collection,
))

# Chest vent row
for index in range(5):
    x = (index - 2) * 0.36
    register(add_box(
        f"Chest Vent {index+1}",
        (x, -1.405, 7.32),
        (0.18, 0.07, 0.42),
        MAT_BLACK,
        rotation=radians_xyz((0, 0, -8 * (index - 2))),
        bevel=0.025,
        collection=detail_collection,
    ))
    register(add_box(
        f"Chest Vent Glow {index+1}",
        (x, -1.449, 7.32),
        (0.055, 0.018, 0.25),
        MAT_CYAN,
        bevel=0.007,
        collection=detail_collection,
    ))

# Side torso mechanical nodes
for side in (-1, 1):
    register(add_cylinder(
        f"{'Left' if side < 0 else 'Right'} Chest Rotary Housing",
        (side * 2.42, -0.84, 7.78),
        0.43,
        0.32,
        MAT_DARK_STEEL,
        rotation=radians_xyz((90, 0, 0)),
        vertices=40,
        bevel=0.035,
        collection=model_collection,
    ))
    register(add_torus(
        f"{'Left' if side < 0 else 'Right'} Chest Rotary Ring",
        (side * 2.42, -1.02, 7.78),
        0.33,
        0.055,
        MAT_CYAN,
        rotation=radians_xyz((90, 0, 0)),
        collection=detail_collection,
    ))

# Collar and neck
register(add_box(
    "Collar Base",
    (0.0, 0.0, 8.97),
    (2.35, 1.25, 0.46),
    MAT_DARK_STEEL,
    bevel=0.07,
    collection=model_collection,
))
register(add_cylinder(
    "Neck",
    (0.0, 0.0, 9.35),
    0.42,
    0.65,
    MAT_RUBBER,
    vertices=36,
    bevel=0.03,
    collection=model_collection,
))
register(add_torus(
    "Neck Ring",
    (0.0, 0.0, 9.20),
    0.44,
    0.055,
    MAT_STEEL,
    collection=detail_collection,
))

# ---------------------------------------------------------------------------
# HEAD
# ---------------------------------------------------------------------------

register(add_wedge(
    "Head Main",
    (0.0, -0.03, 9.82),
    (1.28, 1.18, 1.12),
    MAT_NAVY,
    top_scale_x=0.72,
    top_scale_y=0.78,
    bevel=0.075,
    collection=model_collection,
))
register(add_wedge(
    "Face Plate",
    (0.0, -0.68, 9.68),
    (0.92, 0.24, 0.72),
    MAT_STEEL,
    top_scale_x=0.72,
    top_scale_y=0.92,
    bevel=0.04,
    collection=model_collection,
))
register(add_box(
    "Visor",
    (0.0, -0.823, 9.93),
    (0.88, 0.055, 0.16),
    MAT_AMBER,
    bevel=0.025,
    collection=detail_collection,
))
register(add_wedge(
    "Forehead Bronze Crest",
    (0.0, -0.65, 10.23),
    (0.40, 0.18, 0.46),
    MAT_BRONZE,
    top_scale_x=0.45,
    top_scale_y=0.82,
    bevel=0.025,
    collection=detail_collection,
))
register(add_box(
    "Lower Face Intake",
    (0.0, -0.825, 9.50),
    (0.52, 0.055, 0.18),
    MAT_BLACK,
    bevel=0.018,
    collection=detail_collection,
))

# Helmet crown and side ears
register(add_tri_fin(
    "Helmet Crest",
    (0.0, 0.02, 10.54),
    0.34,
    0.36,
    1.10,
    MAT_STEEL,
    rotation=radians_xyz((0, 0, 0)),
    collection=model_collection,
))
for side in (-1, 1):
    register(add_cylinder(
        f"{'Left' if side < 0 else 'Right'} Head Sensor",
        (side * 0.69, -0.02, 9.88),
        0.22,
        0.18,
        MAT_DARK_STEEL,
        rotation=radians_xyz((0, 90, 0)),
        vertices=32,
        bevel=0.025,
        collection=model_collection,
    ))
    register(add_torus(
        f"{'Left' if side < 0 else 'Right'} Head Sensor Ring",
        (side * 0.79, -0.02, 9.88),
        0.15,
        0.035,
        MAT_CYAN,
        rotation=radians_xyz((0, 90, 0)),
        collection=detail_collection,
    ))
    register(add_tri_fin(
        f"{'Left' if side < 0 else 'Right'} Helmet Fin",
        (side * 0.53, 0.12, 10.45),
        0.28,
        0.24,
        0.82,
        MAT_BLUE,
        rotation=radians_xyz((0, side * 7, side * -8)),
        collection=model_collection,
    ))

# ---------------------------------------------------------------------------
# SHOULDERS, WING ASSEMBLY AND BACK
# ---------------------------------------------------------------------------

# Rear spine
for i, z in enumerate((6.4, 7.0, 7.6, 8.2, 8.8)):
    register(add_box(
        f"Rear Spine Segment {i+1}",
        (0.0, 1.13, z),
        (0.62 + i * 0.06, 0.24, 0.38),
        MAT_DARK_STEEL,
        bevel=0.045,
        collection=model_collection,
    ))

for side in (-1, 1):
    side_name = "Left" if side < 0 else "Right"

    # Shoulder joints
    register(add_sphere(
        f"{side_name} Shoulder Joint",
        (side * 3.02, 0.0, 8.55),
        0.64,
        MAT_RUBBER,
        scale=(1.0, 0.92, 1.0),
        collection=model_collection,
    ))
    register(add_cylinder(
        f"{side_name} Shoulder Axle",
        (side * 3.05, 0.0, 8.55),
        0.48,
        0.58,
        MAT_STEEL,
        rotation=radians_xyz((0, 90, 0)),
        vertices=40,
        bevel=0.04,
        collection=model_collection,
    ))

    # Large shoulder pod
    register(add_wedge(
        f"{side_name} Shoulder Pod",
        (side * 3.66, 0.12, 8.92),
        (1.62, 2.25, 1.50),
        MAT_BLUE,
        rotation=radians_xyz((0, side * -4, side * -7)),
        top_scale_x=0.72,
        top_scale_y=0.62,
        bevel=0.11,
        collection=model_collection,
    ))
    register(add_box(
        f"{side_name} Shoulder Top Plate",
        (side * 3.66, -0.27, 9.66),
        (1.18, 1.45, 0.20),
        MAT_STEEL,
        rotation=radians_xyz((0, side * -4, side * -7)),
        bevel=0.045,
        collection=model_collection,
    ))
    register(add_cylinder(
        f"{side_name} Shoulder Circular Panel",
        (side * 3.66, -0.18, 9.80),
        0.42,
        0.10,
        MAT_DARK_STEEL,
        rotation=radians_xyz((0, 0, 0)),
        vertices=48,
        bevel=0.025,
        collection=detail_collection,
    ))
    register(add_torus(
        f"{side_name} Shoulder Circular Panel Ring",
        (side * 3.66, -0.18, 9.86),
        0.30,
        0.035,
        MAT_BRONZE,
        collection=detail_collection,
    ))

    # Shoulder turbine housing
    register(add_cylinder(
        f"{side_name} Shoulder Turbine",
        (side * 4.12, 0.54, 8.92),
        0.50,
        0.34,
        MAT_DARK_STEEL,
        rotation=radians_xyz((90, 0, 0)),
        vertices=48,
        bevel=0.035,
        collection=model_collection,
    ))
    register(add_torus(
        f"{side_name} Shoulder Turbine Ring",
        (side * 4.12, 0.34, 8.92),
        0.37,
        0.055,
        MAT_CYAN,
        rotation=radians_xyz((90, 0, 0)),
        collection=detail_collection,
    ))

    # Missile/vent cells on pod
    for row in range(2):
        for column in range(3):
            register(add_cylinder(
                f"{side_name} Shoulder Cell {row}_{column}",
                (
                    side * (3.35 + column * 0.23),
                    -1.035,
                    8.66 + row * 0.28,
                ),
                0.07,
                0.12,
                MAT_BLACK,
                rotation=radians_xyz((90, 0, 0)),
                vertices=20,
                bevel=0.01,
                collection=detail_collection,
            ))

    # Twin dorsal fins are mounted close to the backpack centreline in the
    # final front/back reference sheet, rather than on the outer shoulders.
    register(add_tri_fin(
        f"{side_name} Dorsal Fin",
        (side * 1.18, 1.18, 10.20),
        0.48,
        0.34,
        3.55,
        MAT_BLUE,
        rotation=radians_xyz((side * -3, side * 5, side * -2)),
        collection=model_collection,
    ))
    register(add_tri_fin(
        f"{side_name} Dorsal Fin Edge",
        (side * 1.22, 1.12, 10.18),
        0.15,
        0.38,
        3.18,
        MAT_STEEL,
        rotation=radians_xyz((side * -3, side * 5, side * -2)),
        collection=detail_collection,
    ))

    # Outer aft strake behind each arm.
    register(add_tri_fin(
        f"{side_name} Aft Armor Strake",
        (side * 2.92, 0.92, 7.42),
        0.70,
        0.24,
        1.82,
        MAT_NAVY,
        rotation=radians_xyz((side * -8, side * 14, side * -10)),
        collection=model_collection,
    ))


    if DETAIL_LEVEL >= 2:
        # Shoulder cable bundle
        add_cable(
            f"{side_name} Shoulder Cable A",
            [
                (side * 2.72, 0.48, 8.70),
                (side * 3.05, 0.82, 8.40),
                (side * 3.45, 0.88, 8.15),
            ],
            0.035,
            MAT_CYAN,
            collection=detail_collection,
        ).parent = root

        add_cable(
            f"{side_name} Shoulder Cable B",
            [
                (side * 2.68, 0.58, 8.48),
                (side * 3.02, 0.94, 8.18),
                (side * 3.42, 1.00, 7.94),
            ],
            0.028,
            MAT_BLACK,
            collection=detail_collection,
        ).parent = root

# ---------------------------------------------------------------------------
# REFERENCE-DRIVEN REAR ASSEMBLY
# ---------------------------------------------------------------------------

# The public front/back sheet and three-quarter production-model imagery show
# a compact central backpack, a large circular rear reactor, paired red heat
# vents, close-set dorsal fins, exposed hip mechanisms, and layered calf backs.

register(add_wedge(
    "Central Backpack Shell",
    (0.0, 1.24, 8.25),
    (2.76, 1.08, 2.36),
    MAT_NAVY,
    rotation=radians_xyz((4, 0, 0)),
    top_scale_x=0.76,
    top_scale_y=0.66,
    bevel=0.11,
    collection=model_collection,
))
register(add_wedge(
    "Upper Back Yoke",
    (0.0, 0.96, 9.02),
    (3.45, 0.62, 0.82),
    MAT_BLUE,
    rotation=radians_xyz((7, 0, 0)),
    top_scale_x=0.82,
    top_scale_y=0.74,
    bevel=0.07,
    collection=model_collection,
))

# Main circular reactor/exhaust visible in the rear orthographic reference.
register(add_cylinder(
    "Main Rear Reactor Housing",
    (0.0, 1.70, 8.34),
    0.70,
    0.50,
    MAT_DARK_STEEL,
    rotation=radians_xyz((90, 0, 0)),
    vertices=64,
    bevel=0.045,
    collection=model_collection,
))
register(add_torus(
    "Main Rear Reactor Outer Ring",
    (0.0, 1.98, 8.34),
    0.54,
    0.075,
    MAT_STEEL,
    rotation=radians_xyz((90, 0, 0)),
    collection=detail_collection,
))
register(add_torus(
    "Main Rear Reactor Light Ring",
    (0.0, 2.04, 8.34),
    0.36,
    0.045,
    MAT_CYAN,
    rotation=radians_xyz((90, 0, 0)),
    collection=detail_collection,
))
register(add_cylinder(
    "Main Rear Reactor Core",
    (0.0, 2.04, 8.34),
    0.23,
    0.06,
    MAT_BLACK,
    rotation=radians_xyz((90, 0, 0)),
    vertices=48,
    bevel=0.018,
    collection=detail_collection,
))

# Paired diagonal heat-vent banks under the shoulder blades.
for side in (-1, 1):
    side_name = "Left" if side < 0 else "Right"

    register(add_wedge(
        f"{side_name} Rear Scapula Shell",
        (side * 1.70, 1.28, 8.45),
        (1.26, 0.74, 1.42),
        MAT_BLUE,
        rotation=radians_xyz((5, side * 9, side * -11)),
        top_scale_x=0.74,
        top_scale_y=0.70,
        bevel=0.075,
        collection=model_collection,
    ))

    register(add_box(
        f"{side_name} Rear Vent Recess",
        (side * 1.57, 1.69, 7.88),
        (0.94, 0.10, 0.58),
        MAT_BLACK,
        rotation=radians_xyz((0, 0, side * -12)),
        bevel=0.025,
        collection=detail_collection,
    ))

    for vent_index in range(4):
        register(add_box(
            f"{side_name} Rear Red Vent {vent_index+1}",
            (
                side * (1.34 + vent_index * 0.16),
                1.755,
                7.80 + vent_index * 0.06,
            ),
            (0.10, 0.035, 0.34),
            MAT_RED,
            rotation=radians_xyz((0, 0, side * -18)),
            bevel=0.012,
            collection=detail_collection,
        ))

    # Rear shoulder armor and visible circular joint cap.
    register(add_wedge(
        f"{side_name} Rear Shoulder Shell",
        (side * 3.46, 0.84, 8.96),
        (1.54, 1.00, 1.20),
        MAT_NAVY,
        rotation=radians_xyz((4, side * 10, side * -7)),
        top_scale_x=0.68,
        top_scale_y=0.60,
        bevel=0.09,
        collection=model_collection,
    ))
    register(add_cylinder(
        f"{side_name} Rear Shoulder Joint Cover",
        (side * 3.75, 1.25, 8.62),
        0.34,
        0.18,
        MAT_STEEL,
        rotation=radians_xyz((90, 0, 0)),
        vertices=40,
        bevel=0.03,
        collection=detail_collection,
    ))

    # Exposed rear hip gear and buttress.
    register(add_cylinder(
        f"{side_name} Rear Hip Gear",
        (side * 1.34, 0.79, 4.92),
        0.39,
        0.20,
        MAT_DARK_STEEL,
        rotation=radians_xyz((90, 0, 0)),
        vertices=40,
        bevel=0.03,
        collection=model_collection,
    ))
    register(add_torus(
        f"{side_name} Rear Hip Gear Ring",
        (side * 1.34, 0.91, 4.92),
        0.28,
        0.040,
        MAT_BRONZE,
        rotation=radians_xyz((90, 0, 0)),
        collection=detail_collection,
    ))
    register(add_wedge(
        f"{side_name} Rear Hip Buttress",
        (side * 1.80, 0.77, 4.70),
        (0.62, 0.64, 1.20),
        MAT_BLUE,
        rotation=radians_xyz((8, side * 5, side * -4)),
        top_scale_x=0.72,
        top_scale_y=0.68,
        bevel=0.06,
        collection=model_collection,
    ))

    # Rear thigh and calf plates visible in three-quarter model references.
    register(add_box(
        f"{side_name} Rear Thigh Plate",
        (side * 1.36, 0.78, 4.08),
        (0.86, 0.22, 1.34),
        MAT_STEEL,
        rotation=radians_xyz((7, 0, side * -1)),
        bevel=0.045,
        collection=model_collection,
    ))
    register(add_box(
        f"{side_name} Rear Thigh Light",
        (side * 1.36, 0.91, 4.08),
        (0.10, 0.035, 0.78),
        MAT_CYAN,
        bevel=0.012,
        collection=detail_collection,
    ))
    register(add_wedge(
        f"{side_name} Rear Calf Armor",
        (side * 1.46, 0.98, 2.14),
        (0.88, 0.62, 1.48),
        MAT_NAVY,
        rotation=radians_xyz((8, 0, side * -1)),
        top_scale_x=0.74,
        top_scale_y=0.62,
        bevel=0.07,
        collection=model_collection,
    ))

    for vent_index in range(3):
        register(add_box(
            f"{side_name} Rear Calf Vent {vent_index+1}",
            (side * 1.46, 1.33, 1.88 + vent_index * 0.30),
            (0.52, 0.045, 0.11),
            MAT_BLACK,
            bevel=0.014,
            collection=detail_collection,
        ))

    # Small heel mechanism gives the rear silhouette the correct layered foot.
    register(add_box(
        f"{side_name} Rear Heel Mechanism",
        (side * 1.50, 1.14, 0.62),
        (0.72, 0.54, 0.72),
        MAT_DARK_STEEL,
        rotation=radians_xyz((5, 0, 0)),
        bevel=0.055,
        collection=model_collection,
    ))

    if DETAIL_LEVEL >= 2:
        add_cable(
            f"{side_name} Backpack Cable A",
            [
                (side * 0.48, 1.20, 8.92),
                (side * 0.96, 1.48, 8.70),
                (side * 1.52, 1.58, 8.42),
            ],
            0.026,
            MAT_BLACK,
            collection=detail_collection,
        ).parent = root
        add_cable(
            f"{side_name} Backpack Cable B",
            [
                (side * 0.38, 1.24, 8.60),
                (side * 0.88, 1.57, 8.36),
                (side * 1.32, 1.66, 8.10),
            ],
            0.020,
            MAT_CYAN,
            collection=detail_collection,
        ).parent = root

        register(add_cylinder_between(
            f"{side_name} Rear Hip Piston",
            (side * 0.88, 0.60, 5.24),
            (side * 1.16, 0.84, 4.54),
            0.044,
            MAT_STEEL,
            vertices=16,
            collection=detail_collection,
        ))
        register(add_cylinder_between(
            f"{side_name} Rear Calf Piston",
            (side * 1.15, 0.68, 3.04),
            (side * 1.18, 0.98, 1.54),
            0.038,
            MAT_CYAN,
            vertices=14,
            collection=detail_collection,
        ))

# ---------------------------------------------------------------------------
# ARMS AND HANDS
# ---------------------------------------------------------------------------

for side in (-1, 1):
    side_name = "Left" if side < 0 else "Right"

    shoulder = (side * 3.46, 0.0, 8.30)
    elbow = (side * 3.88, -0.02, 6.78)
    wrist = (side * 3.74, -0.11, 5.28)

    register(add_cylinder_between(
        f"{side_name} Upper Arm Internal",
        shoulder,
        elbow,
        0.34,
        MAT_DARK_STEEL,
        vertices=28,
        collection=model_collection,
    ))
    register(add_wedge(
        f"{side_name} Upper Arm Armor",
        (side * 3.68, -0.06, 7.52),
        (1.05, 1.15, 1.78),
        MAT_NAVY,
        rotation=radians_xyz((side * -2, side * -5, side * -5)),
        top_scale_x=0.72,
        top_scale_y=0.74,
        bevel=0.09,
        collection=model_collection,
    ))

    # Elbow mechanism
    register(add_sphere(
        f"{side_name} Elbow Joint",
        elbow,
        0.46,
        MAT_RUBBER,
        scale=(1.05, 0.88, 1.0),
        collection=model_collection,
    ))
    register(add_cylinder(
        f"{side_name} Elbow Disc",
        (side * 4.08, -0.02, 6.78),
        0.36,
        0.20,
        MAT_STEEL,
        rotation=radians_xyz((0, 90, 0)),
        vertices=36,
        bevel=0.03,
        collection=model_collection,
    ))
    register(add_torus(
        f"{side_name} Elbow Ring",
        (side * 4.20, -0.02, 6.78),
        0.25,
        0.045,
        MAT_CYAN,
        rotation=radians_xyz((0, 90, 0)),
        collection=detail_collection,
    ))

    # Forearm
    register(add_cylinder_between(
        f"{side_name} Forearm Internal",
        elbow,
        wrist,
        0.31,
        MAT_DARK_STEEL,
        vertices=28,
        collection=model_collection,
    ))
    register(add_wedge(
        f"{side_name} Forearm Armor",
        (side * 3.82, -0.06, 5.98),
        (1.12, 1.22, 1.82),
        MAT_BLUE,
        rotation=radians_xyz((side * 2, side * 2, side * 3)),
        top_scale_x=0.76,
        top_scale_y=0.82,
        bevel=0.095,
        collection=model_collection,
    ))
    register(add_box(
        f"{side_name} Forearm Energy Rail",
        (side * 3.84, -0.695, 5.95),
        (0.15, 0.055, 1.16),
        MAT_CYAN,
        rotation=radians_xyz((0, 0, side * 2)),
        bevel=0.018,
        collection=detail_collection,
    ))

    # Retractable blade housings
    register(add_box(
        f"{side_name} Blade Housing",
        (side * 4.35, -0.02, 5.90),
        (0.28, 0.78, 1.42),
        MAT_STEEL,
        rotation=radians_xyz((0, side * 4, side * 2)),
        bevel=0.045,
        collection=model_collection,
    ))
    register(add_tri_fin(
        f"{side_name} Sting Blade",
        (side * 4.62, -0.12, 5.68),
        0.30,
        0.12,
        1.75,
        MAT_STEEL,
        rotation=radians_xyz((0, side * -8, side * -2)),
        collection=model_collection,
    ))

    # Wrist
    register(add_cylinder(
        f"{side_name} Wrist Coupler",
        wrist,
        0.31,
        0.42,
        MAT_DARK_STEEL,
        vertices=32,
        bevel=0.025,
        collection=model_collection,
    ))
    register(add_torus(
        f"{side_name} Wrist Ring",
        wrist,
        0.32,
        0.04,
        MAT_CYAN,
        collection=detail_collection,
    ))

    # Hand and fingers
    palm_x = side * 3.73
    register(add_wedge(
        f"{side_name} Palm",
        (palm_x, -0.10, 4.78),
        (0.78, 0.72, 0.82),
        MAT_NAVY,
        top_scale_x=0.72,
        top_scale_y=0.78,
        bevel=0.06,
        collection=model_collection,
    ))

    finger_offsets = (-0.25, -0.08, 0.09, 0.26)
    for finger_index, x_offset in enumerate(finger_offsets):
        actual_x = palm_x + x_offset
        register(add_box(
            f"{side_name} Finger {finger_index+1}",
            (actual_x, -0.18, 4.25),
            (0.13, 0.19, 0.72),
            MAT_STEEL,
            rotation=radians_xyz((4, 0, 0)),
            bevel=0.028,
            collection=model_collection,
        ))
        register(add_box(
            f"{side_name} Finger Tip {finger_index+1}",
            (actual_x, -0.22, 3.88),
            (0.14, 0.20, 0.23),
            MAT_DARK_STEEL,
            rotation=radians_xyz((10, 0, 0)),
            bevel=0.03,
            collection=model_collection,
        ))

    register(add_box(
        f"{side_name} Thumb",
        (palm_x + side * 0.42, -0.18, 4.63),
        (0.20, 0.26, 0.58),
        MAT_STEEL,
        rotation=radians_xyz((0, side * -22, side * -18)),
        bevel=0.035,
        collection=model_collection,
    ))

    if DETAIL_LEVEL >= 2:
        # Double hydraulic pistons on each arm
        register(add_cylinder_between(
            f"{side_name} Upper Arm Piston A",
            (side * 3.26, 0.42, 8.10),
            (side * 3.58, 0.42, 7.00),
            0.055,
            MAT_STEEL,
            vertices=16,
            collection=detail_collection,
        ))
        register(add_cylinder_between(
            f"{side_name} Upper Arm Piston B",
            (side * 3.48, 0.47, 8.06),
            (side * 3.78, 0.47, 7.02),
            0.040,
            MAT_CYAN,
            vertices=14,
            collection=detail_collection,
        ))
        add_panel_bolts(
            f"{side_name} Forearm Bolts",
            (side * 3.82, -0.705, 6.35),
            4,
            0.20,
            0.035,
            MAT_STEEL,
            axis="Z",
            collection=detail_collection,
        )

# ---------------------------------------------------------------------------
# LEGS AND FEET
# ---------------------------------------------------------------------------

for side in (-1, 1):
    side_name = "Left" if side < 0 else "Right"

    hip = (side * 1.30, 0.0, 4.88)
    knee = (side * 1.42, -0.02, 3.18)
    ankle = (side * 1.48, -0.06, 1.18)

    # Hip joint
    register(add_sphere(
        f"{side_name} Hip Joint",
        hip,
        0.58,
        MAT_RUBBER,
        scale=(1.0, 0.92, 1.0),
        collection=model_collection,
    ))
    register(add_cylinder(
        f"{side_name} Hip Disc",
        (side * 1.52, 0.0, 4.88),
        0.42,
        0.24,
        MAT_STEEL,
        rotation=radians_xyz((0, 90, 0)),
        vertices=40,
        bevel=0.035,
        collection=model_collection,
    ))
    register(add_torus(
        f"{side_name} Hip Ring",
        (side * 1.67, 0.0, 4.88),
        0.30,
        0.048,
        MAT_CYAN,
        rotation=radians_xyz((0, 90, 0)),
        collection=detail_collection,
    ))

    # Thigh skeleton and armor
    register(add_cylinder_between(
        f"{side_name} Thigh Internal",
        hip,
        knee,
        0.38,
        MAT_DARK_STEEL,
        vertices=30,
        collection=model_collection,
    ))
    register(add_wedge(
        f"{side_name} Thigh Armor",
        (side * 1.36, -0.02, 4.05),
        (1.34, 1.42, 2.18),
        MAT_NAVY,
        rotation=radians_xyz((side * 2, side * -2, side * -1)),
        top_scale_x=0.78,
        top_scale_y=0.80,
        bevel=0.11,
        collection=model_collection,
    ))
    register(add_box(
        f"{side_name} Outer Thigh Plate",
        (side * 1.99, 0.03, 4.08),
        (0.24, 0.92, 1.56),
        MAT_BLUE,
        rotation=radians_xyz((0, side * 4, side * -1)),
        bevel=0.045,
        collection=model_collection,
    ))
    register(add_box(
        f"{side_name} Thigh Glow Strip",
        (side * 2.12, -0.18, 4.10),
        (0.045, 0.48, 1.06),
        MAT_CYAN,
        bevel=0.012,
        collection=detail_collection,
    ))

    # Knee joint and cap
    register(add_sphere(
        f"{side_name} Knee Joint",
        knee,
        0.49,
        MAT_RUBBER,
        scale=(1.0, 0.92, 1.0),
        collection=model_collection,
    ))
    register(add_cylinder(
        f"{side_name} Knee Axle",
        knee,
        0.37,
        0.52,
        MAT_STEEL,
        rotation=radians_xyz((0, 90, 0)),
        vertices=36,
        bevel=0.03,
        collection=model_collection,
    ))
    register(add_wedge(
        f"{side_name} Knee Shield",
        (side * 1.42, -0.78, 3.16),
        (0.78, 0.38, 0.92),
        MAT_BLUE,
        top_scale_x=0.62,
        top_scale_y=0.85,
        bevel=0.055,
        collection=model_collection,
    ))
    register(add_box(
        f"{side_name} Knee Light",
        (side * 1.42, -1.005, 3.21),
        (0.32, 0.040, 0.14),
        MAT_CYAN,
        bevel=0.018,
        collection=detail_collection,
    ))

    # Lower leg skeleton and armor
    register(add_cylinder_between(
        f"{side_name} Shin Internal",
        knee,
        ankle,
        0.34,
        MAT_DARK_STEEL,
        vertices=30,
        collection=model_collection,
    ))
    register(add_wedge(
        f"{side_name} Shin Armor",
        (side * 1.46, -0.12, 2.17),
        (1.27, 1.34, 2.30),
        MAT_BLUE,
        rotation=radians_xyz((side * -1, side * 2, side * 1)),
        top_scale_x=0.82,
        top_scale_y=0.72,
        bevel=0.11,
        collection=model_collection,
    ))
    register(add_box(
        f"{side_name} Shin Front Plate",
        (side * 1.46, -0.86, 2.22),
        (0.72, 0.24, 1.52),
        MAT_STEEL,
        rotation=radians_xyz((-3, 0, 0)),
        bevel=0.055,
        collection=model_collection,
    ))
    register(add_box(
        f"{side_name} Shin Energy Line",
        (side * 1.46, -1.005, 2.25),
        (0.10, 0.045, 1.05),
        MAT_CYAN,
        bevel=0.016,
        collection=detail_collection,
    ))

    # Calf block and rear vents
    register(add_wedge(
        f"{side_name} Calf Housing",
        (side * 1.47, 0.61, 2.18),
        (1.08, 0.66, 1.72),
        MAT_NAVY,
        top_scale_x=0.76,
        top_scale_y=0.66,
        bevel=0.08,
        collection=model_collection,
    ))
    for vent_index in range(3):
        register(add_box(
            f"{side_name} Calf Vent {vent_index+1}",
            (side * 1.47, 0.975, 1.78 + vent_index * 0.32),
            (0.55, 0.055, 0.12),
            MAT_BLACK,
            bevel=0.015,
            collection=detail_collection,
        ))

    # Ankle
    register(add_sphere(
        f"{side_name} Ankle Joint",
        ankle,
        0.38,
        MAT_RUBBER,
        scale=(1.0, 0.92, 1.0),
        collection=model_collection,
    ))
    register(add_torus(
        f"{side_name} Ankle Ring",
        ankle,
        0.38,
        0.045,
        MAT_CYAN,
        collection=detail_collection,
    ))

    # Foot platform
    register(add_wedge(
        f"{side_name} Foot",
        (side * 1.50, -0.30, 0.57),
        (1.28, 2.12, 0.72),
        MAT_NAVY,
        rotation=radians_xyz((-2, 0, 0)),
        top_scale_x=0.78,
        top_scale_y=0.84,
        bevel=0.10,
        collection=model_collection,
    ))
    register(add_box(
        f"{side_name} Heel",
        (side * 1.50, 0.86, 0.55),
        (0.88, 0.62, 0.78),
        MAT_DARK_STEEL,
        rotation=radians_xyz((4, 0, 0)),
        bevel=0.07,
        collection=model_collection,
    ))

    # Split toes
    for toe_index in range(3):
        toe_x = side * 1.50 + (toe_index - 1) * 0.32
        register(add_box(
            f"{side_name} Toe {toe_index+1}",
            (toe_x, -1.32, 0.40),
            (0.27, 0.70, 0.34),
            MAT_STEEL if toe_index == 1 else MAT_BLUE,
            rotation=radians_xyz((-4, 0, 0)),
            bevel=0.045,
            collection=model_collection,
        ))

    # Foot warning lights
    register(add_box(
        f"{side_name} Foot Light",
        (side * 1.50, -0.93, 0.82),
        (0.40, 0.05, 0.10),
        MAT_RED,
        bevel=0.018,
        collection=detail_collection,
    ))

    if DETAIL_LEVEL >= 2:
        # Leg pistons
        register(add_cylinder_between(
            f"{side_name} Thigh Piston A",
            (side * 1.06, 0.52, 4.74),
            (side * 1.12, 0.56, 3.38),
            0.060,
            MAT_STEEL,
            vertices=16,
            collection=detail_collection,
        ))
        register(add_cylinder_between(
            f"{side_name} Thigh Piston B",
            (side * 1.58, 0.53, 4.70),
            (side * 1.70, 0.57, 3.38),
            0.048,
            MAT_CYAN,
            vertices=14,
            collection=detail_collection,
        ))
        register(add_cylinder_between(
            f"{side_name} Calf Piston A",
            (side * 1.12, 0.48, 3.00),
            (side * 1.16, 0.56, 1.34),
            0.052,
            MAT_STEEL,
            vertices=16,
            collection=detail_collection,
        ))
        register(add_cylinder_between(
            f"{side_name} Calf Piston B",
            (side * 1.76, 0.48, 3.00),
            (side * 1.82, 0.56, 1.34),
            0.044,
            MAT_CYAN,
            vertices=14,
            collection=detail_collection,
        ))

# ---------------------------------------------------------------------------
# EXTRA SURFACE DETAIL
# ---------------------------------------------------------------------------

if DETAIL_LEVEL >= 2:
    # Chest bolt rows
    add_panel_bolts(
        "Chest Upper Bolts",
        (0.0, -1.345, 8.72),
        9,
        0.46,
        0.034,
        MAT_STEEL,
        axis="X",
        collection=detail_collection,
    )
    add_panel_bolts(
        "Pelvis Bolts",
        (0.0, -1.075, 5.43),
        7,
        0.33,
        0.032,
        MAT_STEEL,
        axis="X",
        collection=detail_collection,
    )

    # Rear spine access plates
    for plate_index, z in enumerate((6.58, 6.92, 7.26)):
        register(add_box(
            f"Rear Spine Access Plate {plate_index+1}",
            (0.0, 1.34, z),
            (0.56, 0.08, 0.20),
            MAT_STEEL if plate_index == 1 else MAT_DARK_STEEL,
            bevel=0.025,
            collection=detail_collection,
        ))

    # Small warning lamps around torso
    for x in (-1.95, 1.95):
        register(add_box(
            f"Torso Warning Lamp {x}",
            (x, -1.235, 7.05),
            (0.15, 0.045, 0.08),
            MAT_RED,
            bevel=0.015,
            collection=detail_collection,
        ))

# Ensure all detail objects are parented to root
for obj in list(detail_collection.objects):
    if obj.parent is None:
        obj.parent = root

# ---------------------------------------------------------------------------
# FLOOR, CAMERA AND LIGHTING
# ---------------------------------------------------------------------------

# Ground
ground = add_box(
    "Ground",
    (0.0, 0.0, -0.18),
    (40.0, 40.0, 0.25),
    MAT_FLOOR,
    bevel=0.08,
    collection=environment_collection,
)

# Circular platform
platform = add_cylinder(
    "Display Platform",
    (0.0, 0.0, -0.01),
    5.75,
    0.28,
    MAT_DARK_STEEL,
    vertices=96,
    bevel=0.08,
    collection=environment_collection,
)
platform_top = add_cylinder(
    "Display Platform Top",
    (0.0, 0.0, 0.13),
    5.35,
    0.06,
    MAT_BLACK,
    vertices=96,
    bevel=0.025,
    collection=environment_collection,
)

# Platform emission rings
add_torus(
    "Platform Cyan Ring",
    (0.0, 0.0, 0.18),
    4.62,
    0.045,
    MAT_CYAN,
    collection=environment_collection,
)
add_torus(
    "Platform Inner Ring",
    (0.0, 0.0, 0.18),
    3.80,
    0.022,
    MAT_CYAN,
    collection=environment_collection,
)

# Camera
camera_data = bpy.data.cameras.new("Hero Camera")
camera = bpy.data.objects.new("Hero Camera", camera_data)
environment_collection.objects.link(camera)
scene.camera = camera
camera.location = (15.8, -23.8, 11.8)
camera.data.lens = 58
camera.data.sensor_width = 36
look_at(camera, (0.0, 0.0, 5.25))

# Lights
def add_area_light(name, location, energy, size, color, target):
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = size
    light_data.color = color
    light = bpy.data.objects.new(name=name, object_data=light_data)
    environment_collection.objects.link(light)
    light.location = location
    look_at(light, target)
    return light


def add_point_light(name, location, energy, color, radius):
    light_data = bpy.data.lights.new(name=name, type="POINT")
    light_data.energy = energy
    light_data.color = color
    light_data.shadow_soft_size = radius
    light = bpy.data.objects.new(name=name, object_data=light_data)
    environment_collection.objects.link(light)
    light.location = location
    return light


add_area_light(
    "Key Light",
    (8.0, -10.0, 16.0),
    1800,
    7.0,
    (0.62, 0.78, 1.0),
    (0.0, 0.0, 5.2),
)
add_area_light(
    "Fill Light",
    (-9.0, -5.0, 9.0),
    1000,
    6.0,
    (0.18, 0.38, 0.65),
    (0.0, 0.0, 5.0),
)
add_area_light(
    "Rim Light",
    (4.5, 8.0, 14.5),
    2200,
    5.0,
    (0.05, 0.60, 1.0),
    (0.0, 0.5, 6.0),
)
add_area_light(
    "Warm Accent",
    (-6.5, 2.0, 6.5),
    850,
    4.0,
    (1.0, 0.20, 0.04),
    (0.0, 0.0, 4.5),
)
add_point_light(
    "Platform Glow",
    (0.0, -1.5, 1.0),
    500,
    (0.0, 0.45, 1.0),
    2.4,
)

# ---------------------------------------------------------------------------
# COMPOSITOR
# ---------------------------------------------------------------------------

scene.use_nodes = True
node_tree = scene.node_tree
node_tree.nodes.clear()

render_layers = node_tree.nodes.new(type="CompositorNodeRLayers")
glare = node_tree.nodes.new(type="CompositorNodeGlare")
glare.glare_type = "FOG_GLOW"
glare.quality = "HIGH"
glare.threshold = 0.75
glare.size = 7

composite = node_tree.nodes.new(type="CompositorNodeComposite")
node_tree.links.new(render_layers.outputs["Image"], glare.inputs["Image"])
node_tree.links.new(glare.outputs["Image"], composite.inputs["Image"])

# ---------------------------------------------------------------------------
# FINAL ORGANISATION AND OUTPUT
# ---------------------------------------------------------------------------

# Select the model root when the script finishes.
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
bpy.context.view_layer.objects.active = root

# Save and render.
if AUTO_SAVE_BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath(OUTPUT_BLEND))


def render_named_view(view_name, camera_location, target=(0.0, 0.0, 5.25), lens=58):
    camera.location = camera_location
    camera.data.lens = lens
    look_at(camera, target)
    scene.render.filepath = f"//striker_eureka_{view_name}.png"
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {view_name}: {bpy.path.abspath(scene.render.filepath)}")


if AUTO_RENDER:
    if RENDER_TURNTABLE_VIEWS:
        render_named_view("front_three_quarter", (15.8, -23.8, 11.8))
        render_named_view("rear_three_quarter", (-15.5, 23.0, 11.4))
        render_named_view("front", (0.0, -28.5, 7.4), lens=62)
        render_named_view("rear", (0.0, 28.5, 7.4), lens=62)
        render_named_view("left_side", (-28.5, 0.0, 7.4), lens=62)
    else:
        scene.render.filepath = OUTPUT_IMAGE
        bpy.ops.render.render(write_still=True)

print("=" * 72)
print("REFERENCE-DRIVEN STRIKER EUREKA MODEL COMPLETE")
print(f"Objects in model collection: {len(model_collection.objects)}")
print(f"Objects in detail collection: {len(detail_collection.objects)}")
print("Turntable renders use the //striker_eureka_<view>.png naming pattern.")
print("=" * 72)
