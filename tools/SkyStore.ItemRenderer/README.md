# SkyStore item renderer

This offline tool renders transparent PNG artwork directly from the NIF models referenced by the active Keizaal catalog. It never starts Skyrim and it is not part of the SkyStore web or Docker runtime.

The target set is deliberately small: every profession recipe output, every recipe ingredient, and any condition-linked requirement that resolves to an inventory item. All other catalog items keep SkyStore's flat category artwork.

## Requirements

- The current SkyStore catalog produced by `SkyStore.CatalogBuilder`
- The exact Keizaal `Data` folder and `plugins.txt`
- Blender 4.4 or newer
- A local [PyNifly](https://github.com/BadDogSkyrim/PyNifly) release add-on directory (`io_scene_nifly`)

PyNifly is a separate GPL-3.0 tool and is not vendored, downloaded by, linked into, or distributed with SkyStore. Its path is supplied only when this offline renderer is run.

## Run

```powershell
dotnet run --project tools/SkyStore.ItemRenderer -- `
  --catalog catalog/generated/skystore-catalog-current.json `
  --data "D:\SteamLibrary\steamapps\common\Skyrim Special Edition\Data" `
  --load-order "$env:LOCALAPPDATA\Skyrim Special Edition\plugins.txt" `
  --output output/item-renders `
  --blender "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" `
  --pynifly output/toolcache/PyNifly-release/addon/io_scene_nifly
```

The output contains:

- `images/<item UUID>.png` — transparent 512×512 item renders
- `artwork-manifest.json` — stable item keys mapped to `/item-renders/<item UUID>.png`
- `render-targets.json` — deterministic selected-item inventory
- `render-report.json` — rendered, missing-model, and asset-error results
- `work/` — ignored extracted NIF and DDS dependencies used by Blender

Pass the artwork manifest back to `SkyStore.CatalogBuilder --artwork-manifest` when producing the distributable catalog. Existing PNGs are retained for fast incremental runs; pass `--force` to regenerate them. `--prepare-only` extracts assets without launching Blender. `--match "Common Clothes 06,Minor Healing,Wheat"` and `--limit N` are useful for focused pipeline testing.
