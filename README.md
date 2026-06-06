# Shanghai OptAgent Platform

An interactive Mapbox-based platform for the Shanghai urban building decarbonization paper.

The platform visualizes the agentic retrofit optimization workflow:

- semantic decision-unit construction
- RAG-grounded intervention constraints
- NSGA-II/MILP portfolio optimization
- critic-agent audit and explainability
- optional DeepSeek conversation through a secure proxy

## Local Preview

This is a static site. Start a small local server from this directory:

```powershell
python -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Mapbox Token

The app uses Mapbox GL JS for the basemap.

The site includes a Mapbox public browser token so the map can load without asking viewers to paste a token. Public `pk...` tokens are visible to browsers by design; restrict the token by URL in the Mapbox dashboard:

```text
https://jphera.github.io/Shanghai-OptAgent-Platform/*
```

If you rotate the token later, update `window.SHANGHAI_OPTAGENT_CONFIG.mapboxAccessToken` in `src/config.js`.

## DeepSeek Agent Proxy

Do not commit a DeepSeek `sk...` key to GitHub Pages. Static frontend code cannot keep server API keys private.

Use `serverless/deepseek-worker.js` as a Cloudflare Worker template and set this secret in the Worker dashboard:

```text
DEEPSEEK_API_KEY=...
```

Then set `window.SHANGHAI_OPTAGENT_CONFIG.llm.proxyEndpoint` in `src/config.js` to the Worker URL. The frontend will call the proxy without exposing the DeepSeek key to viewers.

## Data

Generated data are stored in:

```text
data/shanghai-platform-data.json
```

Regenerate from the research outputs:

```powershell
python scripts/build_platform_data.py
```

The platform bundles two 500 m grid layers:

- a full-city opportunity layer covering 9,592 building-stock/candidate grids
- scenario-specific NSGA-II selected allocation overlays, including 1,369 selected grids for S3

The full 592,795-building footprint layer is not bundled into GitHub Pages; it is hosted as a Mapbox vector tileset and joined in the frontend through `src/config.js`. The frontend renders this layer as 3D `fill-extrusion` using the tileset `height_m` property.

The dropdown in the Overview panel is a model-comparison / ablation selector generated from `scenario_summary.csv`, not a set of independent policy scenarios. The proposed paper configuration is:

```text
S3_proposed_refined_microclimate_agentic
```

The other entries compare old vs refined semantics, TMY vs microclimate annualization, energy-only ranking, and deep-retrofit stress tests.

The Evidence panel also loads:

- `archetype_strategy_rank_rows.csv` and `archetype_strategy_rank_matrix.csv` for the building-type retrofit ranking
- `policy_translation_strategy_macc.csv` and `policy_translation_district_fairness.csv` for policy cost and equity evidence
- Figure assets for Fig. 12 and Fig. 15 as visual references alongside the interactive tables

## Current Mapbox Building Tileset

The active building click layer is configured in `src/config.js`:

```js
buildingTileset: {
  enabled: true,
  sourceUrl: "mapbox://jpyjpy.vqqao0uef4p8",
  sourceLayer: "66de023c0080f21b24ff",
  minzoom: 11
}
```

The source layer id was read from the Mapbox TileJSON `vector_layers` response after upload. The uploaded Studio tileset is based on `08_shanghai_buildings_footprints.geojson`, a standard GeoJSON `FeatureCollection` with 592,795 building footprint features.

If 3D buildings are not visible, use the `3D buildings` toolbar button. The status chip on the map reports whether visible vector features are currently loaded. The source CSV is:

```text
F:\博士文件\石老师课题组\6.AI-agent-LLM\data\shanghai_all_jpy_with_llm_attrs.csv
```

## Mapbox Studio GeoJSON Upload

For the user's current Mapbox workflow, use the standard GeoJSON export instead of line-delimited GeoJSON or MBTiles:

```powershell
python .\scripts\build_mapbox_studio_geojson.py
```

Generated local upload directory:

```text
mapbox_studio_upload/
```

The uploaded file keeps the compact fields needed by the platform:

```text
objectid, grid_id, height_m, footprint_m2, building_type, fine_function, final_year, thermal_template, ml_probability
```

If Mapbox Studio reports a 300 MB limit again, keep the exported geometry precision and property set compact. The current single-file export is about 253 MB, below the web upload limit.

## Full Building Footprint Tileset

An MBTiles export is also available as a fallback workflow.

Generate the `.mbtiles` file:

```powershell
python .\scripts\build_building_mbtiles.py
```

Generated local upload file:

```text
mapbox_mbtiles/shanghai_buildings_footprints.mbtiles
```

This MBTiles file contains the `shanghai_buildings` vector layer at z12-z15. It is about 122 MB, below Mapbox's 300 MB web upload limit. Upload this file in Mapbox Studio to get a normal tileset id, then configure `src/config.js`:

```js
buildingTileset: {
  enabled: true,
  sourceUrl: "mapbox://YOUR_MAPBOX_USERNAME.YOUR_TILESET_ID",
  sourceLayer: "shanghai_buildings",
  minzoom: 12.5
}
```

The MBTiles file is ignored by Git because it is a generated binary.

## Line-Delimited Source Fallback

If you prefer Mapbox Tiling Service source/recipe workflows, the same building layer can also be prepared as line-delimited GeoJSON.

Generate the source:

```powershell
python .\scripts\build_mapbox_building_tileset_source.py
```

Generated local upload file:

```text
mapbox_sources/shanghai_buildings_footprints.ldgeojson
```

This file is line-delimited GeoJSON in WGS84 and is about 466 MB, so it is ignored by Git. The `.ldgeojson` extension is required by Mapbox upload tools and Studio.

Mapbox Studio's web upload has a 300 MB per-file limit. Use the split files instead:

```powershell
python .\scripts\split_mapbox_tileset_source.py
```

Generated split upload files:

```text
mapbox_sources/shanghai_buildings_footprints_parts/
```

Upload the split files to one Mapbox tileset source using the recipe and commands in:

```text
mapbox/README.md
```

After publishing the tileset, set `buildingTileset.enabled = true`, `sourceUrl`, and `sourceLayer` in `src/config.js`. The platform will then show clickable building footprints at high zoom and link each building to the grid-level OptAgent portfolio where available.

## Deployment

The site is designed for GitHub Pages. Pushes to `main` run `.github/workflows/pages.yml`, which publishes the static site to the `gh-pages` branch.

The workflow also makes a best-effort GitHub Pages API call to create the Pages site from:

```text
branch: gh-pages
folder: /root
```

If the public URL still returns 404 after a successful workflow run, enable it manually from repository settings:

```text
Settings -> Pages -> Build and deployment -> Deploy from a branch -> gh-pages -> /root
```

Expected project URL:

```text
https://jphera.github.io/Shanghai-OptAgent-Platform/
```
