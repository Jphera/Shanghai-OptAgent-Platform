window.SHANGHAI_OPTAGENT_CONFIG = {
  mapboxAccessToken: "",
  styleUrl: "mapbox://styles/mapbox/light-v11",
  dataUrl: "./data/shanghai-platform-data.json",
  initialView: {
    center: [121.4737, 31.2304],
    zoom: 9.15,
    pitch: 0,
    bearing: 0
  },
  llm: {
    providerName: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat"
  },
  buildingTileset: {
    enabled: true,
    sourceUrl: "mapbox://jpyjpy.vqqao0uef4p8",
    sourceLayer: "66de023c0080f21b24ff",
    minzoom: 12.5,
    note: "Mapbox Studio tileset 08_shanghai_buildings_footprints. Source-layer id was read from TileJSON vector_layers."
  }
};
