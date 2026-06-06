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
ARCHETYPE = RESULTS / "archetype_strategy_analysis"
FIGURES = SOURCE_ROOT / "results" / "figures_core_research"
OUT = Path(__file__).resolve().parents[1] / "data" / "shanghai-platform-data.json"
DEFAULT_SCENARIO_ID = "S3_proposed_refined_microclimate_agentic"


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


def geojson_from_gdf(gdf):
    geojson = json.loads(gdf.to_json())
    geojson["features"] = [normalize_feature_properties(f) for f in geojson["features"]]
    return geojson


def load_full_grid_polygons():
    scripts_dir = SOURCE_ROOT / "AI_agent_code" / "mubem-optagent" / "scripts"
    import importlib.util

    script_path = scripts_dir / "11_generate_intervention_heatmaps_and_spatial_maps.py"
    spec = importlib.util.spec_from_file_location("spatial_maps", script_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    grid = module.load_shanghai_grid_polygons()
    grid = grid.to_crs("EPSG:4326")
    grid["geometry"] = grid.geometry.simplify(0.00008, preserve_topology=True)
    return grid


def load_spatial_context():
    path = SPATIAL / "shanghai_spatial_context_grid_metrics.csv"
    df = pd.read_csv(path)
    numeric_cols = [
        "grid_id",
        "LCZ_mode",
        "LCZ_purity",
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
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df["grid_id"] = df["grid_id"].astype(int)
    return df


def summarize_allocation_for_scenario(scenario_id):
    if scenario_id == DEFAULT_SCENARIO_ID:
        spatial_selected = SPATIAL / "shanghai_nsga2_best_grid_allocation.csv"
        if spatial_selected.exists():
            selected = pd.read_csv(spatial_selected)
            selected["grid_id"] = pd.to_numeric(selected["grid_id"], errors="coerce")
            selected = selected[selected["grid_id"].notna()].copy()
            selected["grid_id"] = selected["grid_id"].astype(int)
            if "cost_rmb" not in selected.columns:
                selected["cost_rmb"] = None
            if "period_carbon_reduction_tco2" not in selected.columns:
                selected["period_carbon_reduction_tco2"] = None
            return selected
    path = RESULTS / f"allocation__{scenario_id}.csv"
    if not path.exists():
        return pd.DataFrame()
    alloc = pd.read_csv(path)
    alloc["grid_id"] = pd.to_numeric(alloc["grid_id"], errors="coerce")
    alloc = alloc[alloc["grid_id"].notna()].copy()
    alloc["grid_id"] = alloc["grid_id"].astype(int)
    annual_col = "annual_carbon_reduction_tco2__cluster_weighted_13_14_25"
    summary = (
        alloc.groupby("grid_id", as_index=False)
        .agg(
            selected_units=("unit_id", "nunique"),
            selected_buildings=("building_count", "sum"),
            cost_rmb=("cost_rmb", "sum"),
            period_carbon_reduction_tco2=("period_carbon_reduction_tco2", "sum"),
            annual_carbon_reduction_tco2=(annual_col, "sum"),
        )
    )
    dominant = (
        alloc.groupby(["grid_id", "strategy_id"], as_index=False)
        .agg(strategy_annual_carbon_tco2=(annual_col, "sum"), strategy_cost_rmb=("cost_rmb", "sum"))
        .sort_values(["grid_id", "strategy_annual_carbon_tco2", "strategy_cost_rmb"], ascending=[True, False, False])
        .drop_duplicates("grid_id")
    )
    summary = summary.merge(dominant[["grid_id", "strategy_id"]], on="grid_id", how="left")
    return summary


def build_allocation_geojson(full_grid, spatial_context, scenario_id):
    allocation = summarize_allocation_for_scenario(scenario_id)
    if allocation.empty:
        return {"type": "FeatureCollection", "features": []}
    context_cols = [
        "grid_id",
        "LCZ_mode",
        "LCZ_purity",
        "LCZ_label",
        "lcz_class",
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
    context = spatial_context[
        [c for c in context_cols if c in spatial_context.columns and (c == "grid_id" or c not in allocation.columns)]
    ]
    merged = full_grid.merge(allocation, on="grid_id", how="inner").merge(context, on="grid_id", how="left")
    merged["scenario_id"] = scenario_id
    merged["selected_candidate_uptake_pct"] = (
        merged["annual_carbon_reduction_tco2"]
        / merged["candidate_potential_annual_carbon_tco2"].replace(0, pd.NA)
        * 100
    )
    return geojson_from_gdf(merged)


def build_allocation_geojson_by_scenario(full_grid, spatial_context, scenario_ids):
    return {
        scenario_id: build_allocation_geojson(full_grid, spatial_context, scenario_id)
        for scenario_id in scenario_ids
    }


def build_opportunity_geojson(full_grid, spatial_context):
    keep = spatial_context[
        spatial_context["n_buildings"].notna() | spatial_context["candidate_potential_annual_carbon_tco2"].notna()
    ].copy()
    keep = keep.merge(summarize_recommended_candidate_by_grid(), on="grid_id", how="left")
    keep["opportunity_status"] = "building stock"
    keep.loc[keep["candidate_potential_annual_carbon_tco2"].notna(), "opportunity_status"] = "feasible candidate"
    keep.loc[keep["selected_units"].notna(), "opportunity_status"] = "NSGA-II selected"
    cols = [
        "grid_id",
        "opportunity_status",
        "LCZ_mode",
        "LCZ_purity",
        "LCZ_label",
        "lcz_class",
        "n_buildings",
        "floor_area_m2",
        "demand_GWh",
        "cooling_GWh",
        "heating_GWh",
        "baseline_eui_kwh_m2",
        "function_mix_entropy",
        "candidate_units",
        "candidate_potential_annual_carbon_tco2",
        "selected_units",
        "selected_buildings",
        "annual_carbon_reduction_tco2",
        "strategy_id",
        "strategy_label",
        "selected_candidate_uptake_pct",
        "recommended_strategy_id",
        "recommended_strategy_name",
        "recommended_units",
        "recommended_buildings",
        "recommended_cost_rmb",
        "recommended_annual_carbon_tco2",
        "recommended_rmb_per_tco2",
    ]
    merged = full_grid.merge(keep[[c for c in cols if c in keep.columns]], on="grid_id", how="inner")
    return geojson_from_gdf(merged)


def summarize_recommended_candidate_by_grid():
    path = RESULTS / f"candidate_interventions__{DEFAULT_SCENARIO_ID}.csv"
    if not path.exists():
        return pd.DataFrame(columns=["grid_id"])
    annual_col = "annual_carbon_reduction_tco2__cluster_weighted_13_14_25"
    usecols = [
        "grid_id",
        "unit_id",
        "strategy_id",
        "strategy_name",
        "feasible",
        "cost_rmb",
        "building_count",
        annual_col,
    ]
    cand = pd.read_csv(path, usecols=lambda c: c in usecols)
    cand = cand[cand["feasible"].astype(bool)].copy()
    cand["grid_id"] = pd.to_numeric(cand["grid_id"], errors="coerce")
    cand = cand[cand["grid_id"].notna()].copy()
    cand["grid_id"] = cand["grid_id"].astype(int)
    cand[annual_col] = pd.to_numeric(cand[annual_col], errors="coerce").fillna(0)
    cand["cost_rmb"] = pd.to_numeric(cand["cost_rmb"], errors="coerce").fillna(0)
    cand = cand[(cand[annual_col] > 0) & (cand["cost_rmb"] > 0)].copy()
    if cand.empty:
        return pd.DataFrame(columns=["grid_id"])
    by_strategy = (
        cand.groupby(["grid_id", "strategy_id", "strategy_name"], as_index=False)
        .agg(
            recommended_units=("unit_id", "nunique"),
            recommended_buildings=("building_count", "sum"),
            recommended_cost_rmb=("cost_rmb", "sum"),
            recommended_annual_carbon_tco2=(annual_col, "sum"),
        )
    )
    by_strategy["recommended_rmb_per_tco2"] = (
        by_strategy["recommended_cost_rmb"] / by_strategy["recommended_annual_carbon_tco2"].replace(0, pd.NA)
    )
    by_strategy["score"] = (
        by_strategy["recommended_annual_carbon_tco2"]
        / by_strategy["recommended_cost_rmb"].clip(lower=1)
    )
    best = (
        by_strategy.sort_values(["grid_id", "score", "recommended_annual_carbon_tco2"], ascending=[True, False, False])
        .drop_duplicates("grid_id")
        .rename(columns={"strategy_id": "recommended_strategy_id", "strategy_name": "recommended_strategy_name"})
        .drop(columns=["score"])
    )
    return best


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


def read_text_if_exists(path):
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8", errors="ignore").strip()


def load_optional_records(path, limit=None):
    if not path.exists():
        return []
    df = pd.read_csv(path)
    if limit is not None:
        df = df.head(limit)
    return records(df)


def build_data():
    scenario = pd.read_csv(RESULTS / "scenario_summary.csv")
    strategy_mix = pd.read_csv(RESULTS / "strategy_mix_by_scenario.csv")
    budget = pd.read_csv(RESULTS / "nsga2_budget_sensitivity" / "nsga2_budget_sensitivity_summary.csv")
    model = pd.read_csv(BENCHMARK / "benchmark_score_summary_valid_models.csv")
    archetype_rank_rows = load_optional_records(ARCHETYPE / "archetype_strategy_rank_rows.csv")
    archetype_rank_matrix = load_optional_records(ARCHETYPE / "archetype_strategy_rank_matrix.csv")
    policy_strategy_macc = load_optional_records(SPATIAL / "policy_translation_strategy_macc.csv")
    policy_district_fairness = load_optional_records(SPATIAL / "policy_translation_district_fairness.csv")

    public_validation = None
    validation_path = FULL_YEAR / "public_building_eui_carbon_validation.csv"
    if validation_path.exists():
        public_validation = records(pd.read_csv(validation_path))
    full_grid = load_full_grid_polygons()
    spatial_context = load_spatial_context()
    scenario_ids = scenario["scenario_id"].dropna().tolist()
    allocation_by_scenario = build_allocation_geojson_by_scenario(full_grid, spatial_context, scenario_ids)
    default_allocation = allocation_by_scenario.get(DEFAULT_SCENARIO_ID) or next(iter(allocation_by_scenario.values()))
    opportunity_geojson = build_opportunity_geojson(full_grid, spatial_context)

    data = {
        "metadata": {
            "title": "Shanghai OptAgent Platform",
            "caseStudy": "Shanghai",
            "generatedFrom": str(SOURCE_ROOT),
            "primaryMapLayer": "Full-city 500 m opportunity grids with NSGA-II selected overlays",
            "mapFeatureCount": None,
            "notes": [
                "Full building footprints are served through a Mapbox vector tileset.",
                "Opportunity grids cover all building-stock or feasible-candidate 500 m cells.",
                "NSGA-II selected grids remain sparse because the 1B RMB portfolio is budget-constrained.",
            ],
        },
        "coreMetrics": load_json(RESULTS / "core_performance_metrics.json"),
        "scenarioSummary": records(scenario),
        "strategyMix": records(strategy_mix),
        "budgetSensitivity": records(budget),
        "interventionLibrary": load_json(RESULTS / "intervention_library" / "formal_intervention_library.json"),
        "modelBenchmark": records(model),
        "archetypeStrategyRankRows": archetype_rank_rows,
        "archetypeStrategyRankMatrix": archetype_rank_matrix,
        "policyStrategyMacc": policy_strategy_macc,
        "policyDistrictFairness": policy_district_fairness,
        "figureCaptions": {
            "fig12": read_text_if_exists(FIGURES / "fig12_policy_translation_macc_equity_caption.txt"),
            "fig15": read_text_if_exists(FIGURES / "fig15_archetype_strategy_rank_heatmap_caption.txt"),
        },
        "publicValidation": public_validation,
        "opportunityGeojson": opportunity_geojson,
        "allocationGeojson": default_allocation,
        "allocationGeojsonByScenario": allocation_by_scenario,
        "boundaryGeojson": build_boundary_geojson(),
        "unitExamplesByGrid": build_unit_examples(),
    }
    data["metadata"]["mapFeatureCount"] = len(data["opportunityGeojson"]["features"])
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
