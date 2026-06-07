from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "shanghai-platform-data.json"
MICRO_PATH = ROOT / "data" / "microclimate-platform-data.json"
ENERGY_PATH = ROOT / "data" / "energy-platform-data.json"


class ChatRequest(BaseModel):
    message: str = Field(default="")
    model: str = Field(default="deepseek-chat")
    context: dict[str, Any] | str | None = None


app = FastAPI(title="Shanghai OptAgent backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def platform_data() -> dict[str, Any]:
    with DATA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def microclimate_data() -> dict[str, Any]:
    with MICRO_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def energy_data() -> dict[str, Any]:
    with ENERGY_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "platform_data": DATA_PATH.exists(),
        "microclimate_data": MICRO_PATH.exists(),
        "energy_data": ENERGY_PATH.exists(),
        "deepseek_configured": bool(os.getenv("DEEPSEEK_API_KEY")),
    }


@app.get("/api/context")
def context_summary() -> dict[str, Any]:
    data = platform_data()
    micro = microclimate_data()
    energy = energy_data()
    return {
        "coreMetrics": data.get("coreMetrics", {}),
        "scenarioCount": len(data.get("scenarioSummary", [])),
        "opportunityGridCount": len(data.get("opportunityGeojson", {}).get("features", [])),
        "microclimateGridCount": micro.get("metadata", {}).get("grid_count"),
        "microclimateSeasons": micro.get("seasons", {}),
        "microclimateVariables": micro.get("variables", {}),
        "energyBuildingCount": energy.get("metadata", {}).get("building_count"),
        "energyGridCount": energy.get("metadata", {}).get("grid_count"),
        "energySeasons": energy.get("seasons", {}),
    }


@app.post("/api/chat")
async def chat(payload: ChatRequest) -> dict[str, Any]:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    request_context = normalize_context(payload.context)
    compact_context = build_compact_context(request_context)

    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        return {
            "answer": local_answer(message, compact_context),
            "mode": "local-backend",
            "evidence": compact_context.get("evidence", []),
        }

    try:
        answer = await call_deepseek(message, payload.model, compact_context, api_key)
    except (HTTPException, httpx.HTTPError) as error:
        detail = str(error).replace(api_key, "[redacted]")[:220]
        return {
            "answer": local_answer(message, compact_context),
            "mode": "local-backend",
            "warning": f"DeepSeek request failed; returned local fallback ({type(error).__name__}: {detail}).",
            "evidence": compact_context.get("evidence", []),
        }
    return {
        "answer": answer,
        "mode": "deepseek",
        "evidence": compact_context.get("evidence", []),
    }


def normalize_context(raw: dict[str, Any] | str | None) -> dict[str, Any]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {"raw": raw[:4000]}


def build_compact_context(frontend: dict[str, Any]) -> dict[str, Any]:
    data = platform_data()
    micro = microclimate_data()
    energy = energy_data()
    scenario = frontend.get("activeScenario") or main_scenario(data)
    micro_view = frontend.get("activeMicroclimateView") or {}
    energy_view = frontend.get("activeEnergyView") or {}
    selected_micro = frontend.get("selectedMicroclimateGrid")
    selected_energy = frontend.get("selectedEnergyGrid")
    selected_grid = frontend.get("selectedGrid")
    selected_opportunity = frontend.get("selectedOpportunityGrid")
    selected_building = frontend.get("selectedBuilding")
    selected_building_energy = frontend.get("selectedBuildingEnergy")

    evidence = [
        "Shanghai OptAgent core metrics",
        "Scenario comparison and NSGA-II allocation summary",
        "LCZ sensitivity grid-level table",
        "WRF representative-week 500 m summaries",
        "TMY-vs-WRF representative-week single-building and 500 m energy response tables",
    ]

    return {
        "coreMetrics": data.get("coreMetrics", {}),
        "scenario": scenario,
        "selectedGrid": selected_grid,
        "selectedOpportunityGrid": selected_opportunity,
        "selectedBuilding": selected_building,
        "selectedBuildingEnergy": selected_building_energy,
        "selectedMicroclimateGrid": selected_micro,
        "selectedEnergyGrid": selected_energy,
        "microclimateView": micro_view,
        "microclimateMetadata": micro.get("metadata", {}),
        "topLczSensitivity": micro_view.get("lczTopRows") or top_lcz_rows(micro),
        "energyView": energy_view,
        "energyMetadata": energy.get("metadata", {}),
        "topEnergyGridRows": energy_view.get("topGridRows") or top_energy_grid_rows(energy),
        "topEnergyTypeRows": energy_view.get("topTypeRows") or top_energy_type_rows(energy),
        "evidence": evidence,
    }


def main_scenario(data: dict[str, Any]) -> dict[str, Any]:
    rows = data.get("scenarioSummary", [])
    for row in rows:
        if row.get("scenario_id") == "S3_proposed_refined_microclimate_agentic":
            return row
    return rows[0] if rows else {}


def top_lcz_rows(micro: dict[str, Any]) -> list[dict[str, Any]]:
    rows = micro.get("lczSensitivitySummary", [])
    cooling = [row for row in rows if str(row.get("Season")).lower() == "cooling"]
    return sorted(cooling, key=lambda row: float(row.get("S_Mean_Weighted") or 0), reverse=True)[:5]


def top_energy_grid_rows(energy: dict[str, Any]) -> list[dict[str, Any]]:
    features = energy.get("energyGridGeojson", {}).get("features", [])
    rows = [feature.get("properties", {}) for feature in features]
    return sorted(rows, key=lambda row: abs(float(row.get("cooling_diff_pct") or 0)), reverse=True)[:5]


def top_energy_type_rows(energy: dict[str, Any]) -> list[dict[str, Any]]:
    rows = energy.get("summaryByType", [])
    return sorted(rows, key=lambda row: abs(float(row.get("cooling_diff_pct") or 0)), reverse=True)[:5]


async def call_deepseek(message: str, model: str, context: dict[str, Any], api_key: str) -> str:
    endpoint = os.getenv("DEEPSEEK_ENDPOINT", "https://api.deepseek.com/chat/completions")
    system = (
        "You are Shanghai OptAgent, a backend research assistant for an urban-scale "
        "microclimate-aware decarbonization platform. Answer using only the supplied "
        "platform context. Distinguish selected NSGA-II allocation grids from full-city "
        "opportunity grids, WRF/LCZ evidence grids, and TMY-vs-WRF energy evidence. Be concise, quantitative, and "
        "explicit about uncertainty. If the user has not selected a map object, answer at the city/platform/paper level; "
        "do not ask them to select a grid unless the question truly needs object-level evidence."
    )
    body = {
        "model": model or "deepseek-chat",
        "messages": [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": f"Platform context:\n{json.dumps(context, ensure_ascii=False)[:18000]}\n\nQuestion:\n{message}",
            },
        ],
        "temperature": 0.2,
    }
    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text[:1000])
    result = response.json()
    return result.get("choices", [{}])[0].get("message", {}).get("content") or "DeepSeek returned no readable answer."


def local_answer(message: str, context: dict[str, Any]) -> str:
    scenario = context.get("scenario") or {}
    micro = context.get("selectedMicroclimateGrid") or {}
    energy = context.get("selectedEnergyGrid") or {}
    building = context.get("selectedBuilding") or {}
    building_energy = context.get("selectedBuildingEnergy") or {}
    selected = context.get("selectedGrid") or {}
    energy_rows = context.get("topEnergyGridRows") or []
    core = context.get("coreMetrics") or {}
    micro_meta = context.get("microclimateMetadata") or {}
    energy_meta = context.get("energyMetadata") or {}

    if micro:
        season = (context.get("microclimateView") or {}).get("season", "cooling")
        return (
            f"Microclimate grid {micro.get('grid_id')} is a WRF/LCZ evidence cell, not automatically a selected retrofit unit. "
            f"For {season}, LCZ sensitivity is {micro.get(f'sensitivity_{season}_pct')}%, mean T2 is "
            f"{micro.get(f'wrf_{season}_temp_mean')} C, RH is {micro.get(f'wrf_{season}_rh_mean')}%, "
            f"shortwave is {micro.get(f'wrf_{season}_solar_mean')} W/m2, and wind is {micro.get(f'wrf_{season}_wind_mean')} m/s."
        )
    if building:
        if building_energy:
            season = (context.get("energyView") or {}).get("season", "cooling")
            return (
                f"Building {building.get('bldg_id') or building.get('objectid')} belongs to grid {building.get('grid_id')}. "
                f"For {season}, TMY energy is {building_energy.get(f'{season}_tmy_kwh')} kWh, WRF/microclimate energy is "
                f"{building_energy.get(f'{season}_wrf_kwh')} kWh, and the shift is {building_energy.get(f'{season}_diff_pct')}%."
            )
        return (
            f"Building {building.get('bldg_id') or building.get('objectid')} belongs to grid {building.get('grid_id')}. "
            f"It is classified as {building.get('coarse_function') or building.get('building_type')} with template "
            f"{building.get('thermal_template')} and confidence {building.get('llm_confidence') or building.get('ml_probability')}."
        )
    if energy:
        season = (context.get("energyView") or {}).get("season", "cooling")
        return (
            f"Energy grid {energy.get('grid_id')} aggregates {energy.get('energy_building_count')} buildings. "
            f"For {season}, TMY energy is {energy.get(f'{season}_tmy_kwh')} kWh, WRF/microclimate energy is "
            f"{energy.get(f'{season}_wrf_kwh')} kWh, and the shift is {energy.get(f'{season}_diff_pct')}%."
        )
    if selected:
        return (
            f"Selected grid {selected.get('grid_id')} is in the current NSGA-II allocation. "
            f"Strategy: {selected.get('strategy_label') or selected.get('strategy_id')}; selected buildings: "
            f"{selected.get('selected_buildings')}; annual reduction: {selected.get('annual_carbon_reduction_tco2')} tCO2/yr."
        )
    if energy_rows:
        first = energy_rows[0]
        return (
            f"The proposed scenario is {scenario.get('scenario_id', 'S3')}. Representative-week energy evidence is loaded; "
            f"the strongest grid response currently shown is {first}. At city scale, the backend can discuss the paper workflow, "
            f"microclimate-energy coupling, benchmark evidence, and retrofit allocation without requiring a selected grid."
        )
    return (
        "Shanghai OptAgent is connected to the Render backend and can answer at city scale even without a selected map object. "
        f"The loaded context includes {core.get('optimization_units', 'n/a')} semantic decision units, "
        f"{micro_meta.get('grid_count', 'n/a')} WRF 500 m microclimate cells, "
        f"{energy_meta.get('grid_count', 'n/a')} energy grids, and the active scenario "
        f"{scenario.get('scenario_id', 'S3_proposed_refined_microclimate_agentic')}. "
        "Clicking a building or grid simply adds object-level evidence to the same agent conversation."
    )


app.mount("/", StaticFiles(directory=ROOT, html=True), name="static")
