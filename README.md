# Shanghai OptAgent Platform

An interactive Mapbox-based platform for the Shanghai urban building decarbonization paper.

The platform visualizes the agentic retrofit optimization workflow:

- semantic decision-unit construction
- RAG-grounded intervention constraints
- NSGA-II/MILP portfolio optimization
- critic-agent audit and explainability
- optional LLM conversation through a user-provided API key

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

The app uses Mapbox GL JS for the basemap. For security, no token is committed.

Use either:

- the token field in the app settings panel
- `?mapbox_token=YOUR_TOKEN` in the URL
- `window.SHANGHAI_OPTAGENT_CONFIG.mapboxAccessToken` in `src/config.js`

Public Mapbox browser tokens are acceptable for static sites, but they should be restricted by URL in the Mapbox dashboard after deployment.

## Data

Generated data are stored in:

```text
data/shanghai-platform-data.json
```

Regenerate from the research outputs:

```powershell
python scripts/build_platform_data.py
```

The current first release uses the 1,369 selected NSGA-II 500 m allocation grids as the primary clickable map layer. The full 592,795-building stock CSV is intentionally not bundled into GitHub Pages. For a true building-footprint click layer, convert the building stock into a Mapbox tileset and reference it in `src/config.js`.

## Deployment

The site is designed for GitHub Pages. Publish this repository and enable Pages from the default branch root.
