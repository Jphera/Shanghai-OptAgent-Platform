import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = REPO_ROOT / "mapbox_sources" / "shanghai_buildings_footprints.ldgeojson"
PARTS_DIR = REPO_ROOT / "mapbox_sources" / "shanghai_buildings_footprints_parts"
MANIFEST_PATH = REPO_ROOT / "mapbox_sources" / "shanghai_buildings_footprints_manifest.json"
MAX_PART_SIZE_MB = 240
MAX_PART_SIZE_BYTES = MAX_PART_SIZE_MB * 1024 * 1024


def split_source():
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(SOURCE_PATH)

    PARTS_DIR.mkdir(parents=True, exist_ok=True)
    for stale_part in PARTS_DIR.glob("*.ldgeojson"):
        stale_part.unlink()

    part_index = 1
    total_features = 0
    part_features = 0
    parts = []
    part_path = PARTS_DIR / f"shanghai_buildings_footprints_part_{part_index:02d}.ldgeojson"
    part_handle = part_path.open("wb")
    parts.append(part_path)

    with SOURCE_PATH.open("rb") as source_handle:
        for line in source_handle:
            if part_features and part_handle.tell() + len(line) > MAX_PART_SIZE_BYTES:
                part_handle.close()
                part_index += 1
                part_features = 0
                part_path = PARTS_DIR / f"shanghai_buildings_footprints_part_{part_index:02d}.ldgeojson"
                part_handle = part_path.open("wb")
                parts.append(part_path)

            part_handle.write(line)
            part_features += 1
            total_features += 1

    part_handle.close()
    return total_features, parts


def update_manifest(total_features, parts):
    manifest = {}
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    manifest.update(
        {
            "source_file": str(SOURCE_PATH),
            "source_size_mb": round(SOURCE_PATH.stat().st_size / 1024 / 1024, 2),
            "split_dir": str(PARTS_DIR),
            "split_max_part_size_mb": MAX_PART_SIZE_MB,
            "split_feature_count": total_features,
            "split_files": [
                {
                    "path": str(path),
                    "name": path.name,
                    "size_mb": round(path.stat().st_size / 1024 / 1024, 2),
                    "bytes": path.stat().st_size,
                }
                for path in parts
            ],
        }
    )
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    total_features, parts = split_source()
    update_manifest(total_features, parts)
    print(f"Split {total_features:,} features into {len(parts)} files:")
    for part in parts:
        print(f"- {part.name}: {part.stat().st_size / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
