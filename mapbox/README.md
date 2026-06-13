# Mapbox Tileset Package

This folder contains the recipe and sample needed to publish the true Shanghai building-footprint click layer as a Mapbox vector tileset.

## Recommended: Upload MBTiles In Mapbox Studio

The simplest path is now the generated MBTiles file:

```powershell
python .\scripts\build_building_mbtiles.py
```

Upload this file in Mapbox Studio:

```text
mapbox_mbtiles/shanghai_buildings_footprints.mbtiles
```

It contains a vector layer named:

```text
shanghai_buildings
```

After upload, copy the resulting Mapbox tileset id into `src/config.js`:

```js
buildingTileset: {
  enabled: true,
  sourceUrl: "mapbox://YOUR_MAPBOX_USERNAME.YOUR_TILESET_ID",
  sourceLayer: "shanghai_buildings",
  minzoom: 12.5
}
```

## Fallback: MTS Source And Recipe

The full source file is generated locally into `../mapbox_sources/` and is intentionally ignored by Git because the 592,795-building layer is too large for normal GitHub storage.

## Generate

```powershell
python .\scripts\build_mapbox_building_tileset_source.py
```

Outputs:

- `mapbox_sources/shanghai_buildings_footprints.ldgeojson`
- `mapbox_sources/shanghai_buildings_footprints_parts/shanghai_buildings_footprints_part_01.ldgeojson`
- `mapbox_sources/shanghai_buildings_footprints_parts/shanghai_buildings_footprints_part_02.ldgeojson`
- `mapbox_sources/shanghai_buildings_footprints_manifest.json`
- `mapbox/shanghai_buildings_footprints_sample.geojson`

The source file is line-delimited GeoJSON in WGS84, transformed from the source building CSV polygon field.

Mapbox Studio's browser uploader rejects files larger than 300 MB. The split files are designed to stay below that limit. Mapbox Tiling Service supports tileset sources made from multiple files, and the Tilesets CLI can upload several files or an entire directory into the same source.

If the full source already exists, split it without regenerating:

```powershell
python .\scripts\split_mapbox_tileset_source.py
```

## Upload With Mapbox Tilesets CLI

Install the CLI:

```powershell
python -m pip install tilesets-cli
```

Use a Mapbox secret token with Tilesets write scopes:

```powershell
$env:MAPBOX_ACCESS_TOKEN="sk.your_mapbox_secret_token"
```

Upload the source:

```powershell
tilesets upload-source YOUR_MAPBOX_USERNAME shanghai_buildings_footprints .\mapbox_sources\shanghai_buildings_footprints_parts\ --no-validation
```

Or pass the two files explicitly:

```powershell
tilesets upload-source YOUR_MAPBOX_USERNAME shanghai_buildings_footprints .\mapbox_sources\shanghai_buildings_footprints_parts\shanghai_buildings_footprints_part_01.ldgeojson .\mapbox_sources\shanghai_buildings_footprints_parts\shanghai_buildings_footprints_part_02.ldgeojson --no-validation
```

Create the tileset:

```powershell
tilesets create YOUR_MAPBOX_USERNAME.shanghai_buildings_footprints --recipe .\mapbox\shanghai_buildings_tileset_recipe.json --name "Shanghai building footprints"
```

Publish:

```powershell
tilesets publish YOUR_MAPBOX_USERNAME.shanghai_buildings_footprints
```

## Configure The App

After publishing, update `src/config.js`:

```js
buildingTileset: {
  enabled: true,
  sourceUrl: "mapbox://YOUR_MAPBOX_USERNAME.shanghai_buildings_footprints",
  sourceLayer: "shanghai_buildings",
  minzoom: 12.5
}
```

Keep the ordinary browser Mapbox token as a public token restricted to your GitHub Pages domain.
