import json
import math
from pathlib import Path

import geopandas as gpd
import pandas as pd


SOURCE_ROOT = Path(r"F:\博士文件\石老师课题组\6.AI-agent-LLM")
RESULTS = SOURCE_ROOT / "results" / "core_research"
SPATIAL = RESULTS / "intervention_and_spatial_analysis"
BENCHMARK = RESULTS / "agent_model_benchmark"
FULL_YEAR = RESULTS / "full_year_validation"
OUT = Path(__file__).resolve().parents[1] / "data" / "shanghai-platform-data.json"


def finite(value):
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def records(df, columns=None, limit=None):
    if columns:
        keep = [c for c in columns if c in df.columns]
        df = df[keep]
    if limit:
        df = df.head(limit)
    return json.loads(df.where(pd.notnull(df), None).to_json(orient="records", force_ascii=False))


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def normalize_feature_properties(feature):
    cleaned = {}
    for key, value in feature.get("properties", {}).items():
        if key == "geometry":
            continue
        if isinstance(value, float):
            value = round(value, 6)
        cleaned[key] = finite(value)
    feature["properties"] = cleaned
    return feature


def build_allocation_geojson():
    gpkg = SPATIAL / "shanghai_nsga2_best_grid_allocation_polygons.gpkg"
    csv = SPATIAL / "shanghai_nsga2_best_grid_allocation.csv"

    gdf = gpd.read_file(gpkg).to_crs("EPSG:4326")
    gdf["geometry"] = gdf.geometry.simplify(0.00008, preserve_topology=True)

    extra = pd.read_csv(csv)
    extra_cols = [
        "grid_id",
        "strategy_id",
        "n_buildings",
        "floor_area_m2",
        "demand_GWh",
        "cooling_GWh",
        "heating_GWh",
        "baseline_eui_kwh_m2",
        "function_mix_entropy",
        "candidate_units",
        "candidate_potential_annual_carbon_tco2",
    ]
    extra = extra[[c for c in extra_cols if c in extra.columns]]
    merged = gdf.merge(extra, on=["grid_id", "strategy_id"], how="left")

    geojson = json.loads(merged.to_json())
    geojson["features"] = [normalize_feature_properties(f) for f in geojson["features"]]
    return geojson


def build_boundary_geojson():
    boundary = SOURCE_ROOT / "Shanghai_border" / "上海市_市界.shp"
    gdf = gpd.read_file(boundary).to_crs("EPSG:4326")
    gdf["geometry"] = gdf.geometry.simplify(0.0012, preserve_topology=True)
    keep = [c for c in ["地名", "ENG_NAME", "geometry"] if c in gdf.columns]
    geojson = json.loads(gdf[keep].to_json())
    geojson["features"] = [normalize_feature_properties(f) for f in geojson["features"]]
    return geojson


def build_unit_examples():
    allocation = pd.read_csv(RESULTS / "allocation__S3_proposed_refined_microclimate_agentic.csv")
    cols = [
        "grid_id",
        "unit_id",
        "strategy_id",
        "strategy_name",
        "function_used_label",
        "refined_function_label",
        "refined_vintage",
        "thermal_template",
        "lcz_label",
        "building_count",
        "floor_area_proxy_m2",
        "mean_llm_confidence",
        "semantic_changed",
        "max_sensitivity_pct",
        "cost_rmb",
        "annual_carbon_reduction_tco2__cluster_weighted_13_14_25",
        "cost_effectiveness_tco2_per_million_rmb",
        "feasibility_reason",
        "evidence_code",
        "trace_note",
    ]
    allocation = allocation[[c for c in cols if c in allocation.columns]]
    annual = "annual_carbon_reduction_tco2__cluster_weighted_13_14_25"
    allocation = allocation.sort_values(["grid_id", annual], ascending=[True, False])
    examples = {}
    for grid_id, group in allocation.groupby("grid_id"):
        examples[str(int(grid_id))] = records(group, limit=4)
    return examples


def build_data():
    scenario = pd.read_csv(RESULTS / "scenario_summary.csv")
    strategy_mix = pd.read_csv(RESULTS / "strategy_mix_by_scenario.csv")
    budget = pd.read_csv(RESULTS / "nsga2_budget_sensitivity" / "nsga2_budget_sensitivity_summary.csv")
    model = pd.read_csv(BENCHMARK / "benchmark_score_summary_valid_models.csv")

    public_validation = None
    validation_path = FULL_YEAR / "public_building_eui_carbon_validation.csv"
    if validation_path.exists():
        public_validation = records(pd.read_csv(validation_path))

    data = {
        "metadata": {
            "title": "Shanghai OptAgent Platform",
            "caseStudy": "Shanghai",
            "generatedFrom": str(SOURCE_ROOT),
            "primaryMapLayer": "NSGA-II selected 500 m retrofit allocation grids",
            "mapFeatureCount": None,
            "notes": [
                "Full building stock is not bundled because the source CSV is large.",
                "Use Mapbox vector tilesets for future building-footprint click layers.",
                "The current map layer is EPSG:4326 and derived from research GPKG outputs.",
            ],
        },
        "coreMetrics": load_json(RESULTS / "core_performance_metrics.json"),
        "scenarioSummary": records(scenario),
        "strategyMix": records(strategy_mix),
        "budgetSensitivity": records(budget),
        "interventionLibrary": load_json(RESULTS / "intervention_library" / "formal_intervention_library.json"),
        "modelBenchmark": records(model),
        "publicValidation": public_validation,
        "allocationGeojson": build_allocation_geojson(),
        "boundaryGeojson": build_boundary_geojson(),
        "unitExamplesByGrid": build_unit_examples(),
    }
    data["metadata"]["mapFeatureCount"] = len(data["allocationGeojson"]["features"])
    return data


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = build_data()
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
    size_mb = OUT.stat().st_size / 1024 / 1024
    print(f"Wrote {OUT} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
