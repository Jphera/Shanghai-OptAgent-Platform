"""Augment the shipped Shanghai platform data with paper Results §3.3/§3.6 evidence.

This is a lightweight, dependency-free merge (stdlib csv/json only) so the bundle
can be refreshed without re-running the full geopandas geometry rebuild in
``build_platform_data.py``. It adds three keys that were previously computed in the
paper but not surfaced in the interactive platform:

- ``independenceAblation``  -> decision_regret_ablation_common_objective.csv  (Fig.16 / §3.6, also carries MILP baselines for §3.3)
- ``strategyDrivers``       -> strategy_assignment_driver_strength.csv        (Fig.16 / §3.6)
- ``paretoFront``           -> nsga2_pareto_summary.csv                       (Fig.4  / §3.3)

``build_platform_data.py`` has been updated to emit the same keys on a full rebuild;
this script just keeps the shipped JSON current in the meantime.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

SOURCE_ROOT = Path(r"F:\博士文件\石老师课题组\6.AI-agent-LLM")
RESULTS = SOURCE_ROOT / "results" / "core_research"
INDEP = RESULTS / "independence_ablation"
NSGA2 = RESULTS / "nsga2"
FULL_YEAR = RESULTS / "full_year_validation"
ARCHETYPE = RESULTS / "archetype_strategy_analysis"
OUT = Path(__file__).resolve().parents[1] / "data" / "shanghai-platform-data.json"


def _num(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "" or text.lower() in {"nan", "none"}:
        return None
    try:
        f = float(text)
        return int(f) if f.is_integer() else f
    except ValueError:
        return text


def _bool(value):
    return str(value).strip().lower() in {"true", "1", "yes"}


def read_rows(path: Path, columns):
    if not path.exists():
        return []
    rows = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for raw in csv.DictReader(handle):
            row = {}
            for key, cast in columns.items():
                if key not in raw:
                    continue
                row[key] = cast(raw[key])
            rows.append(row)
    return rows


def build_independence():
    cols = {
        "portfolio_code": str,
        "portfolio_label": str,
        "portfolio_type": str,
        "selected_units": _num,
        "selected_buildings": _num,
        "annual_carbon_ktco2_common_eval": _num,
        "largest_strategy_budget_share_pct": _num,
        "policy_cap_pass": _bool,
        "jaccard_with_nsga2": _num,
        "regret_vs_nsga2_ktco2": _num,
        "relative_to_nsga2_pct": _num,
    }
    return read_rows(INDEP / "decision_regret_ablation_common_objective.csv", cols)


def build_drivers():
    cols = {
        "driver": str,
        "driver_type": str,
        "strength_metric": str,
        "driver_strength": _num,
    }
    rows = read_rows(INDEP / "strategy_assignment_driver_strength.csv", cols)
    return sorted(rows, key=lambda r: -(r.get("driver_strength") or 0))


def build_pareto():
    cols = {
        "solution_id": str,
        "period_energy_reduction_kwh": _num,
        "period_carbon_reduction_tco2": _num,
        "annual_carbon_reduction_tco2": _num,
        "selected_buildings": _num,
        "cost_rmb": _num,
        "largest_strategy_budget_share": _num,
        "selected_units": _num,
    }
    rows = read_rows(NSGA2 / "nsga2_pareto_summary.csv", cols)
    return sorted(rows, key=lambda r: -(r.get("annual_carbon_reduction_tco2") or 0))


def build_monthly_curves():
    """City monthly totals for Fig.18: full-year TMY load vs microclimate-anchored load vs
    net-after-policy-PV, plus rooftop PV generation. Summed over the five building classes."""
    path = FULL_YEAR / "full_year_monthly_tmy_microclimate_pv_curves_by_type.csv"
    if not path.exists():
        return []
    agg = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for raw in csv.DictReader(handle):
            try:
                month = int(float(raw.get("month") or 0))
            except ValueError:
                continue
            row = agg.setdefault(
                month,
                {"month": month, "month_label": raw.get("month_label"),
                 "tmy_twh": 0.0, "micro_twh": 0.0, "net_twh": 0.0, "pv_twh": 0.0},
            )
            row["tmy_twh"] += float(_num(raw.get("tmy_load_twh")) or 0)
            row["micro_twh"] += float(_num(raw.get("microclimate_anchored_twh")) or 0)
            row["net_twh"] += float(_num(raw.get("net_after_policy_pv_twh")) or 0)
            row["pv_twh"] += float(_num(raw.get("pv_policy_twh")) or 0)
    rows = [agg[m] for m in sorted(agg)]
    for row in rows:
        for key in ("tmy_twh", "micro_twh", "net_twh", "pv_twh"):
            row[key] = round(row[key], 4)
    return rows


def build_sankey():
    """Semantic-change flows (Fig.14): old UBEM sector -> POI-LLM refined sector -> selected
    strategy, aggregated by selected annual carbon abatement (tCO2/yr)."""
    path = ARCHETYPE / "semantic_change_sankey_flows.csv"
    if not path.exists():
        return {}
    links_ab, links_bc = {}, {}
    totals_a, totals_b, totals_c = {}, {}, {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for raw in csv.DictReader(handle):
            a = (raw.get("old_sector") or "Unknown").strip()
            b = (raw.get("refined_sector") or "Unknown").strip()
            c = (raw.get("strategy_label") or "Unknown").strip()
            val = float(_num(raw.get("annual_carbon_reduction_tco2")) or 0)
            if val <= 0:
                continue
            links_ab[(a, b)] = links_ab.get((a, b), 0.0) + val
            links_bc[(b, c)] = links_bc.get((b, c), 0.0) + val
            totals_a[a] = totals_a.get(a, 0.0) + val
            totals_b[b] = totals_b.get(b, 0.0) + val
            totals_c[c] = totals_c.get(c, 0.0) + val

    def nodes(totals):
        return [
            {"name": name, "total": round(total, 1)}
            for name, total in sorted(totals.items(), key=lambda kv: -kv[1])
        ]

    def links(mapping):
        return [
            {"source": s, "target": t, "value": round(v, 1)}
            for (s, t), v in sorted(mapping.items(), key=lambda kv: -kv[1])
        ]

    return {
        "stageA": nodes(totals_a),
        "stageB": nodes(totals_b),
        "stageC": nodes(totals_c),
        "linksAB": links(links_ab),
        "linksBC": links(links_bc),
    }


def main():
    with OUT.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    data["independenceAblation"] = build_independence()
    data["strategyDrivers"] = build_drivers()
    data["paretoFront"] = build_pareto()
    data["fullYearMonthlyCurves"] = build_monthly_curves()
    data["semanticSankey"] = build_sankey()

    with OUT.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))

    size_mb = OUT.stat().st_size / 1024 / 1024
    print(
        f"Augmented {OUT.name} ({size_mb:.2f} MB): "
        f"independenceAblation={len(data['independenceAblation'])}, "
        f"strategyDrivers={len(data['strategyDrivers'])}, "
        f"paretoFront={len(data['paretoFront'])}, "
        f"fullYearMonthlyCurves={len(data['fullYearMonthlyCurves'])}, "
        f"semanticSankey_links={len(data['semanticSankey'].get('linksAB', [])) + len(data['semanticSankey'].get('linksBC', []))}"
    )


if __name__ == "__main__":
    main()
