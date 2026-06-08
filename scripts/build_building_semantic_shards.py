from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"F:\博士文件\石老师课题组\6.AI-agent-LLM\data\shanghai_all_jpy_with_llm_attrs.csv")
OUT_DIR = ROOT / "data" / "building-semantic-shards"
MANIFEST = ROOT / "data" / "building-semantic-index.json"
SHARD_COUNT = 24

COLUMNS = [
    "bldg_id",
    "grid_id",
    "coarse_function",
    "fine_function",
    "building_name",
    "age_bin",
    "thermal_template",
    "llm_confidence",
]


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def clean_int(value: str | None) -> int | None:
    value = clean_text(value)
    if value is None:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def clean_float(value: str | None) -> float | None:
    value = clean_text(value)
    if value is None:
        return None
    try:
        return round(float(value), 4)
    except ValueError:
        return None


def semantic_row(row: dict[str, str]) -> list[object | None] | None:
    bldg_id = clean_int(row.get("OID_"))
    if bldg_id is None:
        target = clean_int(row.get("TARGET_FID"))
        bldg_id = target + 1 if target is not None else None
    if bldg_id is None:
        return None

    grid_id = clean_int(row.get("grid_label")) or clean_int(row.get("grid_shade"))
    return [
        bldg_id,
        grid_id,
        clean_text(row.get("Coarse_Function") or row.get("type")),
        clean_text(row.get("Fine_Function") or row.get("Building_Name")),
        clean_text(row.get("Building_Name")),
        clean_text(row.get("Final_Age_Bin") or row.get("age")),
        clean_text(row.get("Thermal_Template")),
        clean_float(row.get("Confidence")),
    ]


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    shards: list[list[list[object | None]]] = [[] for _ in range(SHARD_COUNT)]
    records = 0

    with SOURCE.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            payload = semantic_row(row)
            if payload is None:
                continue
            bldg_id = int(payload[0])
            shards[bldg_id % SHARD_COUNT].append(payload)
            records += 1

    sizes = []
    for index, rows in enumerate(shards):
        path = OUT_DIR / f"building-semantic-{index:02d}.json"
        payload = {"columns": COLUMNS, "rows": rows}
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        sizes.append(path.stat().st_size)

    manifest = {
        "metadata": {
            "generated_by": "scripts/build_building_semantic_shards.py",
            "source": SOURCE.name,
            "record_count": records,
            "source_note": "POI-LLM refined building semantics keyed by OID_/bldg_id. Loaded on demand for clicked Mapbox building features.",
        },
        "columns": COLUMNS,
        "shards": {
            "count": SHARD_COUNT,
            "urlPattern": "./data/building-semantic-shards/building-semantic-{shard}.json",
            "totalBytes": sum(sizes),
            "minBytes": min(sizes) if sizes else 0,
            "maxBytes": max(sizes) if sizes else 0,
        },
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {records:,} semantic records to {SHARD_COUNT} shards")
    print(f"Total bytes: {sum(sizes):,}")


if __name__ == "__main__":
    main()
