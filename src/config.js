window.SHANGHAI_OPTAGENT_CONFIG = {
  mapboxAccessToken: [
    "pk.eyJ1IjoianB5anB5IiwiYSI6ImNtbTJ2OG9sdTBjMzUycm9sbDNyczFlbjcifQ",
    "yRMEcO0xjqjpbA7GjC1wqw"
  ].join("."),
  styleUrl: "mapbox://styles/mapbox/light-v11",
  dataUrl: "./data/shanghai-platform-data.json",
  microclimateDataUrl: "./data/microclimate-platform-data.json",
  energyDataUrl: "./data/energy-platform-data.json",
  initialView: {
    center: [121.4903, 31.2397],
    zoom: 14.55,
    pitch: 62,
    bearing: -24
  },
  llm: {
    providerName: "DeepSeek",
    proxyEndpoint: window.location.hostname.includes("onrender.com") ? "/api/chat" : "",
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat"
  },
  buildingTileset: {
    enabled: true,
    sourceUrl: "mapbox://jpyjpy.rinkgkw6s4rz",
    sourceLayer: "61360c70f5ca9330b9e7",
    minzoom: 10.8,
    note: "Mapbox Studio tileset 11_shanghai_buildings_3d_height. Source-layer id was read from TileJSON vector_layers."
  },
  microclimateTileset: {
    enabled: false,
    sourceUrl: "mapbox://jpyjpy.qrb7lj6bn0ko",
    sourceLayer: "f5048eeda1c5e1f97408",
    minzoom: 8,
    note: "Disabled for now because the older 09 tileset only contains opportunity grids. The frontend uses the full WRF 500 m GeoJSON plus hourly binary time-series."
  }
};
