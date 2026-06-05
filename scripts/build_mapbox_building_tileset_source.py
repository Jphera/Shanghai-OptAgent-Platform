import ast
import json
import math
import time
from pathlib import Path

import pandas as pd
from pyproj import Transformer


SOURCE_CSV = Path(r"F:\博士文件\石老师课题组\6.AI-agent-LLM\data\shanghai_all_jpy_with_llm_attrs.csv")
REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = REPO_ROOT / "mapbox_sources"
PUBLIC_MAPBOX_DIR = REPO_ROOT / "mapbox"
SOURCE_PATH = OUT_DIR / "shanghai_buildings_footprints.ldgeojson"
MANIFEST_PATH = OUT_DIR / "shanghai_buildings_footprints_manifest.json"
SAMPLE_PATH = PUBLIC_MAPBOX_DIR / "shanghai_buildings_footprints_sample.geojson"

CHUNK_SIZE = 25000
SAMPLE_LIMIT = 250
TRANSFORMER = Transformer.from_crs("EPSG:32651", "EPSG:4326", always_xy=True)

SOURCE_COLUMNS = [
    "OID_",
    "height",
    "type",
    "age",
    "grid_label",
    "center_x",
    "center_y",
    "Shape_Area",
    "polygon",
    "Coarse_Function",
    "Fine_Function",
    "Building_Name",
    "Final_Age_Bin",
    "Thermal_Template",
    "Cooling_COP",
    "Heating_COP",
    "Confidence",
    "Reasoning",
]


def clean_string(value):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    return text


def clean_number(value, digits=None):
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    if digits is not None:
        number = round(number, digits)
    if number.is_integer():
        return int(number)
    return number


def close_ring(coords):
    if len(coords) < 3:
        return []
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return coords if len(coords) >= 4 else []


def parse_polygon(text):
    try:
        points = ast.literal_eval(text)
    except (SyntaxError, ValueError):
        return None

    ring = []
    for point in points:
        if not isinstance(point, (tuple, list)) or len(point) < 2:
            continue
        try:
            x = float(point[0])
            y = float(point[1])
        except (TypeError, ValueError):
            continue
        if not math.isfinite(x) or not math.isfinite(y):
            continue
        lon, lat = TRANSFORMER.transform(x, y)
        if not (120.0 <= lon <= 123.0 and 30.0 <= lat <= 32.5):
            continue
        ring.append([round(lon, 7), round(lat, 7)])

    ring = close_ring(ring)
    if not ring:
        return None
    return {"type": "Polygon", "coordinates": [ring]}


def feature_from_row(row):
    geometry = parse_polygon(row.get("polygon"))
    if geometry is None:
        return None

    center_lon = center_lat = None
    center_x = clean_number(row.get("center_x"))
    center_y = clean_number(row.get("center_y"))
    if center_x is not None and center_y is not None:
        center_lon, center_lat = TRANSFORMER.transform(center_x, center_y)

    props = {
        "bldg_id": clean_number(row.get("OID_")),
        "grid_id": clean_number(row.get("grid_label")),
        "height_m": clean_number(row.get("height"), 2),
        "source_type": clean_string(row.get("type")),
        "source_age": clean_number(row.get("age")),
        "footprint_m2": clean_number(row.get("Shape_Area"), 2),
        "coarse_function": clean_string(row.get("Coarse_Function")),
        "fine_function": clean_string(row.get("Fine_Function")),
        "building_name": clean_string(row.get("Building_Name")),
        "age_bin": clean_string(row.get("Final_Age_Bin")),
        "thermal_template": clean_string(row.get("Thermal_Template")),
        "cooling_cop": clean_number(row.get("Cooling_COP"), 3),
        "heating_cop": clean_number(row.get("Heating_COP"), 3),
        "llm_confidence": clean_number(row.get("Confidence"), 3),
        "semantic_reason": clean_string(row.get("Reasoning")),
        "center_lon": clean_number(center_lon, 7),
        "center_lat": clean_number(center_lat, 7),
    }
    props = {key: value for key, value in props.items() if value is not None}
    return {"type": "Feature", "id": props.get("bldg_id"), "properties": props, "geometry": geometry}


def main():
    if not SOURCE_CSV.exists():
        raise FileNotFoundError(SOURCE_CSV)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_MAPBOX_DIR.mkdir(parents=True, exist_ok=True)

    start = time.time()
    written = 0
    skipped = 0
    samples = []
    bounds = [180.0, 90.0, -180.0, -90.0]
    coarse_counts = {}
    age_counts = {}

    with SOURCE_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        for chunk_index, chunk in enumerate(
            pd.read_csv(SOURCE_CSV, usecols=SOURCE_COLUMNS, chunksize=CHUNK_SIZE, low_memory=False),
            start=1,
        ):
            for row in chunk.to_dict("records"):
                feature = feature_from_row(row)
                if feature is None:
                    skipped += 1
                    continue

                handle.write(json.dumps(feature, ensure_ascii=False, separators=(",", ":")) + "\n")
                written += 1

                props = feature["properties"]
                coarse = props.get("coarse_function", "unknown")
                age_bin = props.get("age_bin", "unknown")
                coarse_counts[coarse] = coarse_counts.get(coarse, 0) + 1
                age_counts[age_bin] = age_counts.get(age_bin, 0) + 1

                for ring in feature["geometry"]["coordinates"]:
                    for lon, lat in ring:
                        bounds[0] = min(bounds[0], lon)
                        bounds[1] = min(bounds[1], lat)
                        bounds[2] = max(bounds[2], lon)
                        bounds[3] = max(bounds[3], lat)

                if len(samples) < SAMPLE_LIMIT:
                    samples.append(feature)

            print(f"chunk {chunk_index}: written={written:,}, skipped={skipped:,}", flush=True)

    sample_collection = {"type": "FeatureCollection", "features": samples}
    SAMPLE_PATH.write_text(json.dumps(sample_collection, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    manifest = {
        "source_csv": str(SOURCE_CSV),
        "source_crs": "EPSG:32651",
        "output_crs": "EPSG:4326",
        "format": "line-delimited GeoJSON features for Mapbox Tiling Service",
        "layer_name": "shanghai_buildings",
        "feature_count": written,
        "skipped_rows": skipped,
        "bounds_wgs84": bounds,
        "properties": [
            "bldg_id",
            "grid_id",
            "height_m",
            "source_type",
            "source_age",
            "footprint_m2",
            "coarse_function",
            "fine_function",
            "building_name",
            "age_bin",
            "thermal_template",
            "cooling_cop",
            "heating_cop",
            "llm_confidence",
            "semantic_reason",
            "center_lon",
            "center_lat",
        ],
        "coarse_function_counts": dict(sorted(coarse_counts.items())),
        "age_bin_counts": dict(sorted(age_counts.items())),
        "source_file": str(SOURCE_PATH),
        "source_size_mb": round(SOURCE_PATH.stat().st_size / 1024 / 1024, 2),
        "sample_file": str(SAMPLE_PATH),
        "elapsed_sec": round(time.time() - start, 2),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {SOURCE_PATH}")
    print(f"Wrote {MANIFEST_PATH}")
    print(f"Wrote {SAMPLE_PATH}")
    print(f"Features: {written:,}; skipped: {skipped:,}; size: {manifest['source_size_mb']} MB")


if __name__ == "__main__":
    main()
