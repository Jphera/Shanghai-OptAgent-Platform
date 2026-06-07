"""Build Shanghai building-level and 500 m energy evidence for the platform."""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path
from typing import Any

import pandas as pd

import build_microclimate_platform_data as micro


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "energy-platform-data.json"
SHARD_DIR = ROOT / "data" / "energy-building-shards"
MAPBOX_OUT = ROOT / "mapbox_studio_upload" / "10_shanghai_energy_500m_summary.geojson"
PLATFORM_DATA = micro.PLATFORM_DATA
ENERGY_DIR = micro.ENERGY_DIR

SHARD_COUNT = 24

SEASONS = {
    "cooling": {
        "label": "Summer representative week",
        "short": "Summer",
        "file": ENERGY_DIR / "SH_summer_TMY_energy_cop_EUI_from_feather.xlsx",
        "percent_col": "sh_summer_percent",
    },
    "transition": {
        "label": "Spring representative week",
        "short": "Spring",
        "file": ENERGY_DIR / "SH_spring_TMY_energy_cop_EUI.xlsx",
        "percent_col": "sh_spring_percent",
    },
    "heating": {
        "label": "Winter representative week",
        "short": "Winter",
        "file": ENERGY_DIR / "SH_winter_TMY_energy_cop_EUI.xlsx",
        "percent_col": "sh_percent_winter",
    },
}

BUILDING_COLUMNS = [
    "bldg_id",
    "grid_id",
    "type_code",
    "age",
    "height_m",
    "floors",
    "footprint_m2",
    "floor_area_m2",
    "cooling_tmy_kwh",
    "cooling_wrf_kwh",
    "cooling_diff_pct",
    "transition_tmy_kwh",
    "transition_wrf_kwh",
    "transition_diff_pct",
    "heating_tmy_kwh",
    "heating_wrf_kwh",
    "heating_diff_pct",
]


def json_value(value: Any, ndigits: int | None = 3) -> Any:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        if ndigits is None:
            return value
        return round(value, ndigits)
    if hasattr(value, "item"):
        return json_value(value.item(), ndigits)
    return value


def round_series(series: pd.Series, ndigits: int) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").round(ndigits)


def load_opportunity_features() -> dict[int, dict]:
    with PLATFORM_DATA.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return {
        int(feature["properties"]["grid_id"]): feature
        for feature in data["opportunityGeojson"]["features"]
    }


def read_season_frame(season: str, meta: dict) -> pd.DataFrame:
    needed = {
        "TARGET_FID",
        "OID_",
        "grid_label",
        "type",
        "age",
        "height",
        "floors",
        "floor_area_m2",
        "Shape_Area",
        "area",
        "total_energy_kwh",
        "total_energy_kwh.1",
        meta["percent_col"],
    }
    frame = pd.read_excel(meta["file"], usecols=lambda col: col in needed)
    frame["bldg_id"] = pd.to_numeric(frame["TARGET_FID"], errors="coerce").astype("Int64") + 1
    frame = frame[frame["bldg_id"].notna()].copy()
    frame["bldg_id"] = frame["bldg_id"].astype("int64")
    frame = frame.drop_duplicates("bldg_id", keep="first")
    if "grid_label" in frame.columns:
        frame["grid_id"] = pd.to_numeric(frame["grid_label"], errors="coerce").astype("Int64")

    prefix = season
    out = pd.DataFrame({"bldg_id": frame["bldg_id"].astype("int64")})
    out[f"{prefix}_tmy_kwh"] = pd.to_numeric(frame["total_energy_kwh"], errors="coerce")
    out[f"{prefix}_wrf_kwh"] = pd.to_numeric(frame["total_energy_kwh.1"], errors="coerce")
    out[f"{prefix}_diff_pct"] = pd.to_numeric(frame[meta["percent_col"]], errors="coerce") * 100

    if season == "cooling":
        footprint = pd.to_numeric(frame.get("Shape_Area"), errors="coerce")
        if footprint.isna().all() and "area" in frame.columns:
            footprint = pd.to_numeric(frame["area"], errors="coerce")
        floor_area = pd.to_numeric(frame.get("floor_area_m2"), errors="coerce")
        floors = pd.to_numeric(frame.get("floors"), errors="coerce")
        floor_area = floor_area.where(floor_area.notna(), footprint * floors)
        base = pd.DataFrame(
            {
                "bldg_id": frame["bldg_id"].astype("Int64"),
                "grid_id": frame["grid_id"].astype("Int64"),
                "type": frame["type"],
                "age": pd.to_numeric(frame["age"], errors="coerce"),
                "height_m": pd.to_numeric(frame["height"], errors="coerce"),
                "floors": floors,
                "footprint_m2": footprint,
                "floor_area_m2": floor_area,
            }
        )
        return pd.concat([base, out.drop(columns=["bldg_id"])], axis=1)
    return out


def build_energy_frame() -> tuple[pd.DataFrame, list[str]]:
    frames = {}
    for season, meta in SEASONS.items():
        print(f"Reading {meta['file'].name}")
        frames[season] = read_season_frame(season, meta)

    energy = frames["cooling"]
    for season in ("transition", "heating"):
        energy = energy.merge(frames[season], on="bldg_id", how="left")

    type_labels = sorted(str(v) for v in energy["type"].dropna().unique())
    type_codes = {label: index for index, label in enumerate(type_labels)}
    energy["type_code"] = energy["type"].map(lambda value: type_codes.get(str(value)) if pd.notna(value) else None)

    for col in ["age", "height_m", "floors"]:
        energy[col] = round_series(energy[col], 0)
    for col in ["footprint_m2", "floor_area_m2"]:
        energy[col] = round_series(energy[col], 1)
    for season in SEASONS:
        energy[f"{season}_tmy_kwh"] = round_series(energy[f"{season}_tmy_kwh"], 1)
        energy[f"{season}_wrf_kwh"] = round_series(energy[f"{season}_wrf_kwh"], 1)
        energy[f"{season}_diff_pct"] = round_series(energy[f"{season}_diff_pct"], 2)
    return energy, type_labels


def aggregate_grid_energy(energy: pd.DataFrame) -> pd.DataFrame:
    agg = energy.groupby("grid_id", dropna=True).agg(
        energy_building_count=("bldg_id", "count"),
        energy_floor_area_m2=("floor_area_m2", "sum"),
        mean_height_m=("height_m", "mean"),
        mean_age=("age", "mean"),
    )
    for season in SEASONS:
        grouped = energy.groupby("grid_id", dropna=True)
        tmy = grouped[f"{season}_tmy_kwh"].sum(min_count=1)
        wrf = grouped[f"{season}_wrf_kwh"].sum(min_count=1)
        agg[f"{season}_tmy_kwh"] = tmy
        agg[f"{season}_wrf_kwh"] = wrf
        agg[f"{season}_delta_kwh"] = wrf - tmy
        agg[f"{season}_diff_pct"] = ((wrf - tmy) / tmy.replace({0: pd.NA})) * 100
        agg[f"{season}_diff_pct_mean"] = grouped[f"{season}_diff_pct"].mean()
        agg[f"{season}_tmy_eui_kwh_m2"] = tmy / agg["energy_floor_area_m2"].replace({0: pd.NA})
        agg[f"{season}_wrf_eui_kwh_m2"] = wrf / agg["energy_floor_area_m2"].replace({0: pd.NA})
    agg = agg.reset_index()
    numeric_cols = [col for col in agg.columns if col != "grid_id"]
    agg[numeric_cols] = agg[numeric_cols].apply(pd.to_numeric, errors="coerce").round(3)
    return agg


def build_grid_geojson(opportunities: dict[int, dict], grid_energy: pd.DataFrame) -> dict:
    grid_lookup = {
        int(row["grid_id"]): {key: json_value(value, 3) for key, value in row.items()}
        for row in grid_energy.to_dict(orient="records")
        if pd.notna(row.get("grid_id"))
    }
    features = []
    for grid_id, feature in opportunities.items():
        if grid_id not in grid_lookup:
            continue
        props = {
            "grid_id": grid_id,
            "n_buildings": feature["properties"].get("n_buildings"),
            "LCZ_label": feature["properties"].get("LCZ_label"),
            "baseline_eui_kwh_m2": feature["properties"].get("baseline_eui_kwh_m2"),
        }
        props.update(grid_lookup[grid_id])
        features.append({"type": "Feature", "geometry": feature["geometry"], "properties": props})
    return {"type": "FeatureCollection", "features": features}


def build_summary_by_type(energy: pd.DataFrame, type_labels: list[str]) -> list[dict]:
    rows = []
    for type_code, type_label in enumerate(type_labels):
        subset = energy[energy["type_code"] == type_code]
        row = {
            "type_code": type_code,
            "type_label": type_label,
            "building_count": int(subset["bldg_id"].count()),
            "floor_area_m2": json_value(subset["floor_area_m2"].sum(), 1),
        }
        for season in SEASONS:
            tmy = subset[f"{season}_tmy_kwh"].sum()
            wrf = subset[f"{season}_wrf_kwh"].sum()
            row[f"{season}_tmy_kwh"] = json_value(tmy, 1)
            row[f"{season}_wrf_kwh"] = json_value(wrf, 1)
            row[f"{season}_diff_pct"] = json_value(((wrf - tmy) / tmy) * 100 if tmy else None, 2)
        rows.append(row)
    return sorted(rows, key=lambda item: item["building_count"], reverse=True)


def write_building_shards(energy: pd.DataFrame) -> dict:
    if SHARD_DIR.exists():
        shutil.rmtree(SHARD_DIR)
    SHARD_DIR.mkdir(parents=True, exist_ok=True)

    min_size = None
    max_size = 0
    total_size = 0
    for shard in range(SHARD_COUNT):
        subset = energy[energy["bldg_id"].astype("int64") % SHARD_COUNT == shard]
        rows = []
        for values in subset[BUILDING_COLUMNS].itertuples(index=False, name=None):
            rows.append([json_value(value, 2) for value in values])
        payload = {"columns": BUILDING_COLUMNS, "rows": rows}
        path = SHARD_DIR / f"energy-buildings-{shard:02d}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        size = path.stat().st_size
        min_size = size if min_size is None else min(min_size, size)
        max_size = max(max_size, size)
        total_size += size
    return {
        "count": SHARD_COUNT,
        "urlPattern": "./data/energy-building-shards/energy-buildings-{shard}.json",
        "totalBytes": total_size,
        "minBytes": min_size or 0,
        "maxBytes": max_size,
    }


def main() -> None:
    opportunities = load_opportunity_features()
    energy, type_labels = build_energy_frame()
    grid_energy = aggregate_grid_energy(energy)
    grid_geojson = build_grid_geojson(opportunities, grid_energy)
    shard_meta = write_building_shards(energy)

    payload = {
        "metadata": {
            "generated_by": "scripts/build_energy_platform_data.py",
            "building_count": int(energy["bldg_id"].count()),
            "grid_count": len(grid_geojson["features"]),
            "source_note": "Per-building representative-week TMY and microclimate/WRF energy from Shanghai energy analysis workbooks. Building ids map to Mapbox objectid/bldg_id by TARGET_FID + 1.",
        },
        "seasons": {
            key: {"label": value["label"], "short": value["short"]}
            for key, value in SEASONS.items()
        },
        "metrics": {
            "diff_pct": "Percent difference: (WRF microclimate week - TMY week) / TMY week * 100",
            "tmy_kwh": "Representative-week TMY total energy",
            "wrf_kwh": "Representative-week microclimate/WRF total energy",
            "delta_kwh": "WRF microclimate week minus TMY week",
        },
        "typeLabels": type_labels,
        "buildingShards": shard_meta,
        "summaryByType": build_summary_by_type(energy, type_labels),
        "energyGridGeojson": grid_geojson,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    MAPBOX_OUT.parent.mkdir(parents=True, exist_ok=True)
    MAPBOX_OUT.write_text(
        json.dumps(grid_geojson, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"Wrote {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MB)")
    print(f"Wrote {MAPBOX_OUT} ({MAPBOX_OUT.stat().st_size / 1024 / 1024:.2f} MB)")
    print(
        "Wrote shards "
        f"{SHARD_DIR} ({shard_meta['totalBytes'] / 1024 / 1024:.2f} MB total, "
        f"max {shard_meta['maxBytes'] / 1024 / 1024:.2f} MB)"
    )


if __name__ == "__main__":
    main()
