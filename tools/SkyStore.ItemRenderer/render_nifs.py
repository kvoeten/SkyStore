import argparse
import json
import math
import os
import sys
import traceback


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", required=True)
    parser.add_argument("--pynifly", required=True)
    return parser.parse_args(argv)


def install_pynifly(addon_path, texture_root):
    import bpy

    addon_parent = os.path.dirname(os.path.abspath(addon_path))
    if addon_parent not in sys.path:
        sys.path.insert(0, addon_parent)
    bpy.ops.preferences.addon_enable(module="io_scene_nifly")
    preferences = bpy.context.preferences.addons["io_scene_nifly"].preferences
    preferences.sky_texture_path_1 = os.path.join(texture_root, "textures") + os.sep


def clear_scene():
    import bpy

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def world_bounds(objects):
    from mathutils import Vector

    points = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    if not points:
        raise RuntimeError("Imported NIF contains no renderable mesh bounds")
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def point_at(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_render(objects, output_path):
    import bpy
    from mathutils import Vector

    scene = bpy.context.scene
    minimum, maximum = world_bounds(objects)
    center = (minimum + maximum) * 0.5
    extent = maximum - minimum
    size = max(extent.x, extent.y, extent.z, 0.01)

    camera_data = bpy.data.cameras.new("SkyStore Camera")
    camera = bpy.data.objects.new("SkyStore Camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = size * 1.35
    camera.location = center + Vector((size * 1.8, -size * 2.2, size * 1.45))
    point_at(camera, center)

    for name, energy, location, size_factor in (
        ("Key", 1100.0, (1.8, -2.2, 2.7), 3.0),
        ("Fill", 650.0, (-2.4, -0.4, 1.2), 2.5),
        ("Rim", 900.0, (0.2, 2.2, 2.3), 2.0),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size * size_factor
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = center + Vector(tuple(component * size for component in location))
        point_at(light, center)

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.filepath = output_path
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.resolution_percentage = 100
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.render.render(write_still=True)


def render_item(item):
    import bpy

    clear_scene()
    result = bpy.ops.import_scene.pynifly(
        filepath=item["modelFile"],
        import_animations=False,
        import_collisions=False,
        import_tris=False,
        import_shapekeys=False,
        mesh_only=False,
        create_bones=False,
        create_collection=False,
        blender_xf=True,
    )
    if "FINISHED" not in result:
        raise RuntimeError("PyNifly did not finish importing the model")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and not obj.hide_render]
    loaded_images = sorted({os.path.abspath(image.filepath) for image in bpy.data.images if image.filepath})
    print("SKYSTORE_TEXTURES", item["target"]["stableKey"], json.dumps(loaded_images), flush=True)
    setup_render(meshes, item["outputPath"])


def main():
    args = parse_args()
    with open(args.batch, "r", encoding="utf-8") as stream:
        batch = json.load(stream)
    install_pynifly(args.pynifly, batch["assetRoot"])
    failures = []
    for item in batch["items"]:
        try:
            render_item(item)
            print("SKYSTORE_RENDERED", item["target"]["stableKey"], flush=True)
        except Exception as exception:
            failures.append(item["target"]["stableKey"])
            print("SKYSTORE_RENDER_FAILED", item["target"]["stableKey"], str(exception), flush=True)
            traceback.print_exc()
    if failures:
        raise RuntimeError(f"{len(failures)} item renders failed: {', '.join(failures)}")


if __name__ == "__main__":
    main()
