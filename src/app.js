const CONFIG = window.SHANGHAI_OPTAGENT_CONFIG || {};

const STORAGE = {
  mapboxToken: "shanghai-optagent-mapbox-token",
  apiKey: "shanghai-optagent-api-key",
  apiEndpoint: "shanghai-optagent-api-endpoint",
  apiModel: "shanghai-optagent-api-model"
};

const STRATEGIES = {
  cool_roof: {
    label: "Cool roof",
    color: "#d8902f",
    audit: "Cooling-oriented envelope measure. Critic checks heating penalty and LCZ exposure before recommending scale-up."
  },
  operational_tuning: {
    label: "Controls",
    color: "#167a75",
    audit: "Low-capital controls measure. Critic checks whether broad coverage is policy-plausible and avoids overconcentration."
  },
  rooftop_pv: {
    label: "Rooftop PV",
    color: "#286ca3",
    audit: "On-site generation measure. Critic checks roof suitability, high-value grids, and portfolio budget share."
  },
  external_shading: {
    label: "External shading",
    color: "#7b63b7",
    audit: "Solar-gain control measure. Critic checks orientation and cooling-heating trade-offs."
  },
  envelope_insulation: {
    label: "Envelope insulation",
    color: "#4d8b57",
    audit: "Deep envelope measure. Critic checks vintage eligibility and cost intensity."
  },
  hvac_cop_upgrade: {
    label: "HVAC COP upgrade",
    color: "#bd4a42",
    audit: "Equipment efficiency measure. Critic checks function-specific HVAC load and retrofit feasibility."
  }
};

const METRIC_LABELS = {
  annual_carbon_reduction_tco2: "Annual carbon reduction",
  selected_buildings: "Selected buildings",
  max_microclimate_sensitivity_pct: "Microclimate sensitivity"
};

const MICRO_SEASONS = ["cooling", "transition", "heating"];

const MICRO_METRICS = {
  sensitivity: {
    label: "LCZ sensitivity",
    short: "Sensitivity",
    unit: "%",
    kind: "lcz",
    palette: ["#f2f5f3", "#87b9ad", "#e4b354", "#bd4a42"]
  },
  temp: {
    label: "WRF air temperature",
    short: "Temperature",
    unit: "degC",
    kind: "wrf",
    palette: ["#285c9d", "#7bb7c8", "#f0c45d", "#bd4a42"]
  },
  rh: {
    label: "WRF relative humidity",
    short: "Humidity",
    unit: "%",
    kind: "wrf",
    palette: ["#ede7c9", "#9ec6bd", "#4f8aa8", "#315d84"]
  },
  solar: {
    label: "WRF shortwave radiation",
    short: "Solar",
    unit: "W/m2",
    kind: "wrf",
    palette: ["#f2f5f3", "#e5d27b", "#d8902f", "#9b473d"]
  },
  wind: {
    label: "WRF wind speed",
    short: "Wind",
    unit: "m/s",
    kind: "wrf",
    palette: ["#edf1f2", "#9ab8b4", "#577e91", "#284f67"]
  }
};

const ENERGY_MODES = {
  building: "Single building",
  grid: "500 m grid"
};

const ENERGY_METRICS = {
  diff_pct: {
    label: "WRF vs TMY difference",
    short: "Diff %",
    unit: "%",
    decimals: 1
  },
  tmy_kwh: {
    label: "TMY week energy",
    short: "TMY kWh",
    unit: "kWh",
    decimals: 0
  },
  wrf_kwh: {
    label: "WRF week energy",
    short: "WRF kWh",
    unit: "kWh",
    decimals: 0
  },
  delta_kwh: {
    label: "WRF minus TMY",
    short: "Delta kWh",
    unit: "kWh",
    decimals: 0
  }
};

const FUNCTION_COLORS = {
  "住宅类": "#4d8b57",
  "办公就业类": "#286ca3",
  "商业服务类": "#d8902f",
  "公共服务类": "#7b63b7",
  "学校类": "#bd4a42",
  "工业仓储类": "#bd4a42",
  "交通设施类": "#6c757d"
};

const SCENARIO_META = {
  S0_old_attributes_microclimate: {
    label: "Ablation: old attributes + microclimate",
    note: "Pre-refinement UBEM attributes with microclimate-aware annualization."
  },
  S1_refined_attributes_TMY: {
    label: "Ablation: refined attributes + TMY",
    note: "POI-LLM refined semantics with TMY weather instead of microclimate-weighted impacts."
  },
  S2_refined_attributes_microclimate_energy_only: {
    label: "Baseline: energy-only ranking",
    note: "Refined semantics and microclimate evidence are active, but the strategy-balance guardrail is relaxed."
  },
  S3_proposed_refined_microclimate_agentic: {
    label: "Proposed: refined + microclimate + agentic guardrails",
    note: "Main OptAgent configuration: semantic refinement, microclimate-aware impacts and critic constraints are all active."
  },
  S4_old_attributes_deep_retrofit_microclimate: {
    label: "Deep-retrofit check: old attributes",
    note: "High-capital envelope/HVAC stress test under old UBEM attributes."
  },
  S5_refined_attributes_deep_retrofit_microclimate: {
    label: "Deep-retrofit check: refined + microclimate",
    note: "High-capital envelope/HVAC stress test with refined semantics and microclimate-aware annualization."
  },
  S6_refined_attributes_deep_retrofit_TMY: {
    label: "Deep-retrofit check: refined + TMY",
    note: "High-capital envelope/HVAC stress test with refined semantics and TMY weather evidence."
  }
};

const AGENTS = {
  data: {
    label: "Data Agent",
    short: "Data",
    role: "GIS, POI-LLM semantics, LCZ and MUBEM outputs are fused into decision units.",
    tools: ["load_semantic_stock", "identify_microclimate_hotspots", "build_decision_units"],
    output: "BuildingStockSummary, HotspotSet, SemanticDecisionUnit",
    color: "#286ca3"
  },
  knowledge: {
    label: "Knowledge Agent",
    short: "Knowledge",
    role: "RAG-grounded retrofit, policy, cost, comfort-risk and applicability constraints.",
    tools: ["retrieve_policy_constraints", "load_intervention_library", "bind_evidence_bundle"],
    output: "InterventionLibrary, PolicyConstraintSet, EvidenceBundle",
    color: "#7b63b7"
  },
  scenario: {
    label: "Scenario Agent",
    short: "Scenario",
    role: "Candidate strategy matrix generation and infeasible combination screening.",
    tools: ["generate_intervention_candidates", "screen_function_vintage_rules", "score_candidate_feasibility"],
    output: "FeasibilityMatrix, InterventionPackage, DecisionVariableSet",
    color: "#d8902f"
  },
  optimization: {
    label: "Optimization Agent",
    short: "Optimize",
    role: "NSGA-II portfolio allocation and MILP baseline comparison under budget constraints.",
    tools: ["score_energy_carbon_cost", "optimize_retrofit_portfolio", "compare_milp_baseline"],
    output: "ParetoSolutionSet, SelectedStrategyMap, CostCarbonSummary",
    color: "#167a75"
  },
  critic: {
    label: "Critic Agent",
    short: "Critic",
    role: "Constraint audit, concentration checks, evidence trace and comfort-risk warnings.",
    tools: ["critic_check_constraints", "audit_strategy_concentration", "export_trace_report"],
    output: "CritiqueReport, ConstraintViolationList, RevisionRequest",
    color: "#bd4a42"
  }
};

const state = {
  data: null,
  map: null,
  activePanel: "overview",
  activeAgent: "data",
  selectedFeature: null,
  scenarioId: "S3_proposed_refined_microclimate_agentic",
  strategyFilter: "all",
  colorMetric: "strategy",
  activeBenchmarkModel: "deepseek:deepseek-chat",
  activeArchetypeKey: null,
  popup: null,
  selectedOpportunity: null,
  selectedBuilding: null,
  microclimate: null,
  activeMicroSeason: "cooling",
  activeMicroMetric: "sensitivity",
  selectedMicroclimate: null,
  microclimateSourceMode: null,
  energy: null,
  energyPromise: null,
  energyError: null,
  energyShardCache: new Map(),
  activeEnergyMode: "building",
  activeEnergySeason: "cooling",
  activeEnergyMetric: "diff_pct",
  selectedEnergyGrid: null,
  energyMapEventsBound: false,
  buildingLayerError: null
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  wirePanels();
  wireTokenControls();
  wireLayerControls();
  wireChat();
  restoreApiSettings();

  state.data = await loadData();
  state.microclimate = await loadMicroclimateData();
  renderOverview();
  renderMicroclimatePanel();
  renderEnergyPanel();
  renderEvidence();
  renderAgentWorkbench();
  renderAgentTrace(buildAgentTrace("Initialize the Shanghai OptAgent workflow."));
  renderEmptySelection();
  initMap();
}

async function loadData() {
  const response = await fetch(CONFIG.dataUrl || "./data/shanghai-platform-data.json");
  if (!response.ok) {
    throw new Error(`Unable to load platform data: ${response.status}`);
  }
  return response.json();
}

async function loadMicroclimateData() {
  const url = CONFIG.microclimateDataUrl;
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load microclimate data: ${response.status}`);
    return response.json();
  } catch (error) {
    console.warn(error);
    return null;
  }
}

async function ensureEnergyData() {
  if (state.energy) return state.energy;
  if (state.energyPromise) return state.energyPromise;
  const url = CONFIG.energyDataUrl;
  if (!url) return null;
  state.energyError = null;
  state.energyPromise = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load energy data: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      state.energy = data;
      state.energyPromise = null;
      ensureEnergyMapLayer();
      syncEnergyLayer();
      renderEnergyPanel();
      return data;
    })
    .catch((error) => {
      console.warn(error);
      state.energyError = error.message || "Energy data failed to load.";
      state.energyPromise = null;
      renderEnergyPanel();
      return null;
    });
  renderEnergyPanel();
  return state.energyPromise;
}

function energyShardKey(bldgId) {
  const count = Number(state.energy?.buildingShards?.count || 0);
  const id = Number(bldgId);
  if (!count || !Number.isFinite(id)) return null;
  const shard = ((Math.trunc(id) % count) + count) % count;
  return String(shard).padStart(2, "0");
}

function energyShardUrl(key) {
  const pattern = state.energy?.buildingShards?.urlPattern;
  if (!pattern) return "";
  return pattern.replace("{shard}", key);
}

function rowToBuildingEnergy(columns, row) {
  const record = {};
  columns.forEach((column, index) => {
    record[column] = row[index];
  });
  if (record.type_code !== null && record.type_code !== undefined) {
    record.type_label = state.energy?.typeLabels?.[Number(record.type_code)] || null;
  }
  return record;
}

async function loadBuildingEnergyRecord(bldgId) {
  await ensureEnergyData();
  if (!state.energy) return null;
  const id = Number(bldgId);
  const key = energyShardKey(id);
  if (!key) return null;
  if (!state.energyShardCache.has(key)) {
    const response = await fetch(energyShardUrl(key));
    if (!response.ok) throw new Error(`Unable to load building energy shard ${key}: ${response.status}`);
    const json = await response.json();
    const lookup = new Map();
    (json.rows || []).forEach((row) => {
      const record = rowToBuildingEnergy(json.columns || [], row);
      lookup.set(Number(record.bldg_id), record);
    });
    state.energyShardCache.set(key, lookup);
  }
  return state.energyShardCache.get(key).get(id) || null;
}

function cachedBuildingEnergyRecord(bldgId) {
  const key = energyShardKey(bldgId);
  if (!key || !state.energyShardCache.has(key)) return null;
  return state.energyShardCache.get(key).get(Number(bldgId)) || null;
}

function hydrateSelectedBuildingEnergy(bldgId) {
  if (!bldgId) return;
  loadBuildingEnergyRecord(bldgId)
    .then((record) => {
      const current = Number(state.selectedBuilding?.properties?.bldg_id);
      if (record && Number(bldgId) === current) {
        renderSelectedBuilding();
        renderEnergyPanel();
      }
    })
    .catch((error) => {
      console.warn(error);
      state.energyError = error.message || "Building energy failed to load.";
      renderEnergyPanel();
    });
}

function initMap() {
  const token = getMapboxToken();
  if (!window.mapboxgl || !token) {
    showTokenNotice();
    return;
  }

  hideTokenNotice();
  mapboxgl.accessToken = token;
  const initial = CONFIG.initialView || {};

  state.map = new mapboxgl.Map({
    container: "map",
    style: CONFIG.styleUrl || "mapbox://styles/mapbox/light-v11",
    center: initial.center || [121.4737, 31.2304],
    zoom: initial.zoom || 9,
    pitch: initial.pitch ?? 42,
    bearing: initial.bearing || 0,
    attributionControl: true
  });

  state.map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "bottom-right");

  state.map.on("load", () => {
    addMapSourcesAndLayers();
    fitAllocation();
  });
  state.map.on("idle", updateBuildingStatus);
  state.map.on("moveend", updateBuildingStatus);
  state.map.on("zoomend", updateBuildingStatus);
}

function getMapboxToken() {
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get("mapbox_token");
  if (queryToken) {
    localStorage.setItem(STORAGE.mapboxToken, queryToken);
    return queryToken;
  }
  return CONFIG.mapboxAccessToken || localStorage.getItem(STORAGE.mapboxToken) || "";
}

function showTokenNotice() {
  document.getElementById("tokenNotice").classList.remove("hidden");
}

function hideTokenNotice() {
  document.getElementById("tokenNotice").classList.add("hidden");
}

function wireTokenControls() {
  document.getElementById("saveMapboxToken").addEventListener("click", () => {
    const value = document.getElementById("mapboxTokenInput").value.trim();
    if (!value) return;
    localStorage.setItem(STORAGE.mapboxToken, value);
    if (state.map) state.map.remove();
    initMap();
  });
}

function microclimateSourceLayerSpec() {
  return state.microclimateSourceMode === "vector" && CONFIG.microclimateTileset?.sourceLayer
    ? { "source-layer": CONFIG.microclimateTileset.sourceLayer }
    : {};
}

function addMapSourcesAndLayers() {
  const map = state.map;
  map.addSource("shanghai-boundary", {
    type: "geojson",
    data: state.data.boundaryGeojson
  });

  map.addSource("allocation", {
    type: "geojson",
    data: state.data.allocationGeojson,
    generateId: true
  });

  map.addSource("opportunity", {
    type: "geojson",
    data: state.data.opportunityGeojson,
    generateId: true
  });

  const microTileset = CONFIG.microclimateTileset || {};
  if (microTileset.enabled && microTileset.sourceUrl && microTileset.sourceLayer) {
    map.addSource("microclimate", {
      type: "vector",
      url: microTileset.sourceUrl
    });
    state.microclimateSourceMode = "vector";
  } else if (state.microclimate && state.microclimate.microclimateGeojson) {
    map.addSource("microclimate", {
      type: "geojson",
      data: state.microclimate.microclimateGeojson,
      generateId: true
    });
    state.microclimateSourceMode = "geojson";
  }

  map.addLayer({
    id: "boundary-fill",
    type: "fill",
    source: "shanghai-boundary",
    paint: {
      "fill-color": "#dfe9e5",
      "fill-opacity": 0.34
    }
  });

  map.addLayer({
    id: "boundary-line",
    type: "line",
    source: "shanghai-boundary",
    paint: {
      "line-color": "#203039",
      "line-width": 1.2,
      "line-opacity": 0.72
    }
  });

  map.addLayer({
    id: "opportunity-fill",
    type: "fill",
    source: "opportunity",
    paint: {
      "fill-color": opportunityColorExpression(),
      "fill-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        0.32,
        11,
        0.20,
        13,
        0.10
      ]
    }
  });

  map.addLayer({
    id: "opportunity-line",
    type: "line",
    source: "opportunity",
    paint: {
      "line-color": "#6c7a80",
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        0.15,
        12,
        0.35
      ],
      "line-opacity": 0.26
    }
  });

  map.addLayer({
    id: "opportunity-selected-line",
    type: "line",
    source: "opportunity",
    filter: ["==", ["get", "grid_id"], -1],
    paint: {
      "line-color": "#172126",
      "line-width": 2.8,
      "line-opacity": 0.95
    }
  });

  if (map.getSource("microclimate")) {
    map.addLayer({
      id: "microclimate-fill",
      type: "fill",
      source: "microclimate",
      ...microclimateSourceLayerSpec(),
      layout: { visibility: "none" },
      paint: {
        "fill-color": microclimateColorExpression(),
        "fill-opacity": 0.66
      }
    });

    map.addLayer({
      id: "microclimate-line",
      type: "line",
      source: "microclimate",
      ...microclimateSourceLayerSpec(),
      layout: { visibility: "none" },
      paint: {
        "line-color": "#ffffff",
        "line-width": 0.45,
        "line-opacity": 0.62
      }
    });

    map.addLayer({
      id: "microclimate-selected-line",
      type: "line",
      source: "microclimate",
      ...microclimateSourceLayerSpec(),
      layout: { visibility: "none" },
      filter: ["==", ["get", "grid_id"], -1],
      paint: {
        "line-color": "#172126",
        "line-width": 3,
        "line-opacity": 0.95
      }
    });
  }

  map.addLayer({
    id: "allocation-fill",
    type: "fill",
    source: "allocation",
    paint: {
      "fill-color": strategyColorExpression(),
      "fill-opacity": 0.68
    }
  });

  map.addLayer({
    id: "allocation-line",
    type: "line",
    source: "allocation",
    paint: {
      "line-color": "#ffffff",
      "line-width": 0.8,
      "line-opacity": 0.7
    }
  });

  map.addLayer({
    id: "agent-highlight-fill",
    type: "fill",
    source: "opportunity",
    filter: ["in", ["get", "grid_id"], ["literal", []]],
    paint: {
      "fill-color": "#172126",
      "fill-opacity": 0.24
    }
  });

  map.addLayer({
    id: "allocation-selected-line",
    type: "line",
    source: "allocation",
    filter: ["==", ["get", "grid_id"], -1],
    paint: {
      "line-color": "#172126",
      "line-width": 3,
      "line-opacity": 0.95
    }
  });

  addBuildingTilesetLayer();

  map.addLayer({
    id: "allocation-labels",
    type: "symbol",
    source: "allocation",
    minzoom: 10.8,
    layout: {
      visibility: "none",
      "text-field": ["to-string", ["get", "grid_id"]],
      "text-size": 10,
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"]
    },
    paint: {
      "text-color": "#172126",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.2
    }
  });

  map.on("click", "allocation-fill", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;
    selectFeature(feature, event.lngLat);
  });

  map.on("click", "opportunity-fill", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;
    const gridId = Number(feature.properties.grid_id);
    const selected = findCurrentAllocationFeature(gridId);
    if (selected) {
      selectFeature(selected, event.lngLat);
    } else {
      selectOpportunityFeature(feature, event.lngLat);
    }
  });

  map.on("mouseenter", "allocation-fill", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "allocation-fill", () => {
    map.getCanvas().style.cursor = "";
  });

  map.on("mouseenter", "opportunity-fill", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "opportunity-fill", () => {
    map.getCanvas().style.cursor = "";
  });

  if (map.getLayer("microclimate-fill")) {
    map.on("click", "microclimate-fill", (event) => {
      const feature = event.features && event.features[0];
      if (!feature) return;
      selectMicroclimateFeature(feature, event.lngLat);
    });

    map.on("mouseenter", "microclimate-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "microclimate-fill", () => {
      map.getCanvas().style.cursor = "";
    });
  }

  applyMapFilters();
  syncMicroclimateLayer();
  configureBuildingToggle();
  renderLegend();
}

function addBuildingTilesetLayer() {
  const cfg = CONFIG.buildingTileset || {};
  if (!cfg.enabled || !cfg.sourceUrl || !cfg.sourceLayer || !state.map) return;
  const map = state.map;
  state.buildingLayerError = null;

  try {
    map.addSource("shanghai-buildings", {
      type: "vector",
      url: cfg.sourceUrl
    });

    map.addLayer({
      id: "building-fill",
      type: "fill-extrusion",
      source: "shanghai-buildings",
      "source-layer": cfg.sourceLayer,
      minzoom: cfg.minzoom || 12.5,
      paint: {
        "fill-extrusion-color": buildingFunctionColorExpression(),
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          cfg.minzoom || 12.5,
          ["*", ["coalesce", ["to-number", ["get", "height_m"]], 8], 0.18],
          (cfg.minzoom || 12.5) + 1.2,
          ["*", ["coalesce", ["to-number", ["get", "height_m"]], 8], 1.25]
        ],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.88,
          0.72
        ]
      }
    });

    map.addLayer({
      id: "building-line",
      type: "line",
      source: "shanghai-buildings",
      "source-layer": cfg.sourceLayer,
      minzoom: cfg.minzoom || 12.5,
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.42,
        "line-width": 0.45
      }
    });

    map.addLayer({
      id: "building-selected-line",
      type: "line",
      source: "shanghai-buildings",
      "source-layer": cfg.sourceLayer,
      minzoom: cfg.minzoom || 12.5,
      filter: ["==", ["get", "bldg_id"], -1],
      paint: {
        "line-color": "#172126",
        "line-width": 2.4,
        "line-opacity": 0.95
      }
    });

    map.on("click", "building-fill", (event) => {
      const feature = event.features && event.features[0];
      if (!feature) return;
      selectBuildingFeature(feature, event.lngLat);
    });

    map.on("mouseenter", "building-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "building-fill", () => {
      map.getCanvas().style.cursor = "";
    });

    updateBuildingStatus();
  } catch (error) {
    console.warn("Unable to add 3D building tileset layer", error);
    state.buildingLayerError = error.message || "Mapbox layer error";
    updateBuildingStatus();
  }
}

function buildingFunctionColorExpression() {
  const expression = ["match", ["coalesce", ["get", "building_type"], ["get", "coarse_function"]]];
  Object.entries(FUNCTION_COLORS).forEach(([key, color]) => expression.push(key, color));
  expression.push("#8d989d");
  return expression;
}

function opportunityColorExpression() {
  const potential = [
    "to-number",
    [
      "coalesce",
      ["get", "recommended_annual_carbon_tco2"],
      ["get", "candidate_potential_annual_carbon_tco2"],
      0
    ]
  ];
  return [
    "case",
    [">", potential, 0],
    [
      "interpolate",
      ["linear"],
      potential,
      0,
      "#f2f5f3",
      300,
      "#b8d6c5",
      1200,
      "#e7bf69",
      4000,
      "#b45a4d"
    ],
    "#d8e1e6"
  ];
}

function microclimateMetricField(metric = state.activeMicroMetric, season = state.activeMicroSeason) {
  if (metric === "sensitivity") return `sensitivity_${season}_pct`;
  return `wrf_${season}_${metric}_mean`;
}

function microclimateMetricLabel(metric = state.activeMicroMetric, season = state.activeMicroSeason) {
  const meta = MICRO_METRICS[metric] || MICRO_METRICS.sensitivity;
  const seasonMeta = state.microclimate && state.microclimate.seasons ? state.microclimate.seasons[season] : null;
  return `${meta.label}${seasonMeta ? ` - ${seasonMeta.short}` : ""}`;
}

function microclimateColorExpression() {
  const metric = MICRO_METRICS[state.activeMicroMetric] || MICRO_METRICS.sensitivity;
  const field = microclimateMetricField();
  const range = microclimateMetricRange(field);
  const min = Number.isFinite(range.min) ? range.min : 0;
  const max = Number.isFinite(range.max) && range.max > min ? range.max : min + 1;
  const colors = metric.palette;
  return [
    "case",
    ["has", field],
    [
      "interpolate",
      ["linear"],
      ["to-number", ["get", field]],
      min,
      colors[0],
      min + (max - min) * 0.35,
      colors[1],
      min + (max - min) * 0.72,
      colors[2],
      max,
      colors[3]
    ],
    "rgba(190, 198, 199, 0.22)"
  ];
}

function microclimateMetricRange(field) {
  const features =
    state.microclimate && state.microclimate.microclimateGeojson
      ? state.microclimate.microclimateGeojson.features || []
      : [];
  const values = features.map((feature) => Number(feature.properties[field])).filter(Number.isFinite);
  if (!values.length) return { min: 0, max: 1, mean: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length
  };
}

function energyMetricField(metric = state.activeEnergyMetric, season = state.activeEnergySeason) {
  return `${season}_${metric}`;
}

function energyMetricLabel(metric = state.activeEnergyMetric, season = state.activeEnergySeason) {
  const metricMeta = ENERGY_METRICS[metric] || ENERGY_METRICS.diff_pct;
  const seasonMeta = state.energy?.seasons?.[season] || state.microclimate?.seasons?.[season];
  return `${metricMeta.label}${seasonMeta ? ` - ${seasonMeta.short}` : ""}`;
}

function energyMetricRange(field) {
  const features =
    state.energy && state.energy.energyGridGeojson
      ? state.energy.energyGridGeojson.features || []
      : [];
  const values = features.map((feature) => Number(feature.properties[field])).filter(Number.isFinite);
  if (!values.length) return { min: 0, max: 1, mean: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length
  };
}

function energyColorExpression() {
  const field = energyMetricField();
  const range = energyMetricRange(field);
  const min = Number.isFinite(range.min) ? range.min : 0;
  const max = Number.isFinite(range.max) && range.max > min ? range.max : min + 1;
  if (state.activeEnergyMetric === "diff_pct" || state.activeEnergyMetric === "delta_kwh") {
    const low = Math.min(min, -1);
    const high = Math.max(max, 1);
    return [
      "case",
      ["has", field],
      [
        "interpolate",
        ["linear"],
        ["to-number", ["get", field]],
        low,
        "#286ca3",
        0,
        "#f4f3e9",
        high,
        "#bd4a42"
      ],
      "rgba(190, 198, 199, 0.18)"
    ];
  }
  return [
    "case",
    ["has", field],
    [
      "interpolate",
      ["linear"],
      ["to-number", ["get", field]],
      min,
      "#edf4ef",
      min + (max - min) * 0.35,
      "#85b9ad",
      min + (max - min) * 0.72,
      "#e0b357",
      max,
      "#bd4a42"
    ],
    "rgba(190, 198, 199, 0.18)"
  ];
}

function ensureEnergyMapLayer() {
  if (!state.map || !state.energy?.energyGridGeojson) return;
  const map = state.map;
  if (!map.getSource("energy-grid")) {
    map.addSource("energy-grid", {
      type: "geojson",
      data: state.energy.energyGridGeojson,
      generateId: true
    });
  }
  if (!map.getLayer("energy-grid-fill")) {
    map.addLayer({
      id: "energy-grid-fill",
      type: "fill",
      source: "energy-grid",
      layout: { visibility: "none" },
      paint: {
        "fill-color": energyColorExpression(),
        "fill-opacity": 0.64
      }
    });
  }
  if (!map.getLayer("energy-grid-line")) {
    map.addLayer({
      id: "energy-grid-line",
      type: "line",
      source: "energy-grid",
      layout: { visibility: "none" },
      paint: {
        "line-color": "#ffffff",
        "line-width": 0.45,
        "line-opacity": 0.6
      }
    });
  }
  if (!map.getLayer("energy-grid-selected-line")) {
    map.addLayer({
      id: "energy-grid-selected-line",
      type: "line",
      source: "energy-grid",
      layout: { visibility: "none" },
      filter: ["==", ["get", "grid_id"], -1],
      paint: {
        "line-color": "#172126",
        "line-width": 3,
        "line-opacity": 0.95
      }
    });
  }
  if (!state.energyMapEventsBound && map.getLayer("energy-grid-fill")) {
    map.on("click", "energy-grid-fill", (event) => {
      const feature = event.features && event.features[0];
      if (!feature) return;
      selectEnergyGridFeature(feature, event.lngLat);
    });
    map.on("mouseenter", "energy-grid-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "energy-grid-fill", () => {
      map.getCanvas().style.cursor = "";
    });
    state.energyMapEventsBound = true;
  }
}

function configureBuildingToggle() {
  const checkbox = document.getElementById("toggleBuildings");
  const cfg = CONFIG.buildingTileset || {};
  if (!cfg.enabled) {
    checkbox.checked = false;
    checkbox.disabled = true;
    checkbox.parentElement.title = "Upload the Mapbox tileset and set buildingTileset.enabled=true in src/config.js.";
    return;
  }
  checkbox.disabled = false;
}

function strategyColorExpression() {
  const expression = ["match", ["get", "strategy_id"]];
  Object.entries(STRATEGIES).forEach(([key, meta]) => expression.push(key, meta.color));
  expression.push("#8d989d");
  return expression;
}

function metricColorExpression(metric) {
  const max = maxMetric(metric);
  if (!max) return "#8d989d";
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", metric], 0],
    0,
    "#eff4ef",
    max * 0.25,
    "#84b9ad",
    max * 0.65,
    "#e4b354",
    max,
    "#bd4a42"
  ];
}

function maxMetric(metric) {
  return Math.max(
    ...state.data.allocationGeojson.features.map((feature) => Number(feature.properties[metric]) || 0)
  );
}

function currentAllocationGeojson() {
  const byScenario = state.data.allocationGeojsonByScenario || {};
  return byScenario[state.scenarioId] || state.data.allocationGeojson;
}

function findCurrentAllocationFeature(gridId) {
  return currentAllocationGeojson().features.find((item) => Number(item.properties.grid_id) === Number(gridId));
}

function updateAllocationForScenario() {
  const next = currentAllocationGeojson();
  state.data.allocationGeojson = next;
  state.selectedFeature = null;
  state.selectedOpportunity = null;
  state.selectedBuilding = null;
  state.selectedMicroclimate = null;
  state.selectedEnergyGrid = null;
  if (state.map && state.map.getSource("allocation")) {
    state.map.getSource("allocation").setData(next);
  }
  if (state.map && state.map.getLayer("allocation-selected-line")) {
    state.map.setFilter("allocation-selected-line", ["==", ["get", "grid_id"], -1]);
  }
  if (state.map && state.map.getLayer("opportunity-selected-line")) {
    state.map.setFilter("opportunity-selected-line", ["==", ["get", "grid_id"], -1]);
  }
  renderStrategyFilter();
  renderScenarioNarrative();
  renderLegend();
  renderEmptySelection();
  renderAgentWorkbench();
  renderAgentTrace(buildAgentTrace(`Switch to ${scenarioLabel(state.scenarioId)}.`));
  applyMapFilters();
  syncEnergyLayer();
}

function applyMapFilters() {
  if (!state.map || !state.map.getLayer("allocation-fill")) return;
  const filters = ["all"];
  if (state.strategyFilter !== "all") {
    filters.push(["==", ["get", "strategy_id"], state.strategyFilter]);
  }
  state.map.setFilter("allocation-fill", filters);
  state.map.setFilter("allocation-line", filters);
  state.map.setFilter("allocation-labels", filters);

  const color =
    state.colorMetric === "strategy" ? strategyColorExpression() : metricColorExpression(state.colorMetric);
  state.map.setPaintProperty("allocation-fill", "fill-color", color);
}

function wirePanels() {
  document.querySelectorAll("[data-panel-target]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activePanel = button.dataset.panelTarget;
      document.querySelectorAll("[data-panel-target]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll(".panel-section").forEach((panel) => panel.classList.remove("active"));
      document.getElementById(`panel-${state.activePanel}`).classList.add("active");
      if (state.activePanel === "energy") {
        ensureEnergyData();
      }
      syncMicroclimateLayer();
      syncEnergyLayer();
    });
  });
}

function wireLayerControls() {
  document.getElementById("strategyFilter").addEventListener("change", (event) => {
    state.strategyFilter = event.target.value;
    applyMapFilters();
    renderLegend();
  });

  document.getElementById("colorMetric").addEventListener("change", (event) => {
    state.colorMetric = event.target.value;
    applyMapFilters();
    renderLegend();
  });

  document.getElementById("toggleBoundary").addEventListener("change", (event) => {
    setLayerVisibility(["boundary-fill", "boundary-line"], event.target.checked);
  });

  document.getElementById("toggleOpportunity").addEventListener("change", (event) => {
    setLayerVisibility(["opportunity-fill", "opportunity-line", "opportunity-selected-line"], event.target.checked);
  });

  document.getElementById("toggleAllocation").addEventListener("change", (event) => {
    setLayerVisibility(["allocation-fill", "allocation-line", "allocation-selected-line", "agent-highlight-fill"], event.target.checked);
  });

  document.getElementById("toggleBuildings").addEventListener("change", (event) => {
    setLayerVisibility(["building-fill", "building-line", "building-selected-line"], event.target.checked);
  });

  document.getElementById("toggleLabels").addEventListener("change", (event) => {
    setLayerVisibility(["allocation-labels"], event.target.checked);
  });

  document.getElementById("fitView").addEventListener("click", fitAllocation);
  document.getElementById("zoomSelected").addEventListener("click", zoomSelected);
  document.getElementById("focus3dBuildings").addEventListener("click", focus3DBuildings);
  document.getElementById("askAgentButton").addEventListener("click", openAgentModal);
  document.getElementById("resetPitch").addEventListener("click", () => {
    if (!state.map) return;
    state.map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  });
  wireMicroclimateControls();
  wireEnergyControls();
}

function setLayerVisibility(layerIds, visible) {
  if (!state.map) return;
  layerIds.forEach((id) => {
    if (state.map.getLayer(id)) {
      state.map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  });
}

function syncMicroclimateLayer() {
  if (!state.map) return;
  const visible = state.activePanel === "microclimate" && Boolean(state.microclimate);
  setLayerVisibility(["microclimate-fill", "microclimate-line", "microclimate-selected-line"], visible);
  if (state.map.getLayer("microclimate-fill")) {
    state.map.setPaintProperty("microclimate-fill", "fill-color", microclimateColorExpression());
  }
  if (visible && state.map.getLayer("microclimate-selected-line")) {
    const id = state.selectedMicroclimate ? Number(state.selectedMicroclimate.properties.grid_id) : -1;
    state.map.setFilter("microclimate-selected-line", ["==", ["get", "grid_id"], id]);
  }
}

function syncEnergyLayer() {
  if (!state.map) return;
  ensureEnergyMapLayer();
  const visible = state.activePanel === "energy" && state.activeEnergyMode === "grid" && Boolean(state.energy);
  setLayerVisibility(["energy-grid-fill", "energy-grid-line", "energy-grid-selected-line"], visible);
  if (state.map.getLayer("energy-grid-fill")) {
    state.map.setPaintProperty("energy-grid-fill", "fill-color", energyColorExpression());
  }
  if (visible && state.map.getLayer("energy-grid-selected-line")) {
    const id = state.selectedEnergyGrid ? Number(state.selectedEnergyGrid.properties.grid_id) : -1;
    state.map.setFilter("energy-grid-selected-line", ["==", ["get", "grid_id"], id]);
  }
}

function renderOverview() {
  const metrics = state.data.coreMetrics;
  const cards = [
    [formatNumber(metrics.optimization_units), "semantic decision units"],
    [formatNumber(metrics.refined_feasible_unit_strategy_pairs), "feasible unit-strategy pairs"],
    [`${formatNumber(metrics.feasible_candidate_share_proposed_pct, 1)}%`, "candidate feasibility rate"],
    [`${formatNumber(metrics.mean_llm_confidence, 3)}`, "mean LLM semantic confidence"]
  ];
  document.getElementById("metricGrid").innerHTML = cards
    .map(([value, label]) => `<div class="metric-card"><strong>${value}</strong><span>${label}</span></div>`)
    .join("");

  const scenarioSelect = document.getElementById("scenarioSelect");
  scenarioSelect.innerHTML = state.data.scenarioSummary
    .map((row) => `<option value="${row.scenario_id}">${scenarioLabel(row.scenario_id)}</option>`)
    .join("");
  scenarioSelect.value = state.scenarioId;
  scenarioSelect.addEventListener("change", (event) => {
    state.scenarioId = event.target.value;
    updateAllocationForScenario();
  });

  renderStrategyFilter();
  renderScenarioNarrative();
}

function renderStrategyFilter() {
  const strategySelect = document.getElementById("strategyFilter");
  const counts = {};
  state.data.allocationGeojson.features.forEach((feature) => {
    const key = feature.properties.strategy_id;
    counts[key] = (counts[key] || 0) + Number(feature.properties.selected_units || 1);
  });
  const strategies = Object.keys(STRATEGIES);
  const previous = state.strategyFilter;
  strategySelect.innerHTML =
    `<option value="all">All selected strategies in this comparison</option>` +
    strategies
      .map((key) => {
        const count = counts[key] || 0;
        const disabled = count ? "" : " disabled";
        return `<option value="${key}"${disabled}>${(STRATEGIES[key] && STRATEGIES[key].label) || key} (${formatNumber(count)} units)</option>`;
      })
      .join("");
  state.strategyFilter = strategies.includes(previous) && counts[previous] ? previous : "all";
  strategySelect.value = state.strategyFilter;
}

function renderScenarioNarrative() {
  const row = state.data.scenarioSummary.find((item) => item.scenario_id === state.scenarioId);
  if (!row) return;
  const meta = SCENARIO_META[row.scenario_id] || {};
  const mix = state.data.strategyMix.filter((item) => item.scenario_id === row.scenario_id);
  const top = mix
    .slice()
    .sort((a, b) => Number(b.period_carbon_reduction_tco2) - Number(a.period_carbon_reduction_tco2))
    .slice(0, 3)
    .map((item) => `${strategyLabel(item.strategy_id)} (${formatNumber(item.selected_buildings)} buildings)`)
    .join(", ");

  document.getElementById("scenarioNarrative").innerHTML = `
    <p><strong>${scenarioLabel(row.scenario_id)}</strong> is a model comparison view, not a separate policy scenario. ${meta.note || ""}</p>
    <p>It selects ${formatNumber(row.selected_units)} units and ${formatNumber(row.selected_buildings)} buildings under a ${formatCurrency(row.budget_rmb)} budget.</p>
    <p>Annual carbon reduction is ${formatNumber(row.annual_carbon_reduction_tco2__cluster_weighted_13_14_25, 1)} tCO2/yr, with the largest strategy budget share constrained to ${formatNumber(row.largest_strategy_budget_share_pct, 1)}%.</p>
    <p>Dominant strategies: ${top || "not available"}. The full opportunity layer covers ${formatNumber((state.data.opportunityGeojson || { features: [] }).features.length)} building-stock/candidate grids; this scenario selects ${formatNumber(state.data.allocationGeojson.features.length)} budget-constrained grids.</p>
  `;
}

function wireMicroclimateControls() {
  const seasonBox = document.getElementById("microSeasonButtons");
  const metricBox = document.getElementById("microMetricButtons");
  seasonBox?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-micro-season]");
    if (!button) return;
    state.activeMicroSeason = button.dataset.microSeason;
    renderMicroclimatePanel();
    syncMicroclimateLayer();
  });
  metricBox?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-micro-metric]");
    if (!button) return;
    state.activeMicroMetric = button.dataset.microMetric;
    renderMicroclimatePanel();
    syncMicroclimateLayer();
  });
}

function renderMicroclimatePanel() {
  const data = state.microclimate;
  const metricGrid = document.getElementById("microMetricGrid");
  if (!metricGrid) return;
  if (!data) {
    metricGrid.innerHTML = `<div class="metric-card wide"><strong>Not loaded</strong><span>Microclimate data were not available.</span></div>`;
    ["microSeasonButtons", "microMetricButtons", "microNarrative", "wrfSeriesChart", "lczSensitivityList", "fig10Explorer"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.innerHTML = "";
    });
    return;
  }

  renderMicroSeasonButtons();
  renderMicroMetricButtons();
  renderMicroMetricCards();
  renderMicroNarrative();
  renderWrfSeriesChart();
  renderLczSensitivityList();
  renderFig10Explorer();
}

function renderMicroSeasonButtons() {
  const container = document.getElementById("microSeasonButtons");
  const seasons = state.microclimate.seasons || {};
  container.innerHTML = MICRO_SEASONS.map((season) => {
    const meta = seasons[season] || {};
    return `<button type="button" class="${season === state.activeMicroSeason ? "active" : ""}" data-micro-season="${season}">${escapeHtml(meta.short || season)}</button>`;
  }).join("");
}

function renderMicroMetricButtons() {
  const container = document.getElementById("microMetricButtons");
  container.innerHTML = Object.entries(MICRO_METRICS)
    .map(
      ([key, metric]) =>
        `<button type="button" class="${key === state.activeMicroMetric ? "active" : ""}" data-micro-metric="${key}">${escapeHtml(metric.short)}</button>`
    )
    .join("");
}

function renderMicroMetricCards() {
  const field = microclimateMetricField();
  const range = microclimateMetricRange(field);
  const metric = MICRO_METRICS[state.activeMicroMetric] || MICRO_METRICS.sensitivity;
  const seasonLabel = state.microclimate.seasons[state.activeMicroSeason]?.short || state.activeMicroSeason;
  const lczRows = microLczRowsForSeason();
  const topLcz = lczRows[0];
  const variable = MICRO_METRICS[state.activeMicroMetric]?.kind === "wrf" ? state.activeMicroMetric : "temp";
  const series = state.microclimate.wrfSeries?.[state.activeMicroSeason]?.[variable];

  document.getElementById("microMetricGrid").innerHTML = [
    [formatNumber(range.mean, metric.unit === "%" ? 1 : 2), `mean ${metric.unit} (${seasonLabel})`],
    [formatNumber(range.max, metric.unit === "%" ? 1 : 2), `max ${metric.short.toLowerCase()}`],
    [topLcz ? `${escapeHtml(topLcz.LCZ_label || topLcz.LCZ_name || topLcz.LCZ_code)}` : "n/a", "highest mean LCZ sensitivity"],
    [series ? `${formatNumber(series.stats?.mean, 2)} ${metric.unit}` : "n/a", `city mean ${MICRO_METRICS[variable].short.toLowerCase()}`]
  ]
    .map(([value, label]) => `<div class="metric-card"><strong>${value}</strong><span>${label}</span></div>`)
    .join("");
}

function renderMicroNarrative() {
  const metric = MICRO_METRICS[state.activeMicroMetric] || MICRO_METRICS.sensitivity;
  const season = state.microclimate.seasons[state.activeMicroSeason] || {};
  const field = microclimateMetricField();
  const range = microclimateMetricRange(field);
  const lisa = (state.microclimate.lisaSummary || []).find(
    (row) => String(row.Season).toLowerCase() === state.activeMicroSeason && row.Cluster_Type === "HH"
  );
  const node = document.getElementById("microNarrative");
  node.innerHTML = `
    <p><strong>${escapeHtml(metric.label)}</strong> is mapped for the ${escapeHtml(season.label || state.activeMicroSeason)}. The layer uses 500 m grid summaries derived from the previous Shanghai microclimate-energy workflow.</p>
    <p>Current grid range: ${formatNumber(range.min, 2)} to ${formatNumber(range.max, 2)} ${escapeHtml(metric.unit)}. ${lisa ? `LISA HH clusters cover ${formatNumber(lisa.Percent, 1)}% of grids with mean sensitivity ${formatNumber(lisa.Mean_Sensitivity, 1)}%.` : ""}</p>
  `;
}

function renderWrfSeriesChart() {
  const variable = MICRO_METRICS[state.activeMicroMetric]?.kind === "wrf" ? state.activeMicroMetric : "temp";
  const series = state.microclimate.wrfSeries?.[state.activeMicroSeason]?.[variable];
  const metric = MICRO_METRICS[variable];
  const node = document.getElementById("wrfSeriesChart");
  if (!series || !series.cityMean || !series.cityMean.length) {
    node.innerHTML = `<p class="narrative">WRF time-series data are not loaded.</p>`;
    return;
  }
  const values = series.cityMean.map(Number).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 330;
  const height = 126;
  const pad = 14;
  const points = series.cityMean
    .map((value, index) => {
      const x = pad + (index / Math.max(1, series.cityMean.length - 1)) * (width - pad * 2);
      const y = height - pad - ((Number(value) - min) / Math.max(0.0001, max - min)) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  node.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(metric.label)} citywide WRF series">
      <rect x="0" y="0" width="${width}" height="${height}" rx="8"></rect>
      <polyline points="${points}"></polyline>
      <text x="${pad}" y="${height - 5}">${escapeHtml(series.times[0] || "")}</text>
      <text x="${width - pad}" y="${height - 5}" text-anchor="end">${escapeHtml(series.times[series.times.length - 1] || "")}</text>
      <text x="${pad}" y="17">${formatNumber(max, 2)} ${escapeHtml(metric.unit)}</text>
      <text x="${width - pad}" y="17" text-anchor="end">mean ${formatNumber(series.stats?.mean, 2)}</text>
    </svg>
  `;
}

function renderLczSensitivityList() {
  const rows = microLczRowsForSeason().slice(0, 7);
  const max = Math.max(...rows.map((row) => Number(row.S_Mean_Weighted || 0)), 1);
  document.getElementById("lczSensitivityList").innerHTML = rows
    .map((row) => {
      const width = (Number(row.S_Mean_Weighted || 0) / max) * 100;
      return `
        <div class="micro-row">
          <span class="micro-row-top"><strong>${escapeHtml(row.LCZ_label || row.LCZ_name || row.LCZ_code)}</strong><em>${formatNumber(row.S_Mean_Weighted, 1)}%</em></span>
          <span class="rank-track"><span class="rank-fill" style="width:${width}%"></span></span>
          <span>${escapeHtml(row.LCZ_name || "")} | high-grid share ${formatNumber(Number(row.P_High || 0) * 100, 1)}%</span>
        </div>
      `;
    })
    .join("");
}

function renderMicroEnergyEvidence() {
  const node = document.getElementById("microEnergyEvidence");
  if (!node) return;
  const rows = microEnergyRowsForSeason().slice(0, 5);
  node.innerHTML = rows
    .map(
      (row) => `
        <div class="micro-row">
          <span class="micro-row-top"><strong>${escapeHtml(row.category)}</strong><em>${formatNumber(row.diff, 1)}%</em></span>
          <span>TMY ${formatNumber(row.tmy, 1)} Wh/m2 | WRF ${formatNumber(row.wrf, 1)} Wh/m2 | ΔT ${formatNumber(row.deltaT, 2)} C</span>
        </div>
      `
    )
    .join("");
}

function renderFig10Explorer() {
  const s3 = state.data.scenarioSummary.find((row) => row.scenario_id === "S3_proposed_refined_microclimate_agentic");
  const opportunityCount = state.data.opportunityGeojson.features.length;
  const selectedCount = state.data.allocationGeojson.features.length;
  const node = document.getElementById("fig10Explorer");
  node.innerHTML = `
    <div class="fig10-card-grid">
      <button type="button" data-fig10-action="allocation">
        <strong>Selected allocation</strong>
        <span>${formatNumber(selectedCount)} selected grids, ${formatNumber(s3?.selected_buildings)} buildings, ${formatNumber((s3?.annual_carbon_reduction_tco2__cluster_weighted_13_14_25 || 0) / 1000, 1)} ktCO2/yr.</span>
      </button>
      <button type="button" data-fig10-action="context">
        <strong>Spatial context</strong>
        <span>${formatNumber(opportunityCount)} opportunity grids link LCZ morphology, baseline EUI, and candidate retrofit potential.</span>
      </button>
    </div>
    <figure class="evidence-figure compact-figure">
      <img src="./assets/figures/fig10_spatial_allocation_map.png" alt="Fig. 10 spatial allocation reference" />
    </figure>
  `;
  node.querySelectorAll("[data-fig10-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.fig10Action === "allocation") {
        state.activePanel = "layers";
        document.querySelector('[data-panel-target="layers"]')?.click();
        fitAllocation();
      } else {
        state.activeMicroMetric = "sensitivity";
        renderMicroclimatePanel();
        syncMicroclimateLayer();
        fitAllocation();
      }
    });
  });
}

function microLczRowsForSeason() {
  return (state.microclimate.lczSensitivitySummary || [])
    .filter((row) => String(row.Season).toLowerCase() === state.activeMicroSeason)
    .sort((a, b) => Number(b.S_Mean_Weighted || 0) - Number(a.S_Mean_Weighted || 0));
}

function microEnergyRowsForSeason() {
  const seasonMap = { cooling: "Summer", transition: "Spring", heating: "Winter" };
  const season = seasonMap[state.activeMicroSeason];
  return (state.microclimate.energySummary || [])
    .map((row) => ({
      category: row.Category,
      tmy: Number(row[`${season}_TMY_Wh_m2`]),
      wrf: Number(row[`${season}_Climate_Wh_m2`] ?? row[`${season}_WRF_Wh_m2`]),
      diff: Number(row[`${season}_Diff_%`]),
      deltaT: Number(row[`${season}_Mean_DeltaT_C`])
    }))
    .filter((row) => Number.isFinite(row.diff))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

function wireEnergyControls() {
  document.getElementById("energyModeButtons")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-energy-mode]");
    if (!button) return;
    state.activeEnergyMode = button.dataset.energyMode;
    ensureEnergyData();
    renderEnergyPanel();
    syncEnergyLayer();
    if (state.activeEnergyMode === "building") focus3DBuildings();
  });
  document.getElementById("energySeasonButtons")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-energy-season]");
    if (!button) return;
    state.activeEnergySeason = button.dataset.energySeason;
    renderEnergyPanel();
    syncEnergyLayer();
  });
  document.getElementById("energyMetricButtons")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-energy-metric]");
    if (!button) return;
    state.activeEnergyMetric = button.dataset.energyMetric;
    renderEnergyPanel();
    syncEnergyLayer();
  });
}

function renderEnergyPanel() {
  const metricGrid = document.getElementById("energyMetricGrid");
  if (!metricGrid) return;
  const clearIds = ["energyModeButtons", "energySeasonButtons", "energyMetricButtons", "energyNarrative", "buildingEnergyEvidence", "energyGridEvidence", "energyTypeList"];
  if (!state.energy) {
    const loading = state.energyPromise ? "Loading" : state.energyError ? "Not loaded" : "Ready";
    metricGrid.innerHTML = `<div class="metric-card wide"><strong>${loading}</strong><span>${state.energyError || "Open Energy to load building-level TMY and WRF evidence."}</span></div>`;
    clearIds.forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.innerHTML = "";
    });
    return;
  }

  renderEnergyModeButtons();
  renderEnergySeasonButtons();
  renderEnergyMetricButtons();
  renderEnergyMetricCards();
  renderEnergyNarrative();
  renderBuildingEnergyEvidence();
  renderEnergyGridEvidence();
  renderEnergyTypeList();
}

function renderEnergyModeButtons() {
  const container = document.getElementById("energyModeButtons");
  container.innerHTML = Object.entries(ENERGY_MODES)
    .map(
      ([key, label]) =>
        `<button type="button" class="${key === state.activeEnergyMode ? "active" : ""}" data-energy-mode="${key}">${escapeHtml(label)}</button>`
    )
    .join("");
}

function renderEnergySeasonButtons() {
  const container = document.getElementById("energySeasonButtons");
  const seasons = state.energy.seasons || {};
  container.innerHTML = MICRO_SEASONS.map((season) => {
    const meta = seasons[season] || {};
    return `<button type="button" class="${season === state.activeEnergySeason ? "active" : ""}" data-energy-season="${season}">${escapeHtml(meta.short || season)}</button>`;
  }).join("");
}

function renderEnergyMetricButtons() {
  const container = document.getElementById("energyMetricButtons");
  container.innerHTML = Object.entries(ENERGY_METRICS)
    .map(
      ([key, metric]) =>
        `<button type="button" class="${key === state.activeEnergyMetric ? "active" : ""}" data-energy-metric="${key}">${escapeHtml(metric.short)}</button>`
    )
    .join("");
}

function renderEnergyMetricCards() {
  const field = energyMetricField();
  const range = energyMetricRange(field);
  const metric = ENERGY_METRICS[state.activeEnergyMetric] || ENERGY_METRICS.diff_pct;
  const selectedBuildingEnergy = state.selectedBuilding
    ? cachedBuildingEnergyRecord(state.selectedBuilding.properties.bldg_id)
    : null;
  const selectedGrid = state.selectedEnergyGrid ? state.selectedEnergyGrid.properties : null;
  const typeTop = energyTypeRowsForSeason()[0];
  const buildingValue = selectedBuildingEnergy ? energyRecordValue(selectedBuildingEnergy, state.activeEnergyMetric) : null;
  const gridValue = selectedGrid ? Number(selectedGrid[field]) : null;
  document.getElementById("energyMetricGrid").innerHTML = [
    [formatNumber(state.energy.metadata?.building_count, 0), "single-building records"],
    [formatNumber(state.energy.metadata?.grid_count, 0), "500 m energy grids"],
    [
      selectedBuildingEnergy
        ? energyFormatValue(buildingValue, state.activeEnergyMetric)
        : selectedGrid
          ? energyFormatValue(gridValue, state.activeEnergyMetric)
          : energyFormatValue(range.mean, state.activeEnergyMetric),
      selectedBuildingEnergy ? "selected building" : selectedGrid ? "selected grid" : `mean ${metric.short}`
    ],
    [typeTop ? energyFormatValue(typeTop[`${state.activeEnergySeason}_diff_pct`], "diff_pct") : "n/a", typeTop ? `${typeTop.type_label} type shift` : "type shift"]
  ]
    .map(([value, label]) => `<div class="metric-card"><strong>${value}</strong><span>${label}</span></div>`)
    .join("");
}

function renderEnergyNarrative() {
  const metric = ENERGY_METRICS[state.activeEnergyMetric] || ENERGY_METRICS.diff_pct;
  const season = state.energy.seasons[state.activeEnergySeason] || {};
  const field = energyMetricField();
  const range = energyMetricRange(field);
  const modeText =
    state.activeEnergyMode === "grid"
      ? "The map colors 500 m grid aggregates. Click a grid to inspect summed TMY/WRF energy and mean sensitivity."
      : "Click any 3D building footprint to load its exact representative-week TMY, WRF and percentage-difference record.";
  document.getElementById("energyNarrative").innerHTML = `
    <p><strong>${escapeHtml(metric.label)}</strong> is active for the ${escapeHtml(season.label || state.activeEnergySeason)}. ${modeText}</p>
    <p>Grid range for this metric is ${energyFormatValue(range.min, state.activeEnergyMetric)} to ${energyFormatValue(range.max, state.activeEnergyMetric)}. Positive values indicate higher WRF/microclimate-week energy than TMY.</p>
  `;
}

function renderBuildingEnergyEvidence() {
  const node = document.getElementById("buildingEnergyEvidence");
  if (!state.selectedBuilding) {
    node.innerHTML = `<div class="micro-row"><span class="micro-row-top"><strong>No building selected</strong><em>${escapeHtml(ENERGY_MODES.building)}</em></span><span>Switch to high zoom and click a 3D building footprint to load one building's TMY-vs-WRF energy record.</span></div>`;
    return;
  }
  const bldgId = state.selectedBuilding.properties.bldg_id;
  const record = cachedBuildingEnergyRecord(bldgId);
  if (!record) {
    hydrateSelectedBuildingEnergy(bldgId);
    node.innerHTML = `<div class="micro-row"><span class="micro-row-top"><strong>Building ${escapeHtml(bldgId)}</strong><em>loading</em></span><span>Fetching the matching energy shard for this building id.</span></div>`;
    return;
  }
  node.innerHTML = MICRO_SEASONS.map((season) => {
    const meta = state.energy.seasons[season] || {};
    return `
      <div class="micro-row ${season === state.activeEnergySeason ? "active" : ""}">
        <span class="micro-row-top"><strong>${escapeHtml(meta.short || season)}</strong><em>${energyFormatValue(record[`${season}_diff_pct`], "diff_pct")}</em></span>
        <span>TMY ${energyFormatValue(record[`${season}_tmy_kwh`], "tmy_kwh")} | WRF ${energyFormatValue(record[`${season}_wrf_kwh`], "wrf_kwh")}</span>
        <span>${escapeHtml(record.type_label || state.selectedBuilding.properties.coarse_function || "type n/a")} | Grid ${escapeHtml(record.grid_id || state.selectedBuilding.properties.grid_id || "n/a")} | floor area ${formatNumber(record.floor_area_m2, 0)} m2</span>
      </div>
    `;
  }).join("");
}

function renderEnergyGridEvidence() {
  const node = document.getElementById("energyGridEvidence");
  const selected = state.selectedEnergyGrid ? state.selectedEnergyGrid.properties : null;
  if (selected) {
    node.innerHTML = energyGridRowsHtml([selected], true);
    return;
  }
  const rows = energyGridRowsForMetric().slice(0, 5).map((feature) => feature.properties);
  node.innerHTML = energyGridRowsHtml(rows, false);
}

function renderEnergyTypeList() {
  const rows = energyTypeRowsForSeason().slice(0, 7);
  const max = Math.max(...rows.map((row) => Math.abs(Number(row[`${state.activeEnergySeason}_diff_pct`] || 0))), 1);
  document.getElementById("energyTypeList").innerHTML = rows
    .map((row) => {
      const value = Number(row[`${state.activeEnergySeason}_diff_pct`] || 0);
      const width = (Math.abs(value) / max) * 100;
      return `
        <div class="micro-row">
          <span class="micro-row-top"><strong>${escapeHtml(row.type_label)}</strong><em>${energyFormatValue(value, "diff_pct")}</em></span>
          <span class="rank-track"><span class="rank-fill ${value < 0 ? "cool" : ""}" style="width:${width}%"></span></span>
          <span>${formatNumber(row.building_count, 0)} buildings | TMY ${energyFormatValue(row[`${state.activeEnergySeason}_tmy_kwh`], "tmy_kwh")} | WRF ${energyFormatValue(row[`${state.activeEnergySeason}_wrf_kwh`], "wrf_kwh")}</span>
        </div>
      `;
    })
    .join("");
}

function energyGridRowsHtml(rows, selectedOnly) {
  if (!rows.length) {
    return `<div class="micro-row"><span class="micro-row-top"><strong>No grid evidence</strong><em>n/a</em></span><span>Energy grid summaries are not available for the current metric.</span></div>`;
  }
  return rows
    .map((row) => {
      const field = energyMetricField();
      return `
        <div class="micro-row ${selectedOnly ? "active" : ""}">
          <span class="micro-row-top"><strong>Grid ${escapeHtml(row.grid_id)}</strong><em>${energyFormatValue(row[field], state.activeEnergyMetric)}</em></span>
          <span>${formatNumber(row.energy_building_count, 0)} buildings | ${escapeHtml(row.LCZ_label || "LCZ n/a")} | floor area ${formatNumber(row.energy_floor_area_m2, 0)} m2</span>
          <span>TMY ${energyFormatValue(row[`${state.activeEnergySeason}_tmy_kwh`], "tmy_kwh")} | WRF ${energyFormatValue(row[`${state.activeEnergySeason}_wrf_kwh`], "wrf_kwh")} | diff ${energyFormatValue(row[`${state.activeEnergySeason}_diff_pct`], "diff_pct")}</span>
        </div>
      `;
    })
    .join("");
}

function energyGridRowsForMetric() {
  const field = energyMetricField();
  return (state.energy?.energyGridGeojson?.features || [])
    .slice()
    .filter((feature) => Number.isFinite(Number(feature.properties[field])))
    .sort((a, b) => Math.abs(Number(b.properties[field])) - Math.abs(Number(a.properties[field])));
}

function energyTypeRowsForSeason() {
  return (state.energy?.summaryByType || [])
    .slice()
    .sort(
      (a, b) =>
        Math.abs(Number(b[`${state.activeEnergySeason}_diff_pct`] || 0)) -
        Math.abs(Number(a[`${state.activeEnergySeason}_diff_pct`] || 0))
    );
}

function energyRecordValue(record, metric = state.activeEnergyMetric, season = state.activeEnergySeason) {
  if (!record) return null;
  if (metric === "delta_kwh") {
    const wrf = Number(record[`${season}_wrf_kwh`]);
    const tmy = Number(record[`${season}_tmy_kwh`]);
    return Number.isFinite(wrf) && Number.isFinite(tmy) ? wrf - tmy : null;
  }
  return record[`${season}_${metric}`];
}

function energyFormatValue(value, metric = state.activeEnergyMetric) {
  const meta = ENERGY_METRICS[metric] || ENERGY_METRICS.diff_pct;
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return `${formatNumber(number, meta.decimals)}${meta.unit === "%" ? "%" : ` ${meta.unit}`}`;
}

function renderEvidence() {
  renderModelBenchmark();
  renderArchetypeExplorer();
  renderPolicyExplorer();
  renderBudgetChart();
}

function renderAgentWorkbench() {
  const container = document.getElementById("agentCards");
  if (!container) return;
  const selected = state.selectedFeature ? state.selectedFeature.properties : null;
  const opportunity = state.selectedOpportunity ? state.selectedOpportunity.properties : null;
  const energyGrid = state.selectedEnergyGrid ? state.selectedEnergyGrid.properties : null;
  const building = state.selectedBuilding ? state.selectedBuilding.properties : null;

  container.innerHTML = Object.entries(AGENTS)
    .map(([key, agent]) => {
      const status = agentStatus(key, selected || opportunity || energyGrid, building);
      return `
        <button class="agent-card ${state.activeAgent === key ? "active" : ""}" type="button" data-agent-key="${key}" style="--agent-color:${agent.color}">
          <span class="agent-card-top">
            <strong>${agent.short}</strong>
            <em>${status}</em>
          </span>
          <span>${agent.role}</span>
        </button>
      `;
    })
    .join("");

  container.querySelectorAll("[data-agent-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeAgent = button.dataset.agentKey;
      renderAgentWorkbench();
      renderAgentTrace(buildAgentTrace(`Focus ${AGENTS[state.activeAgent].label}.`));
    });
  });
}

function agentStatus(key, selected, building) {
  if (key === "data" && building) return "building linked";
  if (key === "data" && selected) return "grid linked";
  if (key === "knowledge") return selected || building ? "evidence ready" : "library ready";
  if (selected?.energy_building_count && key === "scenario") return "energy evidence";
  if (selected?.energy_building_count && key === "optimization") return "evidence only";
  if (key === "scenario") return selected ? "candidates bound" : "awaiting grid";
  if (key === "optimization") return selected ? "portfolio selected" : "scenario ready";
  if (key === "critic") return selected || building ? "audit ready" : "standing by";
  return "ready";
}

function buildAgentTrace(prompt) {
  const selected = state.selectedFeature ? state.selectedFeature.properties : null;
  const opportunity = state.selectedOpportunity ? state.selectedOpportunity.properties : null;
  const energyGrid = state.selectedEnergyGrid ? state.selectedEnergyGrid.properties : null;
  const building = state.selectedBuilding ? state.selectedBuilding.properties : null;
  const scenario = state.data
    ? state.data.scenarioSummary.find((row) => row.scenario_id === state.scenarioId)
    : null;
  const gridContext = selected || opportunity || energyGrid;

  return [
    buildDataAgentStep(prompt, gridContext, building),
    buildKnowledgeAgentStep(gridContext, building),
    buildScenarioAgentStep(gridContext, building),
    buildOptimizationAgentStep(gridContext, scenario),
    buildCriticAgentStep(gridContext, building)
  ];
}

function buildDataAgentStep(prompt, selected, building) {
  const metrics = state.data ? state.data.coreMetrics : {};
  const text = building
    ? `Selected building ${building.bldg_id} is ${building.coarse_function || "unknown function"}, ${building.age_bin || "unknown vintage"}, grid ${building.grid_id || "n/a"}.`
    : selected
      ? selected.energy_building_count
        ? `Energy grid ${selected.grid_id} contains ${formatNumber(selected.energy_building_count, 0)} buildings; active WRF-vs-TMY shift is ${energyFormatValue(selected[energyMetricField()], state.activeEnergyMetric)}.`
        : `Grid ${selected.grid_id} contains ${formatNumber(selected.n_buildings || selected.selected_buildings)} buildings, LCZ ${selected.LCZ_mode || "n/a"}, and ${formatNumber(selected.floor_area_m2, 0)} m2 floor area proxy.`
      : `Shanghai stock contains ${formatNumber(metrics.building_count_in_units)} buildings compressed into ${formatNumber(metrics.optimization_units)} semantic decision units.`;
  return agentStepObject("data", "load_semantic_stock", text, prompt);
}

function buildKnowledgeAgentStep(selected, building) {
  const strategyId = selected && (selected.strategy_id || selected.recommended_strategy_id);
  const strategy = strategyId ? strategyLabel(strategyId) : "formal intervention library";
  const text = selected
    ? selected.energy_building_count
      ? `TMY and WRF representative-week energy records are treated as evidence for sensitivity interpretation and discussion.`
      : `${strategy} is checked against function-vintage applicability and evidence-coded retrofit rules.`
    : `The library holds RAG-grounded retrofit families, costs, applicability and comfort-risk notes.`;
  return agentStepObject("knowledge", "retrieve_policy_constraints", text);
}

function buildScenarioAgentStep(selected, building) {
  const text = selected
    ? selected.energy_building_count
      ? `The Energy view is evidence-only: ${formatNumber(selected.energy_building_count, 0)} building records are aggregated here for TMY-vs-WRF analysis.`
      : selected.strategy_id
      ? `${formatNumber(selected.candidate_units || selected.selected_units)} candidate units were screened in this grid; selected strategy is ${strategyLabel(selected.strategy_id)}.`
      : `${formatNumber(selected.candidate_units)} candidate units were screened in this grid; leading candidate is ${opportunityRecommendationLabel(selected)}.`
    : building
      ? `Building semantics can be promoted into a future what-if candidate through grid + function + vintage + template.`
      : `Candidate rows and feasibility matrix are available for scenario-level interrogation.`;
  return agentStepObject("scenario", "generate_intervention_candidates", text);
}

function buildOptimizationAgentStep(selected, scenario) {
  const text = selected && selected.strategy_id
    ? `NSGA-II selected ${formatNumber(selected.selected_units)} units and ${formatNumber(selected.selected_buildings)} buildings here for ${formatNumber(selected.annual_carbon_reduction_tco2, 1)} tCO2/yr.`
    : selected && selected.energy_building_count
      ? `The selected Energy grid is not an optimization decision. It provides ${state.energy?.seasons?.[state.activeEnergySeason]?.short || state.activeEnergySeason} demand sensitivity evidence for the portfolio discussion.`
    : selected
      ? `This grid remains in the full-city opportunity layer. It is available for candidate reasoning but is not part of the current budget-constrained NSGA-II selection.`
    : scenario
      ? `${scenarioLabel(scenario.scenario_id)} covers ${formatNumber(scenario.selected_buildings)} buildings and reduces ${formatNumber(scenario.annual_carbon_reduction_tco2__cluster_weighted_13_14_25, 1)} tCO2/yr.`
      : `Optimization portfolio is ready for NSGA-II/MILP comparison.`;
  return agentStepObject("optimization", "optimize_retrofit_portfolio", text);
}

function buildCriticAgentStep(selected, building) {
  const text = selected && selected.strategy_id
    ? criticText(selected, null)
    : selected && selected.energy_building_count
      ? `Energy evidence is separated from the retrofit decision layer. Critic checks whether WRF-vs-TMY shifts are interpreted as sensitivity evidence rather than direct retrofit prescriptions.`
    : selected
      ? opportunityCriticText(selected)
    : building
      ? buildingCriticText(building, null)
      : `Standing audit checks budget, strategy concentration, missing evidence, comfort-risk and full-year-baseline anchoring.`;
  const risk = selected && Number(selected.max_microclimate_sensitivity_pct || 0) > 18;
  return agentStepObject("critic", "critic_check_constraints", text, null, risk ? "risk" : "");
}

function agentStepObject(agentKey, tool, text, prompt = null, kind = "") {
  const agent = AGENTS[agentKey];
  return {
    agentKey,
    agent: agent.label,
    tool,
    text,
    prompt,
    output: agent.output,
    kind
  };
}

function renderAgentTrace(steps) {
  const container = document.getElementById("agentTrace");
  if (!container) return;
  state.lastAgentSteps = steps;
  container.innerHTML = steps
    .map((step, index) => {
      const agent = AGENTS[step.agentKey];
      return `
        <div class="trace-step ${step.kind || ""}" style="--agent-color:${agent.color}">
          <div class="trace-index">${index + 1}</div>
          <div>
            <div class="trace-head">
              <strong>${step.agent}</strong>
              <span>${step.tool}</span>
            </div>
            <p>${step.text}</p>
            <em>${step.output}</em>
          </div>
        </div>
      `;
    })
    .join("");
  renderAgentRunState(steps);
}

function renderAgentRunState(steps) {
  const runState = document.getElementById("agentRunState");
  const compact = document.getElementById("agentCompactStatus");
  const evidence = document.getElementById("agentEvidence");
  const guardrails = document.getElementById("agentGuardrails");
  if (!runState || !evidence || !guardrails) return;

  const selected = state.selectedFeature ? state.selectedFeature.properties : null;
  const opportunity = state.selectedOpportunity ? state.selectedOpportunity.properties : null;
  const energyGrid = state.selectedEnergyGrid ? state.selectedEnergyGrid.properties : null;
  const building = state.selectedBuilding ? state.selectedBuilding.properties : null;
  const scenario = state.data
    ? state.data.scenarioSummary.find((row) => row.scenario_id === state.scenarioId)
    : null;
  const prompt = steps.find((step) => step.prompt)?.prompt || "Portfolio inspection";
  const gridContext = selected || opportunity || energyGrid;
  const guardrailRows = buildGuardrailRows(gridContext, building, scenario);
  const riskCount = guardrailRows.filter((row) => row.kind === "risk").length;
  const warnCount = guardrailRows.filter((row) => row.kind === "warn").length;
  const runCards = [
    ["Target", runTargetLabel(gridContext, building)],
    [
      "Mode",
      CONFIG.llm && CONFIG.llm.proxyEndpoint
        ? "DeepSeek proxy + local trace"
        : localStorage.getItem(STORAGE.apiKey)
          ? "browser API key + local trace"
          : "local deterministic trace"
    ],
    ["Handoff", steps.map((step) => AGENTS[step.agentKey].short).join(" -> ")],
    ["Gate", riskCount ? `${riskCount} risk` : warnCount ? `${warnCount} watch` : "clear"]
  ];

  if (compact) {
    compact.innerHTML = `
      <strong>${runTargetLabel(gridContext, building)}</strong>
      <span>Five-agent route: Data -> Knowledge -> Scenario -> Optimization -> Critic. ${riskCount ? `${riskCount} risk flag requires review.` : warnCount ? `${warnCount} watch item is active.` : "No major guardrail risk in the current context."}</span>
    `;
  }

  runState.innerHTML = runCards
    .map(
      ([label, value]) => `
        <div class="agent-state-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `
    )
    .join("");

  const evidenceRows = buildEvidenceRows(prompt, gridContext, building, scenario);
  evidence.innerHTML = evidenceRows
    .map(
      (row) => `
        <div class="lineage-item ${row.kind || ""}">
          <span>${row.label}</span>
          <strong>${row.value}</strong>
        </div>
      `
    )
    .join("");

  guardrails.innerHTML = guardrailRows
    .map(
      (row) => `
        <div class="guardrail-item ${row.kind}">
          <span>${row.label}</span>
          <strong>${row.value}</strong>
        </div>
      `
    )
    .join("");
}

function runTargetLabel(selected, building) {
  if (building) return `Building ${building.bldg_id || "n/a"}`;
  if (selected && selected.energy_building_count) return `Energy grid ${selected.grid_id}`;
  if (selected && !selected.strategy_id && selected.opportunity_status) return `Opportunity grid ${selected.grid_id}`;
  if (selected) return `Grid ${selected.grid_id}`;
  return "Shanghai portfolio";
}

function buildEvidenceRows(prompt, selected, building, scenario) {
  const cfg = CONFIG.buildingTileset || {};
  const examples = selected ? state.data.unitExamplesByGrid[String(selected.grid_id)] || [] : [];
  const tileset = cfg.enabled ? `${String(cfg.sourceUrl || "").replace("mapbox://", "")}` : "disabled";
  return [
    {
      label: "Prompt",
      value: prompt.length > 48 ? `${prompt.slice(0, 48)}...` : prompt
    },
    {
      label: "Building tileset",
      value: cfg.enabled ? `${tileset} / ${cfg.sourceLayer || "source-layer n/a"}` : "not configured",
      kind: cfg.enabled ? "" : "warn"
    },
    {
      label: "Decision evidence",
      value: selected && selected.strategy_id
        ? `${examples.length} unit examples linked`
        : selected && selected.energy_building_count
          ? `${formatNumber(selected.energy_building_count, 0)} building energy records`
        : selected
          ? `${formatNumber(selected.candidate_units)} candidate units screened`
          : "scenario-level metrics",
      kind: selected && selected.strategy_id && !examples.length ? "warn" : ""
    },
    {
      label: "Scenario",
      value: scenario ? scenarioLabel(scenario.scenario_id) : "n/a"
    },
    {
      label: "Building semantics",
      value: building
        ? `${building.coarse_function || "function n/a"} | ${building.thermal_template || "template n/a"}`
        : selected && selected.energy_building_count
          ? `${energyMetricLabel()} evidence layer`
        : selected && !selected.strategy_id
          ? opportunityRecommendationLabel(selected)
          : "grid aggregation"
    }
  ];
}

function buildGuardrailRows(selected, building, scenario) {
  const rows = [];
  const budgetShare = Number(scenario && scenario.largest_strategy_budget_share_pct);
  rows.push({
    label: "Strategy budget cap",
    value: Number.isFinite(budgetShare) ? `${formatNumber(budgetShare, 1)}% largest share` : "scenario n/a",
    kind: Number.isFinite(budgetShare) && budgetShare > 35.1 ? "risk" : "pass"
  });

  const sensitivity = Number(selected && selected.max_microclimate_sensitivity_pct);
  rows.push({
    label: "Microclimate gate",
    value: Number.isFinite(sensitivity) ? `${formatNumber(sensitivity, 1)}% max sensitivity` : "citywide screen",
    kind: Number.isFinite(sensitivity) && sensitivity > 18 ? "risk" : Number.isFinite(sensitivity) && sensitivity > 10 ? "warn" : "pass"
  });

  const confidence = Number(building && building.llm_confidence);
  rows.push({
    label: building ? "Semantic confidence" : selected && !selected.strategy_id ? "Recommended candidate" : "Semantic confidence",
    value: Number.isFinite(confidence)
      ? `${formatNumber(confidence, 2)} LLM score`
      : selected && selected.energy_building_count
        ? energyFormatValue(selected[energyMetricField()], state.activeEnergyMetric)
      : selected && !selected.strategy_id
        ? opportunityRecommendationLabel(selected)
        : "unit mean tracked",
    kind: Number.isFinite(confidence) && confidence < 0.75 ? "risk" : "pass"
  });

  const examples = selected && selected.strategy_id ? state.data.unitExamplesByGrid[String(selected.grid_id)] || [] : [];
  rows.push({
    label: "Evidence coverage",
    value: selected && selected.strategy_id
      ? `${examples.length} selected units`
      : selected && selected.energy_building_count
        ? `${formatNumber(selected.energy_building_count, 0)} building records`
      : selected
        ? `${formatNumber(selected.candidate_units)} candidate units`
        : "portfolio summary",
    kind: selected && selected.strategy_id && !examples.length ? "warn" : "pass"
  });

  return rows;
}

function highlightAgentHotspots(kind = "selected") {
  if (!state.map || !state.map.getLayer("agent-highlight-fill")) return;
  let ids = [];
  if (kind === "hotspots") {
    ids = (state.data.opportunityGeojson || state.data.allocationGeojson).features
      .slice()
      .sort(
        (a, b) =>
          Number(b.properties.candidate_potential_annual_carbon_tco2 || 0) -
          Number(a.properties.candidate_potential_annual_carbon_tco2 || 0)
      )
      .slice(0, 35)
      .map((feature) => Number(feature.properties.grid_id));
  } else if (state.selectedFeature) {
    ids = [Number(state.selectedFeature.properties.grid_id)];
  } else if (state.selectedOpportunity) {
    ids = [Number(state.selectedOpportunity.properties.grid_id)];
  } else if (state.selectedEnergyGrid) {
    ids = [Number(state.selectedEnergyGrid.properties.grid_id)];
  }
  state.map.setFilter("agent-highlight-fill", ["in", ["get", "grid_id"], ["literal", ids]]);
}

function renderModelBenchmark() {
  const rows = state.data.modelBenchmark || [];
  const overall = rows
    .filter((row) => row.task_group === "OVERALL")
    .sort((a, b) => Number(b.mean_score || 0) - Number(a.mean_score || 0));
  const container = document.getElementById("benchmarkExplorer");
  if (!container) return;
  if (!overall.length) {
    container.innerHTML = `<p class="narrative">Model benchmark data are not loaded.</p>`;
    return;
  }
  if (!overall.some((row) => row.model_spec === state.activeBenchmarkModel)) {
    state.activeBenchmarkModel = overall[0].model_spec;
  }
  const active = overall.find((row) => row.model_spec === state.activeBenchmarkModel) || overall[0];
  const maxScore = Math.max(...overall.map((row) => Number(row.mean_score || 0)), 1);
  const taskRows = rows
    .filter((row) => row.model_spec === active.model_spec && row.task_group !== "OVERALL")
    .sort((a, b) => String(a.task_group).localeCompare(String(b.task_group)));

  container.innerHTML = `
    <div class="benchmark-bars">
      ${overall
        .map((row, index) => {
          const width = (Number(row.mean_score || 0) / maxScore) * 100;
          return `
            <button class="benchmark-row ${row.model_spec === active.model_spec ? "active" : ""}" type="button" data-model-spec="${encodeURIComponent(row.model_spec)}">
              <span class="benchmark-row-top">
                <strong>${index + 1}. ${modelShortLabel(row.model_spec)}</strong>
                <span>${formatNumber(row.mean_score, 3)}</span>
              </span>
              <span class="rank-track"><span class="rank-fill" style="width:${width}%"></span></span>
              <span>JSON ${formatNumber(row.parse_valid_rate * 100, 0)}% | ${formatNumber(row.mean_elapsed_sec, 2)} s/case</span>
            </button>
          `;
        })
        .join("")}
    </div>
    <div class="list-item">
      <strong>${modelShortLabel(active.model_spec)} task profile</strong>
      <p>${summarizeModel(active.model_spec)}</p>
      <div class="task-chip-grid">
        ${taskRows
          .map(
            (row) => `
              <div class="task-chip">
                <strong>${taskShortLabel(row.task_group)}</strong>
                score ${formatNumber(row.mean_score, 3)}<br />
                JSON ${formatNumber(row.parse_valid_rate * 100, 0)}%, ${formatNumber(row.mean_elapsed_sec, 2)} s
              </div>
            `
          )
          .join("")}
      </div>
      <button class="wide-button inline-action" type="button" data-model-chat="${encodeURIComponent(active.model_spec)}">Ask OptAgent about this model</button>
    </div>
  `;

  container.querySelectorAll("[data-model-spec]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeBenchmarkModel = decodeURIComponent(button.dataset.modelSpec);
      renderModelBenchmark();
    });
  });
  container.querySelectorAll("[data-model-chat]").forEach((button) => {
    button.addEventListener("click", () => {
      const spec = decodeURIComponent(button.dataset.modelChat);
      const message = `Explain benchmark performance for ${spec}`;
      openAgentModal();
      addChatMessage("user", message);
      addChatMessage("assistant", summarizeModel(spec));
    });
  });
}

function renderArchetypeExplorer() {
  const rows = state.data.archetypeStrategyRankRows || [];
  const matrix = state.data.archetypeStrategyRankMatrix || [];
  const container = document.getElementById("archetypeExplorer");
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = `<p class="narrative">Archetype strategy ranking data are not loaded.</p>`;
    return;
  }
  const ordered = rows
    .slice()
    .sort((a, b) => Number(b.selected_annual_carbon_tco2 || 0) - Number(a.selected_annual_carbon_tco2 || 0))
    .slice(0, 12);
  if (!state.activeArchetypeKey || !ordered.some((row) => row.row_key === state.activeArchetypeKey)) {
    state.activeArchetypeKey = ordered[0].row_key;
  }
  const active = ordered.find((row) => row.row_key === state.activeArchetypeKey) || ordered[0];
  const strategies = matrix
    .filter((row) => row.row_key === active.row_key)
    .sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999));
  const maxCarbon = Math.max(...ordered.map((row) => Number(row.selected_annual_carbon_tco2 || 0)), 1);
  container.innerHTML = `
    <div class="archetype-list">
      ${ordered
        .map((row) => {
          const width = (Number(row.selected_annual_carbon_tco2 || 0) / maxCarbon) * 100;
          return `
            <button class="archetype-row ${row.row_key === active.row_key ? "active" : ""}" type="button" data-archetype-key="${encodeURIComponent(row.row_key)}">
              <span class="archetype-row-top">
                <strong>${escapeHtml(row.fine_function_en || row.refined_function_label || row.row_key)}</strong>
                <span>${formatNumber(row.selected_annual_carbon_tco2, 0)} tCO2/yr</span>
              </span>
              <span class="rank-track"><span class="rank-fill" style="width:${width}%"></span></span>
              <span>${escapeHtml(row.refined_vintage_bin || "vintage n/a")} | ${escapeHtml(row.thermal_template || "template n/a")} | ${formatNumber(row.selected_buildings)} buildings</span>
            </button>
          `;
        })
        .join("")}
    </div>
    <div class="list-item">
      <strong>${escapeHtml(active.fine_function_en || active.refined_function_label || active.row_key)}</strong>
      <p>Candidate strategies are ranked within this refined building archetype. An emphasized chip means at least one selected NSGA-II unit used that strategy.</p>
      <div class="strategy-chip-grid">
        ${strategies
          .map(
            (row) => `
              <div class="strategy-chip ${truthy(row.selected_in_nsga2) ? "selected" : ""}">
                <strong>#${formatNumber(row.rank)} ${strategyLabel(row.strategy_id)}</strong>
                priority ${formatNumber(row.priority_score, 3)}<br />
                candidate ${formatNumber(row.candidate_annual_carbon_tco2, 0)} tCO2/yr
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
  container.querySelectorAll("[data-archetype-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeArchetypeKey = decodeURIComponent(button.dataset.archetypeKey);
      renderArchetypeExplorer();
    });
  });
}

function renderPolicyExplorer() {
  const macc = state.data.policyStrategyMacc || [];
  const fairness = state.data.policyDistrictFairness || [];
  const container = document.getElementById("policyExplorer");
  if (!container) return;
  if (!macc.length) {
    container.innerHTML = `<p class="narrative">Policy translation data are not loaded.</p>`;
    return;
  }
  const strategies = macc
    .slice()
    .sort((a, b) => Number(a.selected_net_macc_rmb_per_tco2 ?? a.net_macc_rmb_per_tco2 ?? 0) - Number(b.selected_net_macc_rmb_per_tco2 ?? b.net_macc_rmb_per_tco2 ?? 0));
  const districts = fairness
    .slice()
    .sort((a, b) => Number(b.selected_annual_carbon_tco2 || 0) - Number(a.selected_annual_carbon_tco2 || 0))
    .slice(0, 5);
  container.innerHTML = `
    <div class="policy-list">
      ${strategies
        .map(
          (row) => `
            <div class="policy-row">
              <span class="policy-row-top">
                <strong>${strategyLabel(row.strategy_id)}</strong>
                <span>${formatCurrency(row.selected_net_macc_rmb_per_tco2 ?? row.net_macc_rmb_per_tco2)} / tCO2</span>
              </span>
              <span>${formatNumber(row.selected_buildings || 0)} selected buildings | ${formatNumber(row.selected_annual_carbon_reduction_tco2 || row.annual_carbon_reduction_tco2, 0)} tCO2/yr</span>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="list-item">
      <strong>Top selected-abatement districts</strong>
      <p>${districts
        .map((row) => `${row.district_label || row.district_name}: ${formatNumber(row.selected_annual_carbon_tco2, 0)} tCO2/yr`)
        .join("; ")}.</p>
    </div>
  `;
}

function modelShortLabel(spec) {
  const labels = {
    "deepseek:deepseek-chat": "DeepSeek-V3",
    "dashscope:qwen-plus-latest": "Qwen-Plus",
    "openai:gpt-4.1-mini": "GPT-4.1 mini",
    "openai:gpt-5.3-chat-latest": "GPT-5.3 Chat",
    "openai:gpt-5.5": "GPT-5.5",
    "openai:gpt-5.5@high": "GPT-5.5 high",
    "anthropic:claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "anthropic:claude-sonnet-4-5-20250929": "Claude Sonnet 4.5",
    "anthropic:claude-opus-4-7": "Claude Opus 4.7",
    "gemini:gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite"
  };
  return labels[spec] || spec;
}

function renderBudgetChart() {
  const rows = state.data.budgetSensitivity || [];
  const valueKey = "annual_carbon_reduction_tco2";
  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0));
  document.getElementById("budgetChart").innerHTML = rows
    .map((row) => {
      const budget = Number(row.budget_rmb || row.budget || 0);
      const value = Number(row[valueKey] || 0);
      const width = max ? (value / max) * 100 : 0;
      return `
        <div class="bar-row">
          <span>${formatBudgetShort(budget)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <span>${formatNumber(value / 1000, 1)} kt</span>
        </div>
      `;
    })
    .join("");
}

function renderLegend() {
  const legend = document.getElementById("legend");
  if (state.colorMetric !== "strategy") {
    legend.innerHTML = `
      <div class="legend-item"><span class="swatch" style="background:#eff4ef"></span><span>Low ${METRIC_LABELS[state.colorMetric]}</span><span></span></div>
      <div class="legend-item"><span class="swatch" style="background:#84b9ad"></span><span>Medium</span><span></span></div>
      <div class="legend-item"><span class="swatch" style="background:#e4b354"></span><span>High</span><span></span></div>
      <div class="legend-item"><span class="swatch" style="background:#bd4a42"></span><span>Highest</span><span></span></div>
    `;
    return;
  }

  const counts = {};
  state.data.allocationGeojson.features.forEach((feature) => {
    const key = feature.properties.strategy_id;
    counts[key] = (counts[key] || 0) + 1;
  });
  legend.innerHTML = Object.entries(counts)
    .map(([key, count]) => {
      const meta = STRATEGIES[key] || { label: key, color: "#8d989d" };
      return `
        <div class="legend-item">
          <span class="swatch" style="background:${meta.color}"></span>
          <span>${meta.label}</span>
          <span>${formatNumber(count)}</span>
        </div>
      `;
    })
    .join("");
}

function selectFeature(feature, lngLat) {
  state.selectedBuilding = null;
  state.selectedOpportunity = null;
  state.selectedMicroclimate = null;
  state.selectedEnergyGrid = null;
  state.selectedFeature = feature;
  const p = feature.properties;

  clearBuildingSelection();
  if (state.map && state.map.getLayer("allocation-selected-line")) {
    state.map.setFilter("allocation-selected-line", [
      "all",
      ["==", ["get", "grid_id"], p.grid_id],
      ["==", ["get", "strategy_id"], p.strategy_id]
    ]);
  }
  if (state.map && state.map.getLayer("opportunity-selected-line")) {
    state.map.setFilter("opportunity-selected-line", ["==", ["get", "grid_id"], -1]);
  }
  if (state.map && state.map.getLayer("energy-grid-selected-line")) {
    state.map.setFilter("energy-grid-selected-line", ["==", ["get", "grid_id"], -1]);
  }

  if (state.popup) state.popup.remove();
  if (state.map && lngLat) {
    state.popup = new mapboxgl.Popup({ closeButton: false, maxWidth: "280px" })
      .setLngLat(lngLat)
      .setHTML(`
        <div class="popup-title">Grid ${p.grid_id} | ${strategyLabel(p.strategy_id)}</div>
        <div class="popup-line">${formatNumber(p.selected_buildings)} selected buildings</div>
        <div class="popup-line">${formatNumber(p.annual_carbon_reduction_tco2, 1)} tCO2/yr</div>
      `)
      .addTo(state.map);
  }

  renderSelected();
  renderAgentWorkbench();
  renderAgentTrace(buildAgentTrace(`Inspect selected grid ${p.grid_id}.`));
  highlightAgentHotspots("selected");
}

function selectOpportunityFeature(feature, lngLat) {
  state.selectedBuilding = null;
  state.selectedFeature = null;
  state.selectedMicroclimate = null;
  state.selectedEnergyGrid = null;
  state.selectedOpportunity = feature;
  const p = feature.properties;
  const gridId = Number(p.grid_id);

  clearBuildingSelection();
  if (state.map && state.map.getLayer("allocation-selected-line")) {
    state.map.setFilter("allocation-selected-line", [
      "==",
      ["get", "grid_id"],
      Number.isFinite(gridId) ? gridId : -1
    ]);
  }
  if (state.map && state.map.getLayer("opportunity-selected-line")) {
    state.map.setFilter("opportunity-selected-line", [
      "==",
      ["get", "grid_id"],
      Number.isFinite(gridId) ? gridId : -1
    ]);
  }
  if (state.map && state.map.getLayer("energy-grid-selected-line")) {
    state.map.setFilter("energy-grid-selected-line", ["==", ["get", "grid_id"], -1]);
  }

  if (state.popup) state.popup.remove();
  if (state.map && lngLat) {
    state.popup = new mapboxgl.Popup({ closeButton: false, maxWidth: "300px" })
      .setLngLat(lngLat)
      .setHTML(`
        <div class="popup-title">Opportunity grid ${p.grid_id}</div>
        <div class="popup-line">${p.opportunity_status || "building stock"} | ${formatNumber(p.n_buildings)} buildings</div>
        <div class="popup-line">${opportunityRecommendationText(p)}</div>
      `)
      .addTo(state.map);
  }

  renderSelectedOpportunity();
  renderAgentWorkbench();
  renderAgentTrace(buildAgentTrace(`Inspect full-city opportunity grid ${p.grid_id}.`));
  highlightAgentHotspots("selected");
}

function selectBuildingFeature(feature, lngLat) {
  const normalizedFeature = {
    ...feature,
    properties: normalizeBuildingProperties(feature.properties || {})
  };
  state.selectedBuilding = normalizedFeature;
  state.selectedOpportunity = null;
  state.selectedMicroclimate = null;
  state.selectedEnergyGrid = null;
  const p = normalizedFeature.properties;
  const gridId = Number(p.grid_id);
  const gridFeature = state.data.allocationGeojson.features.find(
    (item) => Number(item.properties.grid_id) === gridId
  );
  state.selectedFeature = gridFeature || null;

  if (state.map && state.map.getLayer("building-selected-line")) {
    state.map.setFilter("building-selected-line", [
      "any",
      ["==", ["get", "bldg_id"], Number(p.bldg_id)],
      ["==", ["get", "objectid"], Number(p.bldg_id)]
    ]);
  }
  if (state.map && state.map.getLayer("allocation-selected-line")) {
    state.map.setFilter("allocation-selected-line", [
      "==",
      ["get", "grid_id"],
      Number.isFinite(gridId) ? gridId : -1
    ]);
  }
  if (state.map && state.map.getLayer("energy-grid-selected-line")) {
    state.map.setFilter("energy-grid-selected-line", ["==", ["get", "grid_id"], -1]);
  }

  if (state.popup) state.popup.remove();
  if (state.map && lngLat) {
    state.popup = new mapboxgl.Popup({ closeButton: false, maxWidth: "300px" })
      .setLngLat(lngLat)
      .setHTML(`
        <div class="popup-title">Building ${p.bldg_id || "unknown"}</div>
        <div class="popup-line">${p.coarse_function || "Function unknown"} | ${p.age_bin || "age unknown"}</div>
        <div class="popup-line">Grid ${p.grid_id || "n/a"} | ${p.thermal_template || "template n/a"}</div>
      `)
      .addTo(state.map);
  }

  renderSelectedBuilding();
  hydrateSelectedBuildingEnergy(p.bldg_id);
  renderAgentWorkbench();
  renderAgentTrace(buildAgentTrace(`Inspect selected building ${p.bldg_id}.`));
  highlightAgentHotspots("selected");
}

function selectMicroclimateFeature(feature, lngLat) {
  state.selectedMicroclimate = feature;
  state.selectedBuilding = null;
  state.selectedFeature = null;
  state.selectedOpportunity = null;
  state.selectedEnergyGrid = null;
  const p = feature.properties;
  const gridId = Number(p.grid_id);

  clearBuildingSelection();
  if (state.map && state.map.getLayer("allocation-selected-line")) {
    state.map.setFilter("allocation-selected-line", ["==", ["get", "grid_id"], -1]);
  }
  if (state.map && state.map.getLayer("opportunity-selected-line")) {
    state.map.setFilter("opportunity-selected-line", ["==", ["get", "grid_id"], -1]);
  }
  if (state.map && state.map.getLayer("microclimate-selected-line")) {
    state.map.setFilter("microclimate-selected-line", [
      "==",
      ["get", "grid_id"],
      Number.isFinite(gridId) ? gridId : -1
    ]);
  }
  if (state.map && state.map.getLayer("energy-grid-selected-line")) {
    state.map.setFilter("energy-grid-selected-line", ["==", ["get", "grid_id"], -1]);
  }

  if (state.popup) state.popup.remove();
  if (state.map && lngLat) {
    const field = microclimateMetricField();
    const metric = MICRO_METRICS[state.activeMicroMetric] || MICRO_METRICS.sensitivity;
    state.popup = new mapboxgl.Popup({ closeButton: false, maxWidth: "300px" })
      .setLngLat(lngLat)
      .setHTML(`
        <div class="popup-title">Microclimate grid ${p.grid_id}</div>
        <div class="popup-line">${microclimateMetricLabel()}: ${formatNumber(p[field], 2)} ${metric.unit}</div>
        <div class="popup-line">${p.LCZ_label || "LCZ n/a"} | ${formatNumber(p.n_buildings)} buildings</div>
      `)
      .addTo(state.map);
  }

  renderSelectedMicroclimate();
  renderAgentWorkbench();
  renderAgentTrace(buildAgentTrace(`Inspect microclimate grid ${p.grid_id}.`));
}

function selectEnergyGridFeature(feature, lngLat) {
  state.selectedEnergyGrid = feature;
  state.selectedMicroclimate = null;
  state.selectedBuilding = null;
  state.selectedFeature = null;
  state.selectedOpportunity = null;
  const p = feature.properties;
  const gridId = Number(p.grid_id);

  clearBuildingSelection();
  if (state.map && state.map.getLayer("allocation-selected-line")) {
    state.map.setFilter("allocation-selected-line", ["==", ["get", "grid_id"], -1]);
  }
  if (state.map && state.map.getLayer("opportunity-selected-line")) {
    state.map.setFilter("opportunity-selected-line", ["==", ["get", "grid_id"], -1]);
  }
  if (state.map && state.map.getLayer("microclimate-selected-line")) {
    state.map.setFilter("microclimate-selected-line", ["==", ["get", "grid_id"], -1]);
  }
  if (state.map && state.map.getLayer("energy-grid-selected-line")) {
    state.map.setFilter("energy-grid-selected-line", [
      "==",
      ["get", "grid_id"],
      Number.isFinite(gridId) ? gridId : -1
    ]);
  }

  if (state.popup) state.popup.remove();
  if (state.map && lngLat) {
    const field = energyMetricField();
    state.popup = new mapboxgl.Popup({ closeButton: false, maxWidth: "310px" })
      .setLngLat(lngLat)
      .setHTML(`
        <div class="popup-title">Energy grid ${p.grid_id}</div>
        <div class="popup-line">${energyMetricLabel()}: ${energyFormatValue(p[field], state.activeEnergyMetric)}</div>
        <div class="popup-line">${formatNumber(p.energy_building_count, 0)} buildings | ${p.LCZ_label || "LCZ n/a"}</div>
      `)
      .addTo(state.map);
  }

  renderSelectedEnergyGrid();
  renderEnergyPanel();
  renderAgentWorkbench();
  renderAgentTrace(buildAgentTrace(`Inspect energy grid ${p.grid_id}.`));
}

function clearBuildingSelection() {
  if (state.map && state.map.getLayer("building-selected-line")) {
    state.map.setFilter("building-selected-line", [
      "any",
      ["==", ["get", "bldg_id"], -1],
      ["==", ["get", "objectid"], -1]
    ]);
  }
}

function normalizeBuildingProperties(raw) {
  return {
    ...raw,
    bldg_id: raw.bldg_id ?? raw.objectid,
    coarse_function: raw.coarse_function ?? raw.building_type,
    fine_function: raw.fine_function,
    age_bin: raw.age_bin ?? raw.final_year,
    llm_confidence: raw.llm_confidence ?? raw.ml_probability,
    height_m: raw.height_m,
    footprint_m2: raw.footprint_m2,
    thermal_template: raw.thermal_template,
    grid_id: raw.grid_id,
    center_lon: raw.center_lon,
    center_lat: raw.center_lat
  };
}

function renderEmptySelection() {
  state.selectedMicroclimate = null;
  document.getElementById("selectedSummary").innerHTML = `
    <p class="narrative">Click a selected allocation grid, a full-city opportunity grid, a 3D building, a microclimate 500 m grid, or an energy 500 m grid. The critic agent panel will switch between portfolio, candidate, building-level, WRF/LCZ, and TMY-vs-WRF energy evidence.</p>
  `;
  document.getElementById("agentSteps").innerHTML = "";
  document.getElementById("unitExamples").innerHTML = "";
}

function renderSelectedMicroclimate() {
  const p = state.selectedMicroclimate.properties;
  const season = state.activeMicroSeason;
  document.getElementById("selectedTitle").textContent = `Microclimate grid ${p.grid_id}`;
  document.getElementById("selectedSummary").innerHTML = `
    <div class="summary-grid">
      <div class="summary-tile"><strong>${formatNumber(p[`sensitivity_${season}_pct`], 1)}%</strong><span>LCZ sensitivity</span></div>
      <div class="summary-tile"><strong>${formatNumber(p[`wrf_${season}_temp_mean`], 1)} C</strong><span>WRF mean T2</span></div>
      <div class="summary-tile"><strong>${formatNumber(p[`wrf_${season}_rh_mean`], 1)}%</strong><span>WRF mean RH</span></div>
      <div class="summary-tile"><strong>${formatNumber(p[`wrf_${season}_solar_mean`], 1)}</strong><span>mean W/m2</span></div>
      <div class="summary-tile"><strong>${formatNumber(p[`wrf_${season}_wind_mean`], 2)}</strong><span>mean m/s</span></div>
      <div class="summary-tile"><strong>${p.LCZ_label || p.lcz_mode || "LCZ"}</strong><span>dominant LCZ</span></div>
    </div>
  `;
  document.getElementById("agentSteps").innerHTML = `
    <div class="agent-step">
      <h3>Data Agent: WRF grid evidence</h3>
      <p>This 500 m cell is read from representative-week WRF summaries and joined to the Shanghai opportunity grid geometry.</p>
    </div>
    <div class="agent-step">
      <h3>Knowledge Agent: LCZ sensitivity</h3>
      <p>Seasonal sensitivity is ${formatNumber(p[`sensitivity_${season}_pct`], 1)}%, with dominant ${p.LCZ_label || "LCZ n/a"} and purity ${formatNumber(p.LCZ_purity, 1)}%.</p>
    </div>
    <div class="agent-step warning">
      <h3>Critic Agent: interpretation boundary</h3>
      <p>This layer explains microclimate exposure and energy sensitivity. It is evidence for the retrofit optimizer, not itself a selected portfolio decision.</p>
    </div>
  `;
  document.getElementById("unitExamples").innerHTML = `
    <div class="section-title">Representative-week fields</div>
    <div class="unit-card">
      <p>${microclimateMetricLabel()} currently colors the map. Ask OptAgent to compare this grid with the selected retrofit allocation or explain the WRF-to-energy pathway.</p>
      <div class="tag-row">
        <span class="tag">Grid ${p.grid_id}</span>
        <span class="tag">${state.microclimate.seasons[season]?.short || season}</span>
        <span class="tag">${p.LCZ_label || "LCZ n/a"}</span>
        <span class="tag">${formatNumber(p.n_buildings)} buildings</span>
      </div>
    </div>
  `;
}

function renderSelectedEnergyGrid() {
  const p = state.selectedEnergyGrid.properties;
  const season = state.activeEnergySeason;
  document.getElementById("selectedTitle").textContent = `Energy grid ${p.grid_id}`;
  document.getElementById("selectedSummary").innerHTML = `
    <div class="summary-grid">
      <div class="summary-tile"><strong>${energyFormatValue(p[`${season}_diff_pct`], "diff_pct")}</strong><span>WRF-vs-TMY difference</span></div>
      <div class="summary-tile"><strong>${energyFormatValue(p[`${season}_tmy_kwh`], "tmy_kwh")}</strong><span>TMY week energy</span></div>
      <div class="summary-tile"><strong>${energyFormatValue(p[`${season}_wrf_kwh`], "wrf_kwh")}</strong><span>WRF week energy</span></div>
      <div class="summary-tile"><strong>${energyFormatValue(p[`${season}_delta_kwh`], "delta_kwh")}</strong><span>absolute shift</span></div>
      <div class="summary-tile"><strong>${formatNumber(p.energy_building_count, 0)}</strong><span>buildings</span></div>
      <div class="summary-tile"><strong>${p.LCZ_label || "LCZ"}</strong><span>dominant LCZ</span></div>
    </div>
  `;
  document.getElementById("agentSteps").innerHTML = `
    <div class="agent-step">
      <h3>Data Agent: energy aggregation</h3>
      <p>This 500 m grid sums single-building representative-week TMY and WRF/microclimate energy records, then derives the percentage shift.</p>
    </div>
    <div class="agent-step">
      <h3>Knowledge Agent: weather pathway</h3>
      <p>${state.energy.seasons[season]?.short || season} WRF energy is ${energyFormatValue(p[`${season}_wrf_kwh`], "wrf_kwh")} compared with ${energyFormatValue(p[`${season}_tmy_kwh`], "tmy_kwh")} under TMY.</p>
    </div>
    <div class="agent-step ${Math.abs(Number(p[`${season}_diff_pct`] || 0)) > 10 ? "warning" : ""}">
      <h3>Critic Agent: interpretation boundary</h3>
      <p>Use this layer to explain microclimate-energy sensitivity. It does not replace the NSGA-II retrofit allocation; it supplies evidence that the optimization and discussion can reference.</p>
    </div>
  `;
  document.getElementById("unitExamples").innerHTML = `
    <div class="section-title">Energy evidence</div>
    <div class="unit-card">
      <p>${energyMetricLabel()} currently colors the Energy grid layer. Switch to building mode and click a 3D footprint for exact single-building records.</p>
      <div class="tag-row">
        <span class="tag">Grid ${p.grid_id}</span>
        <span class="tag">${state.energy.seasons[season]?.short || season}</span>
        <span class="tag">${formatNumber(p.energy_building_count, 0)} buildings</span>
        <span class="tag">${energyFormatValue(p[`${season}_diff_pct`], "diff_pct")}</span>
      </div>
    </div>
  `;
}

function renderSelected() {
  const p = state.selectedFeature.properties;
  document.getElementById("selectedTitle").textContent = `Grid ${p.grid_id} | ${strategyLabel(p.strategy_id)}`;
  document.getElementById("selectedSummary").innerHTML = `
    <div class="summary-grid">
      <div class="summary-tile"><strong>${formatNumber(p.selected_buildings)}</strong><span>selected buildings</span></div>
      <div class="summary-tile"><strong>${formatNumber(p.selected_units)}</strong><span>selected units</span></div>
      <div class="summary-tile"><strong>${formatNumber(p.annual_carbon_reduction_tco2, 1)}</strong><span>tCO2/yr reduction</span></div>
      <div class="summary-tile"><strong>${formatCurrency(p.cost_rmb)}</strong><span>portfolio cost</span></div>
      <div class="summary-tile"><strong>${formatNumber(p.max_microclimate_sensitivity_pct, 1)}%</strong><span>max sensitivity</span></div>
      <div class="summary-tile"><strong>${p.LCZ_label || p.lcz_label_for_plot || "LCZ"}</strong><span>dominant LCZ</span></div>
    </div>
  `;

  renderAgentSteps(p);
  renderUnitExamples(p.grid_id);
}

function renderSelectedOpportunity() {
  const p = state.selectedOpportunity.properties;
  const recommendation = opportunityRecommendationLabel(p);
  const recommendationText = opportunityRecommendationText(p);
  document.getElementById("selectedTitle").textContent = `Opportunity grid ${p.grid_id}`;
  document.getElementById("selectedSummary").innerHTML = `
    <div class="summary-grid">
      <div class="summary-tile"><strong>${formatNumber(p.n_buildings)}</strong><span>stock buildings</span></div>
      <div class="summary-tile"><strong>${formatNumber(p.candidate_units)}</strong><span>candidate units</span></div>
      <div class="summary-tile"><strong>${formatNumber(p.candidate_potential_annual_carbon_tco2, 1)}</strong><span>candidate tCO2/yr</span></div>
      <div class="summary-tile"><strong>${recommendation}</strong><span>recommended candidate</span></div>
      <div class="summary-tile"><strong>${formatNumber(p.recommended_annual_carbon_tco2, 1)}</strong><span>recommended tCO2/yr</span></div>
      <div class="summary-tile"><strong>${formatCurrency(p.recommended_rmb_per_tco2)}</strong><span>RMB per tCO2/yr</span></div>
      <div class="summary-tile"><strong>${p.opportunity_status || "building stock"}</strong><span>portfolio status</span></div>
    </div>
  `;

  document.getElementById("agentSteps").innerHTML = `
    <div class="agent-step">
      <h3>Data Agent: citywide stock context</h3>
      <p>This 500 m grid is part of the full-city building-stock layer, not only the sparse NSGA-II selected portfolio.</p>
    </div>
    <div class="agent-step">
      <h3>Scenario Agent: candidate recommendation</h3>
      <p>${recommendationText}. The full candidate supply in this grid is ${formatNumber(p.candidate_potential_annual_carbon_tco2, 1)} tCO2/yr before portfolio selection.</p>
    </div>
    <div class="agent-step warning">
      <h3>Critic Agent: why not selected</h3>
      <p>The selected allocation is budget constrained. A grid can have buildings or candidate potential and still be outside the current scenario if other units dominate under cost, carbon, coverage, microclimate and strategy-share constraints.</p>
    </div>
  `;
  document.getElementById("unitExamples").innerHTML = `
    <div class="section-title">Full-city interpretation</div>
    <div class="unit-card">
      <p>Use this layer to discuss citywide opportunity coverage. Use the selected allocation overlay to discuss what the NSGA-II portfolio actually chooses under the current scenario.</p>
      <div class="tag-row">
        <span class="tag">Grid ${p.grid_id}</span>
        <span class="tag">${p.opportunity_status || "building stock"}</span>
        <span class="tag">${recommendation}</span>
        <span class="tag">${formatNumber(p.n_buildings)} buildings</span>
      </div>
    </div>
  `;
}

function opportunityRecommendationLabel(p) {
  if (p.strategy_id) return strategyLabel(p.strategy_id);
  if (p.recommended_strategy_id) return strategyLabel(p.recommended_strategy_id);
  if (p.recommended_strategy_name) return p.recommended_strategy_name;
  return "No feasible candidate";
}

function opportunityRecommendationText(p) {
  const label = opportunityRecommendationLabel(p);
  const carbon = Number(p.recommended_annual_carbon_tco2);
  if (Number.isFinite(carbon) && carbon > 0) {
    return `${label}: ${formatNumber(carbon, 1)} tCO2/yr at ${formatCurrency(p.recommended_rmb_per_tco2)} per tCO2/yr`;
  }
  const potential = Number(p.candidate_potential_annual_carbon_tco2);
  if (Number.isFinite(potential) && potential > 0) {
    return `${label}: ${formatNumber(potential, 1)} tCO2/yr candidate potential`;
  }
  return "No feasible retrofit candidate is loaded for this grid";
}

function renderSelectedBuilding() {
  const p = state.selectedBuilding.properties;
  const grid = state.selectedFeature ? state.selectedFeature.properties : null;
  const energy = cachedBuildingEnergyRecord(p.bldg_id);
  const season = state.activeEnergySeason;
  const energyTiles = energy
    ? `
      <div class="summary-tile"><strong>${energyFormatValue(energy[`${season}_diff_pct`], "diff_pct")}</strong><span>${state.energy?.seasons?.[season]?.short || season} WRF-vs-TMY</span></div>
      <div class="summary-tile"><strong>${energyFormatValue(energy[`${season}_tmy_kwh`], "tmy_kwh")}</strong><span>TMY week energy</span></div>
      <div class="summary-tile"><strong>${energyFormatValue(energy[`${season}_wrf_kwh`], "wrf_kwh")}</strong><span>WRF week energy</span></div>
    `
    : state.energyPromise || state.energy
      ? `<div class="summary-tile"><strong>Loading</strong><span>building energy shard</span></div>`
      : "";
  document.getElementById("selectedTitle").textContent = `Building ${p.bldg_id || "unknown"}`;
  document.getElementById("selectedSummary").innerHTML = `
    <div class="summary-grid">
      <div class="summary-tile"><strong>${p.coarse_function || "n/a"}</strong><span>refined function</span></div>
      <div class="summary-tile"><strong>${p.age_bin || "n/a"}</strong><span>age bin</span></div>
      <div class="summary-tile"><strong>${p.thermal_template || "n/a"}</strong><span>thermal template</span></div>
      <div class="summary-tile"><strong>${formatNumber(p.llm_confidence, 2)}</strong><span>LLM confidence</span></div>
      <div class="summary-tile"><strong>${formatNumber(p.height_m, 1)} m</strong><span>height</span></div>
      <div class="summary-tile"><strong>${formatNumber(p.footprint_m2, 0)} m2</strong><span>footprint</span></div>
      ${energyTiles}
    </div>
  `;

  const gridText = grid
    ? `This building belongs to selected grid ${grid.grid_id}, where the portfolio chooses ${strategyLabel(grid.strategy_id)} for ${formatNumber(grid.selected_buildings)} buildings and ${formatNumber(grid.annual_carbon_reduction_tco2, 1)} tCO2/yr.`
    : "This building's grid is not part of the selected NSGA-II allocation layer; it can still be used for semantic inspection and future what-if candidate generation.";

  document.getElementById("agentSteps").innerHTML = `
    <div class="agent-step">
      <h3>Data Agent: building semantics</h3>
      <p>${p.fine_function || p.coarse_function || "Unknown refined function"}; source function ${p.coarse_function || "n/a"}; vintage ${p.age_bin || "n/a"}.${energy ? ` ${state.energy?.seasons?.[season]?.short || season} energy shift is ${energyFormatValue(energy[`${season}_diff_pct`], "diff_pct")}.` : ""}</p>
    </div>
    <div class="agent-step">
      <h3>Decision-unit linkage</h3>
      <p>${gridText}</p>
    </div>
    <div class="agent-step ${Number(p.llm_confidence) < 0.75 ? "warning" : ""}">
      <h3>Critic Agent: semantic confidence</h3>
      <p>${buildingCriticText(p, grid)}</p>
    </div>
  `;

  document.getElementById("unitExamples").innerHTML = `
    <div class="section-title">Semantic reasoning</div>
    <div class="unit-card">
      <p>${p.fine_function || p.coarse_function || "This building"} is bound to a semantic decision unit through grid, refined function, vintage and thermal template. ${energy ? `The Energy shard adds exact representative-week TMY ${energyFormatValue(energy[`${season}_tmy_kwh`], "tmy_kwh")} and WRF ${energyFormatValue(energy[`${season}_wrf_kwh`], "wrf_kwh")}.` : "The Energy shard will add exact representative-week values after it loads."}</p>
      <div class="tag-row">
        <span class="tag">Grid ${p.grid_id || "n/a"}</span>
        <span class="tag">${p.thermal_template || "template n/a"}</span>
        <span class="tag">${formatNumber(p.llm_confidence, 2)} confidence</span>
        ${energy ? `<span class="tag">${energyFormatValue(energy[`${season}_diff_pct`], "diff_pct")}</span>` : ""}
      </div>
    </div>
  `;
}

function buildingCriticText(p, grid) {
  const confidence = Number(p.llm_confidence);
  const parts = [];
  if (Number.isFinite(confidence) && confidence < 0.75) {
    parts.push("Semantic confidence is below the usual threshold; expert review or POI evidence check is recommended before using this building for high-cost retrofit decisions.");
  } else {
    parts.push("Semantic confidence is acceptable for decision-unit aggregation.");
  }
  if (grid) {
    parts.push(`Grid-level selected strategy is ${strategyLabel(grid.strategy_id)}, so building-level interpretation should be treated as evidence for a grid/unit portfolio decision rather than a direct single-building prescription.`);
  }
  return parts.join(" ");
}

function renderAgentSteps(p) {
  const potential = Number(p.candidate_potential_annual_carbon_tco2 || 0);
  const actual = Number(p.annual_carbon_reduction_tco2 || 0);
  const capture = potential ? (actual / potential) * 100 : null;
  const sensitivity = Number(p.max_microclimate_sensitivity_pct || 0);
  const strategy = STRATEGIES[p.strategy_id] || { audit: "Strategy-level audit is available after intervention metadata is configured." };

  const steps = [
    {
      title: "Data Agent: decision-unit context",
      text: `${formatNumber(p.n_buildings || p.selected_buildings)} buildings in this grid, ${formatNumber(p.floor_area_m2, 0)} m2 floor area proxy, ${p.LCZ_label || "LCZ unavailable"}.`
    },
    {
      title: "Knowledge Agent: intervention constraint",
      text: strategy.audit
    },
    {
      title: "Optimization Agent: portfolio decision",
      text: `Selected ${formatNumber(p.selected_units)} units for ${strategyLabel(p.strategy_id)}, reducing ${formatNumber(actual, 1)} tCO2/yr at ${formatCurrency(p.cost_rmb)} cost.`
    },
    {
      title: "Critic Agent: audit flags",
      kind: sensitivity > 18 ? "risk" : sensitivity > 10 ? "warning" : "",
      text: criticText(p, capture)
    }
  ];

  document.getElementById("agentSteps").innerHTML = steps
    .map(
      (step) => `
        <div class="agent-step ${step.kind || ""}">
          <h3>${step.title}</h3>
          <p>${step.text}</p>
        </div>
      `
    )
    .join("");
}

function criticText(p, capture) {
  const parts = [];
  const sensitivity = Number(p.max_microclimate_sensitivity_pct || 0);
  if (sensitivity > 18) {
    parts.push("High microclimate sensitivity; prioritize comfort-risk checks before scaling similar interventions.");
  } else if (sensitivity > 10) {
    parts.push("Moderate to high microclimate sensitivity; keep the WRF-MUBEM trace in the evidence chain.");
  } else {
    parts.push("Microclimate sensitivity is not an outlier for the selected portfolio.");
  }
  if (capture !== null) {
    parts.push(`The selected allocation captures ${formatNumber(capture, 1)}% of candidate annual carbon potential in this grid.`);
  }
  if (p.strategy_id === "cool_roof") {
    parts.push("Check winter heating penalty and LCZ roof exposure.");
  }
  if (p.strategy_id === "rooftop_pv") {
    parts.push("Check roof area assumptions and PV annualization against full-year baseline anchoring.");
  }
  return parts.join(" ");
}

function opportunityCriticText(p) {
  const parts = [];
  const potential = Number(p.candidate_potential_annual_carbon_tco2);
  const recommended = Number(p.recommended_annual_carbon_tco2);
  if (Number.isFinite(recommended) && recommended > 0) {
    parts.push(`Best loaded candidate is ${opportunityRecommendationText(p)}.`);
  } else if (Number.isFinite(potential) && potential > 0) {
    parts.push(`The grid has ${formatNumber(potential, 1)} tCO2/yr candidate potential, but no single recommended strategy was resolved in the compact platform extract.`);
  } else {
    parts.push("The grid is retained for citywide building-stock context, but it has no feasible candidate potential in the loaded S3 candidate table.");
  }
  parts.push("It can still be outside the selected scenario because the optimization chooses a budget-limited subset across all candidate units.");
  return parts.join(" ");
}

function renderUnitExamples(gridId) {
  const examples = state.data.unitExamplesByGrid[String(gridId)] || [];
  const container = document.getElementById("unitExamples");
  if (!examples.length) {
    container.innerHTML = `<p class="narrative">No selected unit examples are available for this grid.</p>`;
    return;
  }
  container.innerHTML =
    `<div class="section-title">Representative selected units</div>` +
    examples
      .map((unit) => {
        return `
          <div class="unit-card">
            <h3>${unit.strategy_name || strategyLabel(unit.strategy_id)}</h3>
            <p>${unit.refined_function_label || unit.function_used_label || "Function unknown"} | ${unit.refined_vintage || "vintage unknown"} | ${unit.thermal_template || "template unknown"}</p>
            <p>${formatNumber(unit.building_count)} buildings; ${formatNumber(unit.annual_carbon_reduction_tco2__cluster_weighted_13_14_25, 1)} tCO2/yr; confidence ${formatNumber(unit.mean_llm_confidence, 2)}.</p>
            <div class="tag-row">
              <span class="tag">${unit.feasibility_reason || "feasible"}</span>
              <span class="tag">${unit.evidence_code || "trace"}</span>
            </div>
          </div>
        `;
      })
      .join("");
}

function focus3DBuildings() {
  if (!state.map) return;
  const target = state.selectedBuilding
    ? [Number(state.selectedBuilding.properties.center_lon), Number(state.selectedBuilding.properties.center_lat)]
    : featureCenter(state.selectedFeature || state.selectedOpportunity || state.selectedEnergyGrid) || [121.4737, 31.2304];
  state.map.easeTo({
    center: target.every(Number.isFinite) ? target : [121.4737, 31.2304],
    zoom: Math.max(state.map.getZoom(), 14.2),
    pitch: 62,
    bearing: -22,
    duration: 800
  });
  updateBuildingStatus();
}

function updateBuildingStatus() {
  const node = document.getElementById("buildingStatus");
  if (!node || !state.map) return;
  const cfg = CONFIG.buildingTileset || {};
  if (!cfg.enabled) {
    node.textContent = "3D buildings disabled";
    return;
  }
  if (state.buildingLayerError) {
    node.textContent = "3D buildings tileset error";
    node.title = state.buildingLayerError;
    return;
  }
  if (!state.map.getLayer("building-fill")) {
    node.textContent = state.map.loaded() ? "3D buildings source pending" : "3D buildings loading";
    return;
  }
  const minzoom = cfg.minzoom || 11;
  if (state.map.getZoom() < minzoom) {
    node.textContent = `Zoom to z${formatNumber(minzoom, 1)} for 3D buildings`;
    node.title = "The layer is loaded; building extrusions are hidden below the configured minimum zoom.";
    return;
  }
  const features = state.map.queryRenderedFeatures({ layers: ["building-fill"] });
  node.title = "";
  node.textContent = features.length
    ? `3D buildings: ${formatNumber(features.length)} visible`
    : "3D buildings ready; move over Shanghai";
}

function fitAllocation() {
  if (!state.map || !state.data) return;
  const bounds = featureCollectionBounds(state.data.opportunityGeojson || state.data.allocationGeojson);
  if (bounds) state.map.fitBounds(bounds, { padding: 48, duration: 700 });
}

function zoomSelected() {
  const feature = state.selectedFeature || state.selectedOpportunity || state.selectedEnergyGrid || state.selectedMicroclimate;
  if (state.selectedBuilding) {
    focus3DBuildings();
    return;
  }
  if (!feature) {
    fitAllocation();
    return;
  }
  zoomToFeature(feature);
}

function zoomToFeature(feature) {
  if (!state.map) return;
  const bounds = featureBounds(feature);
  if (bounds) state.map.fitBounds(bounds, { padding: 90, duration: 700, maxZoom: 14.5, pitch: 58, bearing: -18 });
}

function featureCenter(feature) {
  if (!feature) return null;
  const bounds = featureBounds(feature);
  if (!bounds) return null;
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
}

function featureCollectionBounds(collection) {
  let bounds = null;
  collection.features.forEach((feature) => {
    bounds = extendBounds(bounds, featureBounds(feature));
  });
  return bounds;
}

function featureBounds(feature) {
  const coords = [];
  walkCoordinates(feature.geometry.coordinates, coords);
  if (!coords.length) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  coords.forEach(([lng, lat]) => {
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  });
  return [
    [west, south],
    [east, north]
  ];
}

function walkCoordinates(value, out) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    out.push(value);
    return;
  }
  value.forEach((item) => walkCoordinates(item, out));
}

function extendBounds(a, b) {
  if (!b) return a;
  if (!a) return b;
  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])]
  ];
}

function wireChat() {
  document.getElementById("closeAgentModal").addEventListener("click", closeAgentModal);
  document.getElementById("agentModalBackdrop").addEventListener("click", closeAgentModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAgentModal();
  });
  document.getElementById("saveApiSettings").addEventListener("click", saveApiSettings);
  document.querySelectorAll("[data-agent-prompt]").forEach((button) => {
    button.addEventListener("click", async () => {
      const prompt = button.dataset.agentPrompt;
      addChatMessage("user", prompt);
      renderAgentTrace(buildAgentTrace(prompt));
      if (prompt.toLowerCase().includes("hotspot")) {
        highlightAgentHotspots("hotspots");
      } else {
        highlightAgentHotspots("selected");
      }
      const reply = await answerQuestion(prompt);
      addChatMessage("assistant", reply);
    });
  });
  document.getElementById("chatForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("chatInput");
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    addChatMessage("user", message);
    renderAgentTrace(buildAgentTrace(message));
    if (message.toLowerCase().includes("hotspot")) {
      highlightAgentHotspots("hotspots");
    }
    const reply = await answerQuestion(message);
    addChatMessage("assistant", reply);
  });
  addChatMessage(
    "assistant",
    "Select a building, opportunity grid, or selected allocation grid, then ask about retrofit priority, constraints, budget sensitivity, semantic confidence, or the 10-model benchmark. If no secure proxy is configured, I use a deterministic local agent over the loaded research data."
  );
}

function openAgentModal() {
  const modal = document.getElementById("agentModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  const input = document.getElementById("chatInput");
  if (input) input.focus();
}

function closeAgentModal() {
  const modal = document.getElementById("agentModal");
  if (modal) modal.classList.add("hidden");
}

function restoreApiSettings() {
  document.getElementById("apiKeyInput").value = localStorage.getItem(STORAGE.apiKey) || "";
  document.getElementById("apiEndpointInput").value =
    localStorage.getItem(STORAGE.apiEndpoint) || (CONFIG.llm && CONFIG.llm.endpoint) || "";
  document.getElementById("apiModelInput").value =
    localStorage.getItem(STORAGE.apiModel) || (CONFIG.llm && CONFIG.llm.model) || "";
}

function saveApiSettings() {
  localStorage.setItem(STORAGE.apiKey, document.getElementById("apiKeyInput").value.trim());
  localStorage.setItem(STORAGE.apiEndpoint, document.getElementById("apiEndpointInput").value.trim());
  localStorage.setItem(STORAGE.apiModel, document.getElementById("apiModelInput").value.trim());
  addChatMessage("assistant", "Settings saved in this browser. The API key is not committed to the repository.");
}

async function answerQuestion(message) {
  const proxyEndpoint = CONFIG.llm && CONFIG.llm.proxyEndpoint;
  const model = localStorage.getItem(STORAGE.apiModel) || (CONFIG.llm && CONFIG.llm.model);
  if (proxyEndpoint && model) {
    try {
      return await callAgentProxy(message, proxyEndpoint, model);
    } catch (error) {
      return `The secure agent proxy failed, so I fell back to the local agent. ${localAgentAnswer(message)}`;
    }
  }
  const apiKey = localStorage.getItem(STORAGE.apiKey);
  const endpoint = localStorage.getItem(STORAGE.apiEndpoint);
  if (apiKey && endpoint && model) {
    try {
      return await callRemoteModel(message, apiKey, endpoint, model);
    } catch (error) {
      return `The remote model call failed, so I fell back to the local agent. ${localAgentAnswer(message)}`;
    }
  }
  return localAgentAnswer(message);
}

async function callAgentProxy(message, endpoint, model) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      message,
      context: buildContextPrompt()
    })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = await response.json();
  return json.answer || json.content || json.message || "The agent proxy returned no readable answer.";
}

async function callRemoteModel(message, apiKey, endpoint, model) {
  const context = buildContextPrompt();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a Shanghai urban building decarbonization agent operating inside a five-agent workbench: Data, Knowledge, Scenario, Optimization, and Critic. Answer using the supplied research data, trace, evidence lineage, and guardrails only. Be concise, quantitative, and explicit about uncertainty."
        },
        { role: "user", content: `${context}\n\nUser question: ${message}` }
      ],
      temperature: 0.2
    })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = await response.json();
  return json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content
    : "The model returned no readable answer.";
}

function buildContextPrompt() {
  const metrics = state.data.coreMetrics;
  const selected = state.selectedFeature ? state.selectedFeature.properties : null;
  const opportunity = state.selectedOpportunity ? state.selectedOpportunity.properties : null;
  const building = state.selectedBuilding ? state.selectedBuilding.properties : null;
  const microclimate = state.selectedMicroclimate ? state.selectedMicroclimate.properties : null;
  const energyGrid = state.selectedEnergyGrid ? state.selectedEnergyGrid.properties : null;
  const buildingEnergy = building ? cachedBuildingEnergyRecord(building.bldg_id) : null;
  const scenario = state.data.scenarioSummary.find((row) => row.scenario_id === state.scenarioId);
  const trace = state.lastAgentSteps || buildAgentTrace("Current agent run");
  const gridContext = selected || opportunity || energyGrid;
  return JSON.stringify(
    {
      coreMetrics: metrics,
      activeScenario: scenario,
      selectedBuilding: building,
      selectedGrid: selected,
      selectedOpportunityGrid: opportunity,
      selectedMicroclimateGrid: microclimate,
      selectedEnergyGrid: energyGrid,
      selectedBuildingEnergy: buildingEnergy,
      activeMicroclimateView: state.microclimate
        ? {
            season: state.activeMicroSeason,
            metric: state.activeMicroMetric,
            metricLabel: microclimateMetricLabel(),
            lczTopRows: microLczRowsForSeason().slice(0, 5),
            wrfSeriesStats:
              state.microclimate.wrfSeries?.[state.activeMicroSeason]?.[
                MICRO_METRICS[state.activeMicroMetric]?.kind === "wrf" ? state.activeMicroMetric : "temp"
              ]?.stats || null
          }
        : null,
      activeEnergyView: state.energy
        ? {
            mode: state.activeEnergyMode,
            season: state.activeEnergySeason,
            metric: state.activeEnergyMetric,
            metricLabel: energyMetricLabel(),
            topGridRows: energyGridRowsForMetric().slice(0, 5).map((feature) => feature.properties),
            topTypeRows: energyTypeRowsForSeason().slice(0, 5)
          }
        : null,
      selectedUnits: selected ? state.data.unitExamplesByGrid[String(selected.grid_id)] || [] : [],
      agentTrace: trace.map((step) => ({
        agent: step.agent,
        tool: step.tool,
        output: step.output,
        text: step.text,
        riskState: step.kind || "normal"
      })),
      guardrails: buildGuardrailRows(gridContext, building, scenario),
      evidenceLineage: buildEvidenceRows("Current user question", gridContext, building, scenario)
    },
    null,
    2
  );
}

function localAgentAnswer(message) {
  const text = message.toLowerCase();
  const raw = message;
  const asksHotspot = hasAny(text, raw, ["hotspot", "\u70ed\u70b9"]);
  const asksCompare = hasAny(text, raw, ["compare", "baseline", "\u5bf9\u6bd4", "\u57fa\u7ebf"]);
  const asksBuilding = hasAny(text, raw, ["building", "confidence", "\u5efa\u7b51", "\u7f6e\u4fe1", "\u8bed\u4e49"]);
  const asksWhy = hasAny(text, raw, ["why", "select", "not selected", "\u4e3a\u4ec0\u4e48", "\u4e3a\u4f55", "\u6ca1\u9009", "\u9009\u62e9", "\u5165\u9009"]);
  const asksRisk = hasAny(text, raw, ["risk", "critic", "audit", "\u98ce\u9669", "\u5ba1\u6838"]);
  const asksMicroclimate = hasAny(text, raw, ["lcz", "microclimate", "\u5fae\u6c14\u5019"]);
  const asksEnergy = hasAny(text, raw, ["energy", "tmy", "eui", "\u80fd\u8017", "\u80fd\u6e90"]);
  const asksBudget = hasAny(text, raw, ["budget", "\u9884\u7b97"]);
  const asksBenchmark = hasAny(text, raw, ["model", "benchmark", "\u6a21\u578b", "\u6d4b\u8bc4"]);

  if (asksEnergy && state.selectedEnergyGrid) {
    const p = state.selectedEnergyGrid.properties;
    const season = state.activeEnergySeason;
    return `Energy grid ${p.grid_id}: ${state.energy?.seasons?.[season]?.short || season} TMY energy is ${energyFormatValue(p[`${season}_tmy_kwh`], "tmy_kwh")}, WRF/microclimate energy is ${energyFormatValue(p[`${season}_wrf_kwh`], "wrf_kwh")}, and the WRF-vs-TMY shift is ${energyFormatValue(p[`${season}_diff_pct`], "diff_pct")} across ${formatNumber(p.energy_building_count, 0)} buildings. This is a microclimate-energy evidence layer, not the selected retrofit portfolio itself.`;
  }

  if (asksEnergy && state.selectedBuilding) {
    const b = state.selectedBuilding.properties;
    const record = cachedBuildingEnergyRecord(b.bldg_id);
    const season = state.activeEnergySeason;
    if (record) {
      return `Building ${b.bldg_id}: ${state.energy?.seasons?.[season]?.short || season} TMY energy is ${energyFormatValue(record[`${season}_tmy_kwh`], "tmy_kwh")}, WRF/microclimate energy is ${energyFormatValue(record[`${season}_wrf_kwh`], "wrf_kwh")}, and the shift is ${energyFormatValue(record[`${season}_diff_pct`], "diff_pct")}. Type is ${record.type_label || b.coarse_function || "n/a"}, grid ${record.grid_id || b.grid_id || "n/a"}.`;
    }
    return `Building ${b.bldg_id} is selected, but its energy shard is still loading. Open the Energy panel or wait a moment, then ask again.`;
  }

  if (asksEnergy && state.energy) {
    const top = energyGridRowsForMetric()
      .slice(0, 4)
      .map((feature) => {
        const p = feature.properties;
        return `grid ${p.grid_id} (${energyFormatValue(p[energyMetricField()], state.activeEnergyMetric)})`;
      })
      .join("; ");
    const type = energyTypeRowsForSeason()[0];
    return `The active Energy view is ${energyMetricLabel()} at ${ENERGY_MODES[state.activeEnergyMode]} resolution. Largest grid responses by the active metric: ${top}. The highest building-type shift is ${type ? `${type.type_label} at ${energyFormatValue(type[`${state.activeEnergySeason}_diff_pct`], "diff_pct")}` : "not available"}.`;
  }

  if (asksMicroclimate && state.selectedMicroclimate) {
    const p = state.selectedMicroclimate.properties;
    const season = state.activeMicroSeason;
    return `Microclimate grid ${p.grid_id}: ${state.microclimate.seasons[season]?.short || season} LCZ sensitivity is ${formatNumber(p[`sensitivity_${season}_pct`], 1)}%, dominant ${p.LCZ_label || "LCZ n/a"}, mean WRF T2 ${formatNumber(p[`wrf_${season}_temp_mean`], 1)} C, RH ${formatNumber(p[`wrf_${season}_rh_mean`], 1)}%, shortwave ${formatNumber(p[`wrf_${season}_solar_mean`], 1)} W/m2 and wind ${formatNumber(p[`wrf_${season}_wind_mean`], 2)} m/s. This is evidence for the retrofit optimizer, not a selected allocation by itself.`;
  }

  if (asksMicroclimate && state.microclimate) {
    const rows = microLczRowsForSeason().slice(0, 3);
    const summary = rows
      .map((row) => `${row.LCZ_label || row.LCZ_name}: ${formatNumber(row.S_Mean_Weighted, 1)}%`)
      .join("; ");
    return `The active microclimate layer is ${microclimateMetricLabel()}. Top LCZ sensitivity classes are ${summary}. Use the Energy sidebar for TMY-vs-WRF building and 500 m energy responses.`;
  }

  if (asksHotspot) {
    const top = state.data.allocationGeojson.features
      .slice()
      .sort(
        (a, b) =>
          Number(b.properties.max_microclimate_sensitivity_pct || 0) -
          Number(a.properties.max_microclimate_sensitivity_pct || 0)
      )
      .slice(0, 5)
      .map((feature) => {
        const p = feature.properties;
        return `grid ${p.grid_id} (${formatNumber(p.max_microclimate_sensitivity_pct, 1)}%, ${strategyLabel(p.strategy_id)})`;
      })
      .join("; ");
    return `Five-agent run complete. Data Agent ranked microclimate sensitivity, Scenario Agent preserved feasible strategies, Optimization Agent kept the selected portfolio, and Critic Agent highlighted the top grids on the map. Top hotspots: ${top}.`;
  }

  if (asksCompare) {
    const s2 = state.data.scenarioSummary.find((row) => row.scenario_id === "S2_refined_attributes_microclimate_energy_only");
    const s3 = state.data.scenarioSummary.find((row) => row.scenario_id === "S3_proposed_refined_microclimate_agentic");
    if (s2 && s3) {
      return `Baseline comparison: energy-only S2 reaches ${formatNumber(s2.annual_carbon_reduction_tco2__cluster_weighted_13_14_25 / 1000, 1)} ktCO2/yr but concentrates ${formatNumber(s2.largest_strategy_budget_share_pct, 1)}% of spending in one strategy. Proposed S3 reaches ${formatNumber(s3.annual_carbon_reduction_tco2__cluster_weighted_13_14_25 / 1000, 1)} ktCO2/yr while keeping the largest strategy budget share at ${formatNumber(s3.largest_strategy_budget_share_pct, 1)}%, which is why the Critic Agent treats it as more governable.`;
    }
  }

  if (state.selectedBuilding) {
    const b = state.selectedBuilding.properties;
    if (asksBuilding) {
      return `Building ${b.bldg_id || "unknown"} is classified as ${b.coarse_function || "unknown"} / ${b.fine_function || "unknown"}, age bin ${b.age_bin || "unknown"}, template ${b.thermal_template || "unknown"}, with LLM confidence ${formatNumber(b.llm_confidence, 2)}. ${buildingCriticText(b, state.selectedFeature && state.selectedFeature.properties)}`;
    }
  }

  const selected = state.selectedFeature ? state.selectedFeature.properties : null;
  const opportunity = state.selectedOpportunity ? state.selectedOpportunity.properties : null;

  if (opportunity && asksWhy) {
    return `Grid ${opportunity.grid_id} is in the full-city opportunity layer with ${formatNumber(opportunity.n_buildings)} buildings. ${opportunityRecommendationText(opportunity)}. It is not selected in ${scenarioLabel(state.scenarioId)} because the NSGA-II portfolio is budget-constrained: it ranks unit-strategy options across the city by carbon, cost, coverage, microclimate evidence and strategy-share guardrails, then selects only the best feasible subset.`;
  }

  if (opportunity) {
    return `Opportunity grid ${opportunity.grid_id}: ${formatNumber(opportunity.n_buildings)} buildings, baseline EUI ${formatNumber(opportunity.baseline_eui_kwh_m2, 1)} kWh/m2, ${formatNumber(opportunity.candidate_units)} feasible candidate units and ${formatNumber(opportunity.candidate_potential_annual_carbon_tco2, 1)} tCO2/yr candidate potential. ${opportunityRecommendationText(opportunity)}. The selected allocation overlay shows whether the current scenario actually spends budget here.`;
  }

  if (!selected) {
    if (asksBenchmark) {
      return summarizeModels();
    }
    return "Please select a grid first. I can then explain why the strategy was selected, what the critic agent checks, and how the grid compares with the 1B RMB portfolio.";
  }

  if (asksWhy || text.includes("strategy")) {
    return `Grid ${selected.grid_id} was selected for ${strategyLabel(selected.strategy_id)} because the optimization found ${formatNumber(selected.annual_carbon_reduction_tco2, 1)} tCO2/yr annual reduction across ${formatNumber(selected.selected_buildings)} buildings while respecting the portfolio budget and strategy-share constraints. ${criticText(selected, null)}`;
  }
  if (asksRisk) {
    return `Critic Agent audit: ${criticText(selected, null)} Data, Knowledge, Scenario and Optimization traces remain visible above so this is an auditable decision rather than a free-form recommendation.`;
  }
  if (asksMicroclimate) {
    return `This grid is ${selected.LCZ_label || "LCZ unavailable"} with max microclimate sensitivity of ${formatNumber(selected.max_microclimate_sensitivity_pct, 1)}%. The platform keeps this sensitivity in the evidence chain because the paper frames retrofit allocation as microclimate-aware prescription, not only energy ranking.`;
  }
  if (asksBudget) {
    return summarizeBudget();
  }
  if (asksBenchmark) {
    return summarizeModels();
  }
  return `For grid ${selected.grid_id}, the selected strategy is ${strategyLabel(selected.strategy_id)}, covering ${formatNumber(selected.selected_buildings)} buildings and reducing ${formatNumber(selected.annual_carbon_reduction_tco2, 1)} tCO2/yr. The critic focus is: ${criticText(selected, null)}`;
}

function hasAny(text, raw, terms) {
  return terms.some((term) => text.includes(term) || raw.includes(term));
}
function summarizeBudget() {
  const rows = state.data.budgetSensitivity || [];
  if (!rows.length) return "Budget sensitivity data are not loaded.";
  const last = rows[rows.length - 1];
  return `Budget sensitivity shows increasing total abatement with declining marginal return. The largest tested budget reaches ${formatNumber(Number(last.annual_carbon_reduction_tco2 || 0) / 1000, 1)} ktCO2/yr. The 35% strategy budget cap prevents the energy-only baseline from collapsing into a single dominant strategy.`;
}

function summarizeModels() {
  const rows = state.data.modelBenchmark || [];
  const overall = rows.filter((row) => row.task_group === "OVERALL").sort((a, b) => Number(b.mean_score || 0) - Number(a.mean_score || 0));
  if (!overall.length) return "Model benchmark data are not loaded.";
  const summary = overall
    .slice(0, 4)
    .map((row) => `${modelShortLabel(row.model_spec)}: ${formatNumber(row.mean_score, 3)} score, ${formatNumber(row.mean_elapsed_sec, 2)} s`)
    .join("; ");
  return `Agent benchmark top models: ${summary}. These scores evaluate semantic unit construction, RAG constraint extraction, tool planning and critic audit with strict JSON validity, not EnergyPlus physics.`;
}

function summarizeModel(spec) {
  const rows = (state.data.modelBenchmark || []).filter((row) => row.model_spec === spec);
  if (!rows.length) return `No benchmark rows are loaded for ${spec}.`;
  const overall = rows.find((row) => row.task_group === "OVERALL");
  const tasks = rows
    .filter((row) => row.task_group !== "OVERALL")
    .sort((a, b) => Number(b.mean_score || 0) - Number(a.mean_score || 0))
    .map((row) => `${taskShortLabel(row.task_group)} ${formatNumber(row.mean_score, 2)}`)
    .join(", ");
  return `${modelShortLabel(spec)} benchmark: overall score ${formatNumber(overall && overall.mean_score, 3)}, valid-response rate ${formatNumber(((overall && overall.parse_valid_rate) || 0) * 100, 0)}%, mean latency ${formatNumber(overall && overall.mean_elapsed_sec, 2)} s/case. Task profile: ${tasks}. This is the paper's 10-model agent evaluation layer, not a generic leaderboard.`;
}

function taskShortLabel(task) {
  const labels = {
    T1_semantic_unit_construction: "Semantic unit",
    T2_rag_constraint_extraction: "RAG",
    T3_tool_planning: "Tool planning",
    T4_critic_audit: "Critic"
  };
  return labels[task] || task;
}

function addChatMessage(role, text) {
  const log = document.getElementById("chatLog");
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = text;
  log.appendChild(node);
  log.scrollTop = log.scrollHeight;
}

function scenarioLabel(id) {
  if (SCENARIO_META[id]) return SCENARIO_META[id].label;
  const labels = {
    S0_old_attributes_microclimate: "S0 old attributes, microclimate",
    S1_refined_attributes_TMY: "S1 refined attributes, TMY",
    S2_refined_attributes_microclimate_energy_only: "S2 energy-only microclimate",
    S3_proposed_refined_microclimate_agentic: "S3 proposed agentic portfolio",
    S4_old_attributes_deep_retrofit_microclimate: "S4 old attributes, deep retrofit",
    S5_refined_attributes_deep_retrofit_microclimate: "S5 refined deep retrofit",
    S6_refined_attributes_deep_retrofit_TMY: "S6 refined deep retrofit, TMY"
  };
  return labels[id] || id;
}

function strategyLabel(id) {
  return (STRATEGIES[id] && STRATEGIES[id].label) || id || "Unknown strategy";
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truthy(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.toLowerCase());
  return Boolean(value);
}

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return number.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  if (number >= 1e9) return `${formatNumber(number / 1e9, 2)}B RMB`;
  if (number >= 1e6) return `${formatNumber(number / 1e6, 1)}M RMB`;
  return `${formatNumber(number, 0)} RMB`;
}

function formatBudgetShort(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return `${formatNumber(number / 1e8, 1)}e8`;
}

