# Brain cinematic (LinkedIn)

Isolated Three.js MaleCNS soma reveal for video editing. **Not part of gameplay.**

## Route

- Preview: `/cinematic/` (or `/cinematic/index.html`)
- Export mode: `/cinematic/?export=1` (no UI chrome; fixed 1080×1350)

## Data honesty

| Layer | Source |
| --- | --- |
| Soma positions | Measured MaleCNS v1.0 via `web/public/connectome` (`loadMeasuredGeometry`) |
| Activity | Default `SYNTHETIC_CINEMATIC_TIMELINE` — authored clusters on real coordinates |
| Edges | Off by default. Optional overlay is **spatial proximity**, not synapses |

Real rate/LIF activity can be injected later through `ExternalBufferActivity` (`ActivitySource`).

## Commands

```sh
npm run cinematic              # Vite preview UI
npm run cinematic:frames       # build + deterministic PNG export
npm run cinematic:video        # ffmpeg ProRes + H.264 from PNGs
npm run cinematic:export       # frames + video
```

Outputs under `web/cinematic-output/`:

- `frames/frame_XXXXX.png`
- `fox-vs-fly-brain-master.mov` (ProRes 422 HQ)
- `fox-vs-fly-brain-preview.mp4` (H.264)

Requires ffmpeg (`brew install ffmpeg` on macOS).
