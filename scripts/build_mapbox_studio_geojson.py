import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = REPO_ROOT / "mapbox_sources" / "shanghai_buildings_footprints.ldgeojson"
OUT_DIR = REPO_ROOT / "mapbox_studio_upload"
MAX_PART_SIZE_MB = 260
MAX_PART_SIZE_BYTES = MAX_PART_SIZE_MB * 1024 * 1024


KEEP_PROPERTIES = {
    "bldg_id": "objectid",
    "grid_id": "grid_id",
    "height_m": "height_m",
    "footprint_m2": "footprint_m2",
    "coarse_function": "building_type",
    "fine_function": "fine_function",
    "age_bin": "final_year",
    "thermal_template": "thermal_template",
    "llm_confidence": "ml_probability",
}


def trim_float(value, digits=6):
    if isinstance(value, float):
        return round(value, digits)
    return value


def trim_coordinates(value):
    if isinstance(value, list):
        if len(value) == 2 and all(isinstance(item, (int, float)) for item in value):
            return [round(float(value[0]), 6), round(float(value[1]), 6)]
        return [trim_coordinates(item) for item in value]
    return value


def compact_feature(line):
    feature = json.loads(line)
    source_props = feature.get("properties", {})
    props = {}
    for old_key, new_key in KEEP_PROPERTIES.items():
        value = source_props.get(old_key)
        if value is None:
            continue
        if isinstance(value, float):
            value = round(value, 4)
        props[new_key] = value

    geometry = feature.get("geometry")
    if geometry and "coordinates" in geometry:
        geometry = {"type": geometry.get("type"), "coordinates": trim_coordinates(geometry["coordinates"])}

    return {
        "type": "Feature",
        "id": props.get("objectid"),
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


def main():
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(SOURCE_PATH)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old_file in OUT_DIR.glob("*.geojson"):
        old_file.unlink()

    part_index = 1
    total_count = 0
    writers = []
    writer = FeatureCollectionWriter(OUT_DIR / f"shanghai_buildings_footprints_part_{part_index:02d}.geojson")
    writers.append(writer)

    with SOURCE_PATH.open("r", encoding="utf-8") as source:
        for line in source:
            if not line.strip():
                continue
            feature = compact_feature(line)
            feature_line = json.dumps(feature, ensure_ascii=False, separators=(",", ":"))
            if writer.count and writer.projected_size_with(feature_line) > MAX_PART_SIZE_BYTES:
                writer.close()
                part_index += 1
                writer = FeatureCollectionWriter(
                    OUT_DIR / f"shanghai_buildings_footprints_part_{part_index:02d}.geojson"
                )
                writers.append(writer)
            writer.write_feature(feature_line)
            total_count += 1

    writer.close()

    files = []
    for item in writers:
        files.append(
            {
                "name": item.path.name,
                "path": str(item.path),
                "features": item.count,
                "size_mb": round(item.path.stat().st_size / 1024 / 1024, 2),
            }
        )

    manifest = {
        "format": "Mapbox Studio GeoJSON FeatureCollection upload",
        "source": str(SOURCE_PATH),
        "max_part_size_mb": MAX_PART_SIZE_MB,
        "total_features": total_count,
        "files": files,
        "properties": KEEP_PROPERTIES,
        "source_layer_name_hint": "shanghai_buildings",
    }
    (OUT_DIR / "shanghai_buildings_footprints_geojson_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
