import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = REPO_ROOT / "mapbox_sources" / "shanghai_buildings_footprints.ldgeojson"
OUT_DIR = REPO_ROOT / "mapbox_studio_upload"
BASE_NAME = "11_shanghai_buildings_3d_height"
MAX_PART_SIZE_MB = 285
MAX_PART_SIZE_BYTES = MAX_PART_SIZE_MB * 1024 * 1024


def to_number(value, digits=3):
    if value in ("", None):
        return None
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return value


def first_value(props, *keys):
    for key in keys:
        value = props.get(key)
        if value not in ("", None):
            return value
    return None


def trim_coordinates(value):
    if isinstance(value, list):
        if len(value) == 2 and all(isinstance(item, (int, float)) for item in value):
            return [round(float(value[0]), 6), round(float(value[1]), 6)]
        return [trim_coordinates(item) for item in value]
    return value


def compact_feature(line):
    feature = json.loads(line)
    source_props = feature.get("properties", {})
    building_id = first_value(source_props, "bldg_id", "objectid", "OBJECTID")

    props = {
        "objectid": building_id,
        "bldg_id": building_id,
        "grid_id": first_value(source_props, "grid_id", "GRID_ID"),
        "height_m": to_number(first_value(source_props, "height_m", "height", "Height"), 2),
        "footprint_m2": to_number(first_value(source_props, "footprint_m2", "area_m2"), 2),
        "building_type": first_value(source_props, "coarse_function", "building_type"),
        "fine_function": first_value(source_props, "fine_function"),
        "thermal_template": first_value(source_props, "thermal_template"),
        "final_year": first_value(source_props, "age_bin", "final_year"),
        "ml_probability": to_number(first_value(source_props, "llm_confidence", "ml_probability"), 4),
    }
    props = {key: value for key, value in props.items() if value not in ("", None)}

    geometry = feature.get("geometry")
    if geometry and "coordinates" in geometry:
        geometry = {
            "type": geometry.get("type"),
            "coordinates": trim_coordinates(geometry["coordinates"]),
        }

    return {
        "type": "Feature",
        "id": building_id,
        "properties": props,
        "geometry": geometry,
    }


class FeatureCollectionWriter:
    def __init__(self, path):
        self.path = path
        self.handle = path.open("w", encoding="utf-8", newline="\n")
        self.handle.write('{"type":"FeatureCollection","features":[')
        self.count = 0

    def projected_size_with(self, feature_line):
        comma = 1 if self.count else 0
        closing = 2
        return self.handle.tell() + comma + len(feature_line.encode("utf-8")) + closing

    def write_feature(self, feature_line):
        if self.count:
            self.handle.write(",")
        self.handle.write(feature_line)
        self.count += 1

    def close(self):
        self.handle.write("]}")
        self.handle.close()


def open_writer(index):
    return FeatureCollectionWriter(OUT_DIR / f"{BASE_NAME}_part_{index:02d}.geojson")


def cleanup_previous_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for pattern in (f"{BASE_NAME}.geojson", f"{BASE_NAME}_part_*.geojson", f"{BASE_NAME}_manifest.json"):
        for path in OUT_DIR.glob(pattern):
            path.unlink()


def main():
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(
            f"Missing {SOURCE_PATH}. Run scripts/build_mapbox_building_tileset_source.py first."
        )

    cleanup_previous_outputs()
    writer = open_writer(1)
    writers = [writer]
    total_count = 0

    with SOURCE_PATH.open("r", encoding="utf-8") as source:
        for line in source:
            if not line.strip():
                continue
            feature = compact_feature(line)
            feature_line = json.dumps(feature, ensure_ascii=False, separators=(",", ":"))
            if writer.count and writer.projected_size_with(feature_line) > MAX_PART_SIZE_BYTES:
                writer.close()
                writer = open_writer(len(writers) + 1)
                writers.append(writer)
            writer.write_feature(feature_line)
            total_count += 1

    writer.close()

    if len(writers) == 1:
        single_path = OUT_DIR / f"{BASE_NAME}.geojson"
        writers[0].path.replace(single_path)
        writers[0].path = single_path

    files = [
        {
            "name": item.path.name,
            "path": str(item.path),
            "features": item.count,
            "size_mb": round(item.path.stat().st_size / 1024 / 1024, 2),
        }
        for item in writers
    ]
    manifest = {
        "format": "Mapbox Studio GeoJSON FeatureCollection upload",
        "purpose": "Shanghai individual building 3D height layer",
        "source": str(SOURCE_PATH),
        "max_part_size_mb": MAX_PART_SIZE_MB,
        "total_features": total_count,
        "files": files,
        "required_mapbox_fields": ["height_m", "bldg_id", "objectid", "grid_id"],
        "source_layer_name_hint": BASE_NAME,
    }
    manifest_path = OUT_DIR / f"{BASE_NAME}_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
