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


def main():
    with OUT.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    data["independenceAblation"] = build_independence()
    data["strategyDrivers"] = build_drivers()
    data["paretoFront"] = build_pareto()

    with OUT.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))

    size_mb = OUT.stat().st_size / 1024 / 1024
    print(
        f"Augmented {OUT.name} ({size_mb:.2f} MB): "
        f"independenceAblation={len(data['independenceAblation'])}, "
        f"strategyDrivers={len(data['strategyDrivers'])}, "
        f"paretoFront={len(data['paretoFront'])}"
    )


if __name__ == "__main__":
    main()
