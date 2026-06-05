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
    enabled: false,
    sourceUrl: "",
    sourceLayer: "",
    note: "Upload full Shanghai building footprints to Mapbox as a vector tileset, then configure this block."
  }
};
