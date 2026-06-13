"""Build compact Shanghai microclimate evidence for the web platform.

The raw WRF and representative-week energy files are too large for a static
frontend. This script reduces them to grid-level summaries, city-level hourly
series, and small evidence tables used by the OptAgent UI and backend.
"""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import mapping

try:
    from shapely import force_2d
except ImportError:  # pragma: no cover - Shapely 1.x fallback.
    force_2d = None


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "microclimate-platform-data.json"
MAPBOX_OUT = ROOT / "mapbox_studio_upload" / "09_shanghai_microclimate_500m_summary.geojson"
PLATFORM_DATA = ROOT / "data" / "shanghai-platform-data.json"
WEATHER_TS_DIR = ROOT / "data" / "weather-timeseries"
WEATHER_TS_MANIFEST = WEATHER_TS_DIR / "manifest.json"

PAPER4 = Path(r"F:\博士文件\石老师课题组\第四篇小论文-城市能碳计算")
AI_PAPER = Path(r"F:\博士文件\石老师课题组\6.AI-agent-LLM")

LCZ_DIR = PAPER4 / "Fig.Morphology-climate-energy" / "shanghai"
ENERGY_DIR = PAPER4 / "All_enerydata_analysis" / "shanghai"
WRF_DIR = PAPER4 / "WRF模拟结果文件"
FIG_DIR = AI_PAPER / "results" / "figures_core_research"
LOCAL_GRID_GDB = ROOT / ".cache" / "Singapore.gdb"
SOURCE_GRID_GDB = (
    PAPER4
    / "新加坡各类数据"
    / "建筑几何数据"
    / "Singapore"
    / "Singapore.gdb"
)
GRID_LAYER = "sh_spring_percent"

LCZ_LABELS = {
    1: "LCZ 1 Compact high-rise",
    2: "LCZ 2 Compact mid-rise",
    3: "LCZ 3 Compact low-rise",
    4: "LCZ 4 Open high-rise",
    5: "LCZ 5 Open mid-rise",
    6: "LCZ 6 Open low-rise",
    7: "LCZ 7 Lightweight low-rise",
    8: "LCZ 8 Large low-rise",
    9: "LCZ 9 Sparsely built",
    10: "LCZ 10 Heavy industry",
}

SEASONS = {
    "cooling": {
        "label": "Summer representative week",
        "short": "Summer",
        "source": WRF_DIR / "Shanghai-summer",
        "files": {
            "temp": "sh_summer_T2.csv",
            "rh": "sh_summer_RH2.csv",
            "solar": "sh_summer_SWDOWN.csv",
            "wind": "sh_summer_w10.csv",
        },
    },
    "heating": {
        "label": "Winter representative week",
        "short": "Winter",
        "source": WRF_DIR / "Shanghai-winter",
        "files": {
            "temp": "sh_winter_t2_filled.csv",
            "rh": "sh_winter_rh2_filled.csv",
            "solar": "sh_winter_sw_filled.csv",
            "wind": "sh_winter_w10_filled.csv",
        },
    },
    "transition": {
        "label": "Spring representative week",
        "short": "Spring",
        "source": WRF_DIR / "Shanghai-spring",
        "files": {
            "temp": "sh_spring_T2.csv",
            "rh": "sh_spring_rh.csv",
            "solar": "sh_spring_sw.csv",
            "wind": "sh_spring_w10.csv",
        },
    },
}

VARIABLES = {
    "temp": {"label": "2 m air temperature", "unit": "degC", "source_unit": "K", "convert": "kelvin_to_c"},
    "rh": {"label": "Relative humidity", "unit": "%", "source_unit": "%", "convert": None},
    "solar": {"label": "Shortwave radiation", "unit": "W/m2", "source_unit": "W/m2", "convert": None},
    "wind": {"label": "10 m wind speed", "unit": "m/s", "source_unit": "m/s", "convert": None},
}


def clean_number(value, ndigits: int | None = 4):
    if pd.isna(value):
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return value
    if ndigits is None:
        return out
    return round(out, ndigits)


def records_from_frame(frame: pd.DataFrame) -> list[dict]:
    return [
        {str(k): clean_number(v) for k, v in row.items()}
        for row in frame.replace({pd.NA: None}).to_dict(orient="records")
    ]


def load_opportunity_features() -> dict[int, dict]:
    with PLATFORM_DATA.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    features = data["opportunityGeojson"]["features"]
    return {int(feature["properties"]["grid_id"]): feature for feature in features}


def lcz_label(value) -> str | None:
    try:
        code = int(float(value))
    except (TypeError, ValueError):
        return None
    return LCZ_LABELS.get(code, f"LCZ {code}")


def load_lcz_sensitivity() -> tuple[dict[int, dict], list[dict], list[dict]]:
    grid = pd.read_csv(LCZ_DIR / "LCZ_sensitivity_grid_level.csv")
    per_grid: dict[int, dict] = {}
    for _, row in grid.iterrows():
        grid_id = int(row["TARGET_FID"])
        season = str(row["Season"]).lower()
        mode = clean_number(row.get("LCZ_mode"), 0)
        item = per_grid.setdefault(
            grid_id,
            {
                "grid_id": grid_id,
                "LCZ_mode": mode,
                "LCZ_label": lcz_label(mode),
                "LCZ_purity": clean_number(row.get("LCZ_purity"), 2),
            },
        )
        item[f"sensitivity_{season}_pct"] = clean_number(row.get("S_g"), 3)
        item[f"energy_percent_{season}"] = clean_number(row.get("Energy_Percent"), 5)

    summary = pd.read_csv(LCZ_DIR / "LCZ_sensitivity_weighted_summary.csv")
    summary = summary.sort_values(["Season", "S_Mean_Weighted"], ascending=[True, False])
    summary_rows = records_from_frame(summary)

    lisa = pd.read_csv(LCZ_DIR / "LISA_summary.csv")
    lisa_rows = records_from_frame(lisa)
    return per_grid, summary_rows, lisa_rows


def grid_geometry_path() -> Path:
    if LOCAL_GRID_GDB.exists():
        return LOCAL_GRID_GDB
    return SOURCE_GRID_GDB


def load_wrf_grid_geometries() -> dict[int, dict]:
    path = grid_geometry_path()
    gdf = gpd.read_file(path, layer=GRID_LAYER)
    id_column = "TARGET_FID" if "TARGET_FID" in gdf.columns else "TARGET_FID_1"
    gdf = gdf[[id_column, "geometry"]].rename(columns={id_column: "grid_id"}).dropna(subset=["geometry"])
    gdf["grid_id"] = gdf["grid_id"].astype(int)
    if force_2d is not None:
        gdf["geometry"] = gdf.geometry.apply(force_2d)
    gdf = gdf.to_crs(4326)
    return {int(row.grid_id): mapping(row.geometry) for row in gdf.itertuples(index=False)}


def read_wrf_variable(path: Path, variable: str) -> tuple[pd.DataFrame, list[str]]:
    frame = pd.read_csv(path)
    time_cols = [col for col in frame.columns if col not in {"OBJECTID", "TARGET_FID"}]
    values = frame[time_cols].apply(pd.to_numeric, errors="coerce")
    if VARIABLES[variable].get("convert") == "kelvin_to_c":
        values = values - 273.15
    if variable == "rh":
        values = values.clip(lower=0, upper=100)
    elif variable == "solar":
        values = values.mask(values < 0)
    elif variable == "wind":
        values = values.mask((values < 0) | (values > 20))
    values.insert(0, "grid_id", frame["TARGET_FID"].astype(int))
    return values, time_cols


def write_weather_timeseries(values: pd.DataFrame, time_cols: list[str], season: str, variable: str) -> dict:
    WEATHER_TS_DIR.mkdir(parents=True, exist_ok=True)
    ordered = values.sort_values("grid_id").reset_index(drop=True)
    grid_ids = ordered["grid_id"].astype(int).tolist()
    matrix = ordered[time_cols].to_numpy(dtype=np.float32)
    finite = np.isfinite(matrix)
    min_value = float(np.nanmin(matrix)) if finite.any() else 0.0
    max_value = float(np.nanmax(matrix)) if finite.any() else min_value + 1.0
    scale = (max_value - min_value) / 65534 if max_value > min_value else 1.0

    encoded = np.full(matrix.shape, 65535, dtype=np.uint16)
    encoded[finite] = np.clip(np.rint((matrix[finite] - min_value) / scale), 0, 65534).astype(np.uint16)

    filename = f"{season}_{variable}.u16"
    out_path = WEATHER_TS_DIR / filename
    encoded.tofile(out_path)
    return {
        "file": f"./data/weather-timeseries/{filename}",
        "season": season,
        "variable": variable,
        "shape": [int(encoded.shape[0]), int(encoded.shape[1])],
        "layout": "row-major grid_by_time",
        "dtype": "uint16",
        "missing": 65535,
        "min": clean_number(min_value, 4),
        "max": clean_number(max_value, 4),
        "scale": clean_number(scale, 10),
        "offset": clean_number(min_value, 4),
        "times": time_cols,
        "gridIds": grid_ids,
        "bytes": out_path.stat().st_size,
    }


def wrf_stats_for_variable(path: Path, season: str, variable: str) -> tuple[dict[int, dict], dict, dict]:
    values, time_cols = read_wrf_variable(path, variable)
    data_cols = [col for col in values.columns if col != "grid_id"]
    matrix = values[data_cols]
    prefix = f"wrf_{season}_{variable}"
    dataset = write_weather_timeseries(values, time_cols, season, variable)

    stats = pd.DataFrame(
        {
            "grid_id": values["grid_id"],
            f"{prefix}_mean": matrix.mean(axis=1),
            f"{prefix}_min": matrix.min(axis=1),
            f"{prefix}_max": matrix.max(axis=1),
            f"{prefix}_p95": matrix.quantile(0.95, axis=1),
        }
    )
    grid_stats = {
        int(row["grid_id"]): {k: clean_number(v, 3) for k, v in row.items() if k != "grid_id"}
        for row in stats.to_dict(orient="records")
    }

    city_mean = matrix.mean(axis=0)
    city_min = matrix.min(axis=0)
    city_max = matrix.max(axis=0)
    series = {
        "times": time_cols,
        "cityMean": [clean_number(v, 3) for v in city_mean.tolist()],
        "cityMin": [clean_number(v, 3) for v in city_min.tolist()],
        "cityMax": [clean_number(v, 3) for v in city_max.tolist()],
        "stats": {
            "min": clean_number(city_min.min(), 3),
            "max": clean_number(city_max.max(), 3),
            "mean": clean_number(city_mean.mean(), 3),
        },
    }
    return grid_stats, series, dataset


def load_wrf() -> tuple[dict[int, dict], dict, dict]:
    per_grid: dict[int, dict] = {}
    series: dict[str, dict] = {}
    datasets: dict[str, dict] = {}
    reference_grid_ids: list[int] | None = None
    for season, meta in SEASONS.items():
        series[season] = {}
        datasets[season] = {}
        for variable, filename in meta["files"].items():
            stats, variable_series, dataset = wrf_stats_for_variable(meta["source"] / filename, season, variable)
            series[season][variable] = variable_series
            grid_ids = dataset.pop("gridIds")
            if reference_grid_ids is None:
                reference_grid_ids = grid_ids
            elif grid_ids != reference_grid_ids:
                dataset["gridIds"] = grid_ids
            datasets[season][variable] = dataset
            for grid_id, row in stats.items():
                per_grid.setdefault(grid_id, {}).update(row)
    manifest = {
        "generated_by": "scripts/build_microclimate_platform_data.py",
        "gridIds": reference_grid_ids or [],
        "variables": VARIABLES,
        "seasons": {key: {"label": value["label"], "short": value["short"]} for key, value in SEASONS.items()},
        "datasets": datasets,
    }
    WEATHER_TS_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return per_grid, series, manifest


def load_energy_tables() -> dict:
    energy_summary_path = ENERGY_DIR / "hourly_energy_comparison" / "energy_difference_summary_with_deltaT.xlsx"
    urban_rural_path = ENERGY_DIR / "hourly_energy_comparison_v4" / "energy_difference_urban_rural.xlsx"
    enduse_path = ENERGY_DIR / "reviewer3_q4_outputs" / "enduse_decomposition_summary.xlsx"
    src_path = ENERGY_DIR / "sensitivity_analysis" / "shanghai_sensitivity_analysis_SRC.xlsx"

    return {
        "energySummary": records_from_frame(pd.read_excel(energy_summary_path, sheet_name="Energy_Summary")),
        "deltaTByCategory": records_from_frame(pd.read_excel(energy_summary_path, sheet_name="Category_DeltaT_Stats")),
        "deltaTDistribution": records_from_frame(pd.read_excel(energy_summary_path, sheet_name="Violin_Plot_Stats")),
        "hourlyDeltaT": records_from_frame(pd.read_excel(energy_summary_path, sheet_name="Hourly_DeltaT_Stats")),
        "urbanRuralEnergy": records_from_frame(pd.read_excel(urban_rural_path, sheet_name="Energy_Summary")),
        "urbanRuralDeltaT": records_from_frame(pd.read_excel(urban_rural_path, sheet_name="DeltaT_Distribution")),
        "enduseByArchetype": records_from_frame(pd.read_excel(enduse_path, sheet_name="Per_Archetype_Season")),
        "residentialEnduseFocus": records_from_frame(pd.read_excel(enduse_path, sheet_name="Residential_Focus")),
        "srcSummary": records_from_frame(pd.read_excel(src_path, sheet_name="Summary")),
        "srcDetailedStats": records_from_frame(pd.read_excel(src_path, sheet_name="Detailed_Stats")),
    }


def build_geojson(
    grid_geometries: dict[int, dict],
    opportunities: dict[int, dict],
    lcz: dict[int, dict],
    wrf: dict[int, dict],
) -> dict:
    features = []
    for grid_id in sorted(grid_geometries):
        feature = opportunities.get(grid_id)
        opportunity_props = feature["properties"] if feature else {}
        lcz_props = lcz.get(grid_id, {})
        props = {
            "grid_id": grid_id,
            "n_buildings": opportunity_props.get("n_buildings"),
            "LCZ_label": opportunity_props.get("LCZ_label") or lcz_props.get("LCZ_label"),
            "LCZ_mode": opportunity_props.get("LCZ_mode") or lcz_props.get("LCZ_mode"),
            "LCZ_purity": opportunity_props.get("LCZ_purity") or lcz_props.get("LCZ_purity"),
            "baseline_eui_kwh_m2": opportunity_props.get("baseline_eui_kwh_m2"),
            "has_opportunity_grid": bool(feature),
        }
        props.update(lcz_props)
        props.update(wrf.get(grid_id, {}))
        features.append(
            {
                "type": "Feature",
                "geometry": grid_geometries[grid_id],
                "properties": props,
            }
        )
    return {"type": "FeatureCollection", "features": features}


def main() -> None:
    opportunities = load_opportunity_features()
    grid_geometries = load_wrf_grid_geometries()
    lcz_by_grid, lcz_summary, lisa_summary = load_lcz_sensitivity()
    wrf_by_grid, wrf_series, weather_manifest = load_wrf()
    energy_tables = load_energy_tables()
    season_metadata = {
        season: {
            "label": meta["label"],
            "short": meta["short"],
            "source": str(meta["source"]),
            "files": meta["files"],
        }
        for season, meta in SEASONS.items()
    }

    payload = {
        "metadata": {
            "generated_by": "scripts/build_microclimate_platform_data.py",
            "grid_count": len(grid_geometries),
            "opportunity_grid_count": len(opportunities),
            "wrf_grid_count": len(wrf_by_grid),
            "weather_timeseries_manifest": "./data/weather-timeseries/manifest.json",
            "source_note": "LCZ sensitivity, WRF representative-week 500 m fields, and representative-week TMY/WRF energy summaries from the previous Shanghai microclimate-energy paper.",
            "figures": {
                "fig10_spatial_allocation_map": "./assets/figures/fig10_spatial_allocation_map.png",
                "fig10_spatial_context_si": "./assets/figures/fig10_spatial_context_si.png",
            },
        },
        "seasons": season_metadata,
        "variables": VARIABLES,
        "weatherTimeseries": {
            "manifest": "./data/weather-timeseries/manifest.json",
            "grid_count": len(weather_manifest.get("gridIds", [])),
            "datasets": weather_manifest.get("datasets", {}),
        },
        "microclimateGeojson": build_geojson(grid_geometries, opportunities, lcz_by_grid, wrf_by_grid),
        "lczSensitivitySummary": lcz_summary,
        "lisaSummary": lisa_summary,
        "wrfSeries": wrf_series,
        **energy_tables,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    MAPBOX_OUT.parent.mkdir(parents=True, exist_ok=True)
    MAPBOX_OUT.write_text(
        json.dumps(payload["microclimateGeojson"], ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MB)")
    print(f"Wrote {MAPBOX_OUT} ({MAPBOX_OUT.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
