# LinkedIn capture mode (gameplay + live model)

Deterministic, chrome-free capture of **real** MaleCNS V2 gameplay for the post-brain-reveal edit. Complements the synthetic-timeline brain cinematic in [CINEMATIC.md](CINEMATIC.md).

## Music / editing (not model)

Edit in Premiere to **Aphex Twin — 180db_[130]** (~130 BPM; 1 beat ≈ 0.4615 s ≈ 27.7 frames at 60 Hz).

- Footage contains **no music**.
- Footage contains **no baked titles/HUD**.
- The neural model is **not** forced to pulse at 130 BPM. Beat sync is an editing property.
- Markers are reproducible game ticks so cuts land cleanly on the waveform.

Suggested edit rhythm after the title + neuron-count brain reveal:

| Beat | Cut | Capture aid |
| --- | --- | --- |
| A | Hard cut into gameplay — two fighters on stage | start of `hero-sequence` / `fox-approach` |
| B | Fox obvious movement | marker `fox-move` |
| C | Live MaleCNS activity | same tick window, `view=brain` |
| D | Fly motor action (move/attack/…) | marker `fly-react` / `motor-change` |
| E | Optional second brain flash | `view=brain` near activity/motor markers |
| F | Fight breathes | `?capture=breathe` |

## URLs

Preferred shot routes (all replay the same authentic V2 hero sequence):

```
/capture/?shot=reveal
/capture/?shot=approach
/capture/?shot=brain-response
/capture/?shot=fly-response
/capture/?shot=impact
/capture/?shot=split
```

Optional overrides: `&camera=clean|trailer|close|impact|wide|still`, `&brainCamera=front|push|orbit-subtle|close`, and `&debug=1`. Legacy `?capture=` URLs below remain supported. `camera=still` is a tight editorial plate (zoom ~3× with a slight lift) for 1080×1350 stills of both fighters on stage.

Require the default neural controller (not `?controller=dummy`).

```
/?capture=hero-sequence              # full-bleed gameplay
/?capture=hero-sequence&view=brain   # same run, black-plate brain activity
/?capture=fox-approach
/?capture=fly-attack                 # alias of hero-sequence; cut on fly-react
/?capture=breathe
/?capture=hero-sequence&debug=1      # tick + marker overlay (do not use in final take)
/?capture=hero-sequence&loop=1       # auto-replay for repeated takes
```

Keys in capture mode: **R** replay, **esc** pause. No live Fox keyboard.

## Hero sequence

Searched with `node scripts/capture_sequence_search.mjs` against the real V2 rate controller. Evidence: `data/capture-sequences.json`.

**Preset:** `hero-sequence` (= search id `feint-L-then-R`)

Fox feints left 18 frames, then commits right. Observed deterministic chain (60 Hz ticks):

| Marker | Tick | t (s) | Notes |
| --- | ---: | ---: | --- |
| `fox-move` | 18 | 0.30 | Fox commits toward Fly |
| `model-activity-delta` | 19 | 0.32 | Packed active-node count shifts vs baseline |
| `sensory-change` | 32 | 0.53 | Authored sensors flip (attack window) |
| `motor-change` | 36 | 0.60 | Readout → Left+Attack |
| `fly-react` | 36 | 0.60 | Fly enters Attack |

Suggested capture window: ticks **0–96** (~1.6 s), giving ~0.5 s before the Fox commit and ~1.0 s after the Fly attack for Premiere handles.

The `approach` edit plate uses ticks **0–88** so the trailer hold continues through the hit and Fox’s knockback fall. After the hit-impact tick (42), that plate forces Fly’s **sim input** idle (`axis`/`buttons` 0) so Fly does not walk during the fall hold. Live motor readout/activity are unchanged; this is a presentation override for the plate only.

Record **two takes** of the same preset (game, then brain) and intercut. Both are driven by the same scripted Fox timeline and the same live model; do not substitute the synthetic cinematic activity for these brain cuts if you want the causal chain to be honest.

## Recording / export

### Automated (preferred)

```sh
cd web
npm run capture:export
```

`CAPTURE_SHOT=impact npm run capture:export` exports one shot; `npm run capture:export:all` exports all six. Masters are `web/capture-output/capture-<shot>.mov`, H.264 previews use `.mp4`, and per-shot PNGs/markers live under `web/capture-output/<shot>/`.

Exports both views of `hero-sequence` to `web/capture-output/`:

- `hero-sequence-game/` — gameplay ProRes + H.264 + PNG frames + `markers.json`
- `hero-sequence-brain/` — live model activity on black plate (same ticks)

Single view:

```sh
npm run capture:build
CAPTURE_VIEW=game npm run capture:frames && CAPTURE_VIEW=game npm run capture:video
CAPTURE_VIEW=brain npm run capture:frames && CAPTURE_VIEW=brain npm run capture:video
```

Export URL shape: `/?capture=hero-sequence&view=game&export=1` (1080×1350, stepped via `window.__CAPTURE__.renderFrame`).

### Manual screen record

1. `npm run dev` in `web/`, open a capture URL (without `export=1`).
2. Wait for graph prep; capture autoplays when ready.
3. Screen-record the fullscreen canvas (OBS / QuickTime). Prefer 60 fps.
4. Press **R** for identical retakes.
5. Align Premiere cuts to `window.__CAPTURE__.markers` (also listed with `debug=1`).

`window.__CAPTURE__` exposes `preset`, `markers`, `suggestedCaptureWindow`, `renderFrame`, `getTick()`, `replay()`, `pause()`, and `getCanvas()`.

## Regenerating search evidence

```sh
node scripts/capture_sequence_search.mjs
```

Requires generated graph + WASM (same as other neural scripts). Updates `data/capture-sequences.json`. If markers change, update `web/src/capture/presets.ts` to match and keep the unit test in sync.

## Honesty

Markers are deterministic engineering observations from the authored controller over measured wiring. They are **not** biological causality claims. Synthetic cinematic activity on `/cinematic/` remains labeled separately and must not be presented as this live model buffer.
