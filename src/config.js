window.SHANGHAI_OPTAGENT_CONFIG = {
  mapboxAccessToken: [
    "pk.eyJ1IjoianB5anB5IiwiYSI6ImNtbTJ2OG9sdTBjMzUycm9sbDNyczFlbjcifQ",
    "yRMEcO0xjqjpbA7GjC1wqw"
  ].join("."),
  styleUrl: "mapbox://styles/mapbox/light-v11",
  dataUrl: "./data/shanghai-platform-data.json",
  microclimateDataUrl: "./data/microclimate-platform-data.json",
  energyDataUrl: "./data/energy-platform-data.json",
  buildingSemanticUrl: "./data/building-semantic-index.json",
  initialView: {
    center: [121.4903, 31.2397],
    zoom: 14.55,
    pitch: 62,
    bearing: -24
  },
  llm: {
    providerName: "DeepSeek",
    proxyEndpoint: window.location.hostname.includes("onrender.com")
      ? "/api/chat"
      : "https://shanghai-optagent-platform.onrender.com/api/chat",
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-reasoner",
    forceModel: true
  },
  buildingTileset: {
    enabled: true,
    sourceUrl: "mapbox://jpyjpy.rinkgkw6s4rz",
    sourceLayer: "61360c70f5ca9330b9e7",
    minzoom: 10.8,
    note: "Mapbox Studio tileset 11_shanghai_buildings_3d_height. Published maxzoom is 16; source-layer id was read from TileJSON vector_layers."
  },
  microclimateTileset: {
    enabled: true,
    sourceUrl: "mapbox://jpyjpy.c5i4qqzurwmr",
    sourceLayer: "d74ca75d65e4bad051c4",
    minzoom: 8,
    note: "Mapbox Studio tileset 09_shanghai_microclimate_500m_summary. The app keeps the local GeoJSON source active for hourly WRF playback and uses this uploaded tileset as the static Mapbox reference layer."
  }
};
