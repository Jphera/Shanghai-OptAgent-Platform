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

const state = {
  data: null,
  map: null,
  activePanel: "overview",
  selectedFeature: null,
  scenarioId: "S3_proposed_refined_microclimate_agentic",
  strategyFilter: "all",
  colorMetric: "strategy",
  popup: null
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  wirePanels();
  wireTokenControls();
  wireLayerControls();
  wireChat();
  restoreApiSettings();

  state.data = await loadData();
  renderOverview();
  renderEvidence();
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
    pitch: initial.pitch || 0,
    bearing: initial.bearing || 0,
    attributionControl: true
  });

  state.map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "bottom-right");

  state.map.on("load", () => {
    addMapSourcesAndLayers();
    fitAllocation();
  });
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

  map.on("mouseenter", "allocation-fill", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "allocation-fill", () => {
    map.getCanvas().style.cursor = "";
  });

  applyMapFilters();
  renderLegend();
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

  document.getElementById("toggleAllocation").addEventListener("change", (event) => {
    setLayerVisibility(["allocation-fill", "allocation-line", "allocation-selected-line"], event.target.checked);
  });

  document.getElementById("toggleLabels").addEventListener("change", (event) => {
    setLayerVisibility(["allocation-labels"], event.target.checked);
  });

  document.getElementById("fitView").addEventListener("click", fitAllocation);
  document.getElementById("zoomSelected").addEventListener("click", zoomSelected);
  document.getElementById("resetPitch").addEventListener("click", () => {
    if (!state.map) return;
    state.map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  });

  document.getElementById("gridSearchButton").addEventListener("click", runGridSearch);
  document.getElementById("gridSearch").addEventListener("keydown", (event) => {
    if (event.key === "Enter") runGridSearch();
  });
}

function setLayerVisibility(layerIds, visible) {
  if (!state.map) return;
  layerIds.forEach((id) => {
    if (state.map.getLayer(id)) {
      state.map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  });
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
    renderScenarioNarrative();
  });

  const strategySelect = document.getElementById("strategyFilter");
  const strategies = unique(state.data.allocationGeojson.features.map((f) => f.properties.strategy_id));
  strategySelect.innerHTML =
    `<option value="all">All selected strategies</option>` +
    strategies
      .map((key) => `<option value="${key}">${(STRATEGIES[key] && STRATEGIES[key].label) || key}</option>`)
      .join("");

  renderScenarioNarrative();
}

function renderScenarioNarrative() {
  const row = state.data.scenarioSummary.find((item) => item.scenario_id === state.scenarioId);
  if (!row) return;
  const mix = state.data.strategyMix.filter((item) => item.scenario_id === row.scenario_id);
  const top = mix
    .slice()
    .sort((a, b) => Number(b.period_carbon_reduction_tco2) - Number(a.period_carbon_reduction_tco2))
    .slice(0, 3)
    .map((item) => `${strategyLabel(item.strategy_id)} (${formatNumber(item.selected_buildings)} buildings)`)
    .join(", ");

  document.getElementById("scenarioNarrative").innerHTML = `
    <p><strong>${scenarioLabel(row.scenario_id)}</strong> selects ${formatNumber(row.selected_units)} units and ${formatNumber(row.selected_buildings)} buildings under a ${formatCurrency(row.budget_rmb)} budget.</p>
    <p>Annual carbon reduction is ${formatNumber(row.annual_carbon_reduction_tco2__cluster_weighted_13_14_25, 1)} tCO2/yr, with the largest strategy budget share constrained to ${formatNumber(row.largest_strategy_budget_share_pct, 1)}%.</p>
    <p>Dominant strategies: ${top || "not available"}.</p>
  `;
}

function renderEvidence() {
  renderModelBenchmark();
  renderBudgetChart();
  renderInterventionLibrary();
}

function renderModelBenchmark() {
  const grouped = {};
  state.data.modelBenchmark.forEach((row) => {
    grouped[row.model_spec] = grouped[row.model_spec] || [];
    grouped[row.model_spec].push(row);
  });

  document.getElementById("modelBenchmark").innerHTML = Object.entries(grouped)
    .map(([model, rows]) => {
      const mean = rows.reduce((sum, row) => sum + Number(row.mean_score || 0), 0) / rows.length;
      const latency = rows.reduce((sum, row) => sum + Number(row.mean_elapsed_sec || 0), 0) / rows.length;
      return `
        <div class="list-item">
          <strong>${model}</strong>
          <span>Mean task score ${formatNumber(mean, 3)} across ${rows.length} task groups; mean latency ${formatNumber(latency, 2)} s/case.</span>
        </div>
      `;
    })
    .join("");
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

function renderInterventionLibrary() {
  const raw = state.data.interventionLibrary;
  const items = Array.isArray(raw) ? raw : Object.values(raw || {});
  document.getElementById("interventionLibrary").innerHTML = items
    .slice(0, 11)
    .map((item) => {
      const id = item.strategy_id || item.id || item.name || "strategy";
      const label = item.strategy_name || item.label || item.intervention_name || id;
      const family = item.family || item.strategy_family || "intervention";
      return `
        <div class="list-item">
          <strong>${label}</strong>
          <span>${family} | ${id}</span>
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
  state.selectedFeature = feature;
  const p = feature.properties;

  if (state.map && state.map.getLayer("allocation-selected-line")) {
    state.map.setFilter("allocation-selected-line", [
      "all",
      ["==", ["get", "grid_id"], p.grid_id],
      ["==", ["get", "strategy_id"], p.strategy_id]
    ]);
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
}

function renderEmptySelection() {
  document.getElementById("selectedSummary").innerHTML = `
    <p class="narrative">Click a selected 500 m allocation grid on the map. The critic agent panel will explain the selected strategy, expected carbon impact, feasibility trace, and representative decision units.</p>
  `;
  document.getElementById("agentSteps").innerHTML = "";
  document.getElementById("unitExamples").innerHTML = "";
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

function runGridSearch() {
  const raw = document.getElementById("gridSearch").value.trim();
  if (!raw) return;
  const gridId = Number(raw);
  const feature = state.data.allocationGeojson.features.find((item) => Number(item.properties.grid_id) === gridId);
  if (!feature) {
    addChatMessage("assistant", `I could not find grid ${raw} in the selected allocation layer.`);
    return;
  }
  selectFeature(feature);
  zoomToFeature(feature);
}

function fitAllocation() {
  if (!state.map || !state.data) return;
  const bounds = featureCollectionBounds(state.data.allocationGeojson);
  if (bounds) state.map.fitBounds(bounds, { padding: 48, duration: 700 });
}

function zoomSelected() {
  if (!state.selectedFeature) {
    fitAllocation();
    return;
  }
  zoomToFeature(state.selectedFeature);
}

function zoomToFeature(feature) {
  if (!state.map) return;
  const bounds = featureBounds(feature);
  if (bounds) state.map.fitBounds(bounds, { padding: 90, duration: 700, maxZoom: 13.5 });
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
  document.getElementById("saveApiSettings").addEventListener("click", saveApiSettings);
  document.getElementById("chatForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("chatInput");
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    addChatMessage("user", message);
    const reply = await answerQuestion(message);
    addChatMessage("assistant", reply);
  });
  addChatMessage(
    "assistant",
    "Select a grid and ask about retrofit priority, constraints, budget sensitivity, semantic confidence, or model benchmark. Without an API key I use a deterministic local agent over the loaded research data."
  );
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
  const apiKey = localStorage.getItem(STORAGE.apiKey);
  const endpoint = localStorage.getItem(STORAGE.apiEndpoint);
  const model = localStorage.getItem(STORAGE.apiModel);
  if (apiKey && endpoint && model) {
    try {
      return await callRemoteModel(message, apiKey, endpoint, model);
    } catch (error) {
      return `The remote model call failed, so I fell back to the local agent. ${localAgentAnswer(message)}`;
    }
  }
  return localAgentAnswer(message);
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
            "You are a Shanghai urban building decarbonization agent. Answer using the supplied research data only. Be concise, quantitative, and explicit about uncertainty."
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
  const scenario = state.data.scenarioSummary.find((row) => row.scenario_id === state.scenarioId);
  return JSON.stringify(
    {
      coreMetrics: metrics,
      activeScenario: scenario,
      selectedGrid: selected,
      selectedUnits: selected ? state.data.unitExamplesByGrid[String(selected.grid_id)] || [] : []
    },
    null,
    2
  );
}

function localAgentAnswer(message) {
  const text = message.toLowerCase();
  const selected = state.selectedFeature ? state.selectedFeature.properties : null;

  if (!selected) {
    if (text.includes("model") || text.includes("benchmark")) {
      return summarizeModels();
    }
    return "Please select a grid first. I can then explain why the strategy was selected, what the critic agent checks, and how the grid compares with the 1B RMB portfolio.";
  }

  if (text.includes("why") || text.includes("strategy") || text.includes("select")) {
    return `Grid ${selected.grid_id} was selected for ${strategyLabel(selected.strategy_id)} because the optimization found ${formatNumber(selected.annual_carbon_reduction_tco2, 1)} tCO2/yr annual reduction across ${formatNumber(selected.selected_buildings)} buildings while respecting the portfolio budget and strategy-share constraints. ${criticText(selected, null)}`;
  }
  if (text.includes("risk") || text.includes("critic") || text.includes("audit")) {
    return criticText(selected, null);
  }
  if (text.includes("lcz") || text.includes("microclimate")) {
    return `This grid is ${selected.LCZ_label || "LCZ unavailable"} with max microclimate sensitivity of ${formatNumber(selected.max_microclimate_sensitivity_pct, 1)}%. The platform keeps this sensitivity in the evidence chain because the paper frames retrofit allocation as microclimate-aware prescription, not only energy ranking.`;
  }
  if (text.includes("budget")) {
    return summarizeBudget();
  }
  if (text.includes("model") || text.includes("benchmark")) {
    return summarizeModels();
  }
  return `For grid ${selected.grid_id}, the selected strategy is ${strategyLabel(selected.strategy_id)}, covering ${formatNumber(selected.selected_buildings)} buildings and reducing ${formatNumber(selected.annual_carbon_reduction_tco2, 1)} tCO2/yr. The critic focus is: ${criticText(selected, null)}`;
}

function summarizeBudget() {
  const rows = state.data.budgetSensitivity || [];
  if (!rows.length) return "Budget sensitivity data are not loaded.";
  const last = rows[rows.length - 1];
  return `Budget sensitivity shows increasing total abatement with declining marginal return. The largest tested budget reaches ${formatNumber(Number(last.annual_carbon_reduction_tco2 || 0) / 1000, 1)} ktCO2/yr. The 35% strategy budget cap prevents the energy-only baseline from collapsing into a single dominant strategy.`;
}

function summarizeModels() {
  const rows = state.data.modelBenchmark || [];
  const byModel = {};
  rows.forEach((row) => {
    byModel[row.model_spec] = byModel[row.model_spec] || [];
    byModel[row.model_spec].push(Number(row.mean_score || 0));
  });
  const summary = Object.entries(byModel)
    .map(([model, scores]) => `${model}: ${formatNumber(scores.reduce((a, b) => a + b, 0) / scores.length, 3)}`)
    .join("; ");
  return `Agent benchmark mean scores by model: ${summary}. These scores evaluate workflow tasks such as semantic unit construction, RAG constraint extraction, tool planning, and critic audit, not EnergyPlus physics.`;
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
