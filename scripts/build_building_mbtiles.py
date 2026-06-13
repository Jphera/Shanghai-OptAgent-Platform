import gzip
import json
import math
import sqlite3
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
VENDOR = REPO_ROOT / ".vendor"
if VENDOR.exists():
    sys.path.insert(0, str(VENDOR))

import mapbox_vector_tile
import mercantile
from shapely.geometry import shape


SOURCE_PATH = REPO_ROOT / "mapbox_sources" / "shanghai_buildings_footprints.ldgeojson"
OUT_DIR = REPO_ROOT / "mapbox_mbtiles"
OUT_PATH = OUT_DIR / "shanghai_buildings_footprints.mbtiles"
MIN_ZOOM = 12
MAX_ZOOM = 15
LAYER_NAME = "shanghai_buildings"
EXTENT = 4096


def tile_xyz_from_lonlat(lon, lat, z):
    lat = max(min(lat, 85.05112878), -85.05112878)
    n = 2**z
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def tms_y(z, y):
    return (2**z - 1) - y


def tile_bounds(z, x, y):
    bounds = mercantile.bounds(x, y, z)
    return (bounds.west, bounds.south, bounds.east, bounds.north)


def init_mbtiles(conn, metadata):
    conn.executescript(
        """
        PRAGMA synchronous=OFF;
        PRAGMA journal_mode=MEMORY;
        CREATE TABLE metadata (name text, value text);
        CREATE TABLE tiles (
            zoom_level integer,
            tile_column integer,
            tile_row integer,
            tile_data blob
        );
        CREATE UNIQUE INDEX tile_index on tiles (zoom_level, tile_column, tile_row);
        """
    )
    conn.executemany("INSERT INTO metadata (name, value) VALUES (?, ?)", metadata.items())
    conn.commit()


def build_tile_index():
    tiles = {}
    bounds = [180.0, 90.0, -180.0, -90.0]
    feature_count = 0

    with SOURCE_PATH.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            feature = json.loads(line)
            props = feature.get("properties", {})
            lon = props.get("center_lon")
            lat = props.get("center_lat")
            if lon is None or lat is None:
                continue

            geometry = shape(feature["geometry"])
            compact_props = {
                key: value
                for key, value in props.items()
                if key
                in {
                    "bldg_id",
                    "grid_id",
                    "height_m",
                    "footprint_m2",
                    "coarse_function",
                    "fine_function",
                    "age_bin",
                    "thermal_template",
                    "llm_confidence",
                    "center_lon",
                    "center_lat",
                }
                and value is not None
            }
            encoded_feature = {"geometry": geometry, "properties": compact_props, "id": props.get("bldg_id")}

            for z in range(MIN_ZOOM, MAX_ZOOM + 1):
                x, y = tile_xyz_from_lonlat(float(lon), float(lat), z)
                tiles.setdefault((z, x, y), []).append(encoded_feature)

            minx, miny, maxx, maxy = geometry.bounds
            bounds[0] = min(bounds[0], minx)
            bounds[1] = min(bounds[1], miny)
            bounds[2] = max(bounds[2], maxx)
            bounds[3] = max(bounds[3], maxy)
            feature_count += 1
            if feature_count % 50000 == 0:
                print(f"indexed {feature_count:,} features; tiles={len(tiles):,}", flush=True)

    return tiles, bounds, feature_count


def encode_tile(features, z, x, y):
    payload = mapbox_vector_tile.encode(
        [{"name": LAYER_NAME, "features": features}],
        default_options={
            "quantize_bounds": tile_bounds(z, x, y),
            "extents": EXTENT,
            "on_invalid_geometry": mapbox_vector_tile.encoder.on_invalid_geometry_make_valid,
        },
    )
    return gzip.compress(payload)


def main():
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(SOURCE_PATH)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUT_PATH.exists():
        OUT_PATH.unlink()

    start = time.time()
    tiles, bounds, feature_count = build_tile_index()
    print(f"encoding {len(tiles):,} tiles", flush=True)

    vector_layers = [
        {
            "id": LAYER_NAME,
            "description": "Shanghai building footprints with LLM-refined semantics",
            "minzoom": MIN_ZOOM,
            "maxzoom": MAX_ZOOM,
            "fields": {
                "bldg_id": "Number",
                "grid_id": "Number",
                "height_m": "Number",
                "footprint_m2": "Number",
                "coarse_function": "String",
                "fine_function": "String",
                "age_bin": "String",
                "thermal_template": "String",
                "llm_confidence": "Number",
                "center_lon": "Number",
                "center_lat": "Number",
            },
        }
    ]
    metadata = {
        "name": "Shanghai building footprints",
        "description": "592,795 Shanghai building footprints for OptAgent platform",
        "version": "1",
        "type": "overlay",
        "format": "pbf",
        "scheme": "tms",
        "minzoom": str(MIN_ZOOM),
        "maxzoom": str(MAX_ZOOM),
        "bounds": ",".join(str(round(value, 7)) for value in bounds),
        "center": "121.4737,31.2304,10",
        "json": json.dumps({"vector_layers": vector_layers}, ensure_ascii=False),
        "attribution": "Shanghai OptAgent research data",
    }

    conn = sqlite3.connect(OUT_PATH)
    init_mbtiles(conn, metadata)

    rows = []
    for index, ((z, x, y), features) in enumerate(sorted(tiles.items()), start=1):
        tile_data = encode_tile(features, z, x, y)
        rows.append((z, x, tms_y(z, y), sqlite3.Binary(tile_data)))
        if len(rows) >= 1000:
            conn.executemany(
                "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
                rows,
            )
            conn.commit()
            rows.clear()
        if index % 2000 == 0:
            print(f"encoded {index:,}/{len(tiles):,} tiles", flush=True)

    if rows:
        conn.executemany(
            "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
            rows,
        )
        conn.commit()
    conn.execute("VACUUM")
    conn.close()

    manifest = {
        "mbtiles": str(OUT_PATH),
        "size_mb": round(OUT_PATH.stat().st_size / 1024 / 1024, 2),
        "layer_name": LAYER_NAME,
        "feature_count": feature_count,
        "tile_count": len(tiles),
        "minzoom": MIN_ZOOM,
        "maxzoom": MAX_ZOOM,
        "bounds_wgs84": bounds,
        "elapsed_sec": round(time.time() - start, 2),
    }
    (OUT_DIR / "shanghai_buildings_footprints_mbtiles_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
