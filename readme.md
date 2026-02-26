# Cinemetrics UI Rebuild (V2 Blueprint)

This document defines the **from-scratch rewrite direction** for the next version of the project.

Current decision: prioritize **UI/UX design first**, then implementation.

## V2 Focus

The repository has been intentionally cleaned up to focus on V2:

1. Legacy desktop UI runtime and Windows packaging assets were removed from active project structure.
2. Active stack is now:

- Web UI in `app/web`
- Backend API in `app/backend`
- Reused algorithm modules in `app/backend/algorithms`

## Current Prototype (Implemented)

A working UI prototype is now available at:

```text
app/web/
```

### Run Prototype

From repo root:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173/app/web/
```

### Start Backend API

In a separate terminal from repo root:

```bash
python3 -m uvicorn app.backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

Contract check:

```bash
curl http://127.0.0.1:8000/api/contract
```

### What Works Right Now

1. Import local video clip in browser.
2. Auto-generate metadata (duration, resolution, estimated fps/frame count).
3. Generate detailed shot data:

- average shot length (global)
- average scene length
- average shot length per scene
- shot scale composition per scene (heuristic)

4. Scene-level color analysis:

- per-scene dominant color
- color wheel with dominant hue highlighted

5. Scene-level object analysis:

- object detector output aggregated to scene-level notable props
- fallback heuristic props if detector is unavailable

6. API-driven frontend:

- web UI calls `POST /api/analyze`
- exports JSON/CSV from backend response model

### Current Technical Note

The web UI is now connected to a real backend contract and existing Python algorithms.
Some modules still use pragmatic fallback behavior when optional model inference fails.

## V2 Repository Structure

```text
pyCinemetrics/
├── app/
│   ├── __init__.py
│   ├── backend/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app + /api endpoints
│   │   ├── analysis_pipeline.py     # Scene/shot orchestration
│   │   └── algorithms/              # Integrated analysis modules (migrated legacy core)
│   └── web/
│       ├── index.html               # Cinematic UI shell
│       ├── styles.css               # Dark cinema theme
│       └── app.js                   # API-driven frontend logic
├── docs/
│   └── RELEASE.md
├── models/                          # Model assets/weights
├── img/                             # Generated analysis outputs (gitignored except .gitkeep)
├── video/                           # Optional local input clips
├── pyproject.toml
├── uv.lock
├── README.md
└── .github/workflows/ci.yml
```

## Backend API Contract (Implemented)

### `POST /api/analyze`

`multipart/form-data` request fields:

1. `video` (binary, required)
2. `scene_sensitivity` (int 1..10, default `6`)
3. `shot_threshold` (float 0.05..0.95, default `0.35`)
4. `include_object_detection` (bool, default `true`)
5. `include_shot_scale` (bool, default `true`)

Response keys:

1. `meta`
2. `global`
3. `shots`
4. `scenes`
5. `outputs`

The response is designed to directly power the web UI tabs.

## Progress Update

Implemented and integrated:

1. Scene/shot analysis backend endpoint with contract.
2. Existing algorithms integrated in backend pipeline:

- shot boundary generation (`TransNetV2`)
- shot scale inference (`shotscale`)
- object detection (`ObjectDetection`)

3. Scene-level metrics generated from backend output:

- ASL (global)
- average scene length
- average shot length per scene
- shot scale composition per scene

4. Scene-level color and props summaries surfaced in UI.
2. Export flows (JSON / scenes CSV / shots CSV) from live analysis results.

KIV (kept intentionally for now):

1. LLM API integration (UI draft generator is local template only).
2. Deeper semantic scene interpretation pipeline.

## Product Goal

Build a scene-centric film analysis app with a clear, modern interface where users can:

1. Import one video clip.
2. Instantly get metadata and high-level structure.
3. Explore analytics by **scene** first, then drill down to shots.
4. Export interpretable visual and tabular outputs.

## Features To Keep (Core Scope)

1. **Video Import + Metadata Generation**

- Once user imports a clip, generate metadata:
- filename, duration, fps, resolution, frame count
- shot count, scene count
- timecode range for each scene

1. **Detailed Shot Data**

- Generate average shot length (ASL).
- Generate average scene length (new).
- Generate average shot length per scene (new).
- Include shot scale composition per scene (new):
- long / medium / close-up proportions per scene

1. **Scene-Level Color Analysis**

- Compute dominant color at scene level (not shot level).
- Render a color wheel and highlight dominant hue per scene.

1. **Scene-Level Object Detection**

- Output notable props per scene.
- Keep output structured so future LLM interpretation can be plugged in.

## UX Principles

1. **Scene-first storytelling**

- Scene becomes the default unit for navigation and comparison.

1. **Progressive disclosure**

- First show summary metrics, then reveal detailed charts and tables.

1. **One primary path**

- Import -> Process -> Explore -> Export.

1. **Readable over technical**

- Keep labels academic but understandable for non-engineers.

## Proposed UI Information Architecture

1. **Import Screen**

- Dropzone / file picker
- recent projects
- processing requirements hint

1. **Project Overview Dashboard**

- metadata cards
- timeline strip with scene segmentation
- global KPIs (ASL, avg scene length, total scenes, total shots)

1. **Detailed Shot Data View**

- scene table
- per-scene metrics:
- scene duration
- shot count
- avg shot length in that scene
- shot scale composition (stacked bars or donuts)

1. **Color Analysis View**

- scene list on left
- color wheel on right
- dominant scene hue highlighted
- optional secondary palette per scene

1. **Object Analysis View**

- scene list
- notable props chips/tags per scene
- confidence/occurrence ranking
- placeholder panel: “LLM interpretation (future)”

1. **Export Center**

- export CSV/JSON
- export chart PNG/SVG
- export per-scene report bundle

## Primary User Flow

1. User imports a clip.
2. System computes metadata + shot boundaries + scene boundaries.
3. User lands on Overview with key numbers and segmented timeline.
4. User opens “Detailed Shot Data” for scene/shot structural metrics.
5. User opens “Color Analysis” and “Object Analysis” for scene meaning cues.
6. User exports selected outputs.

## Data Contracts (UI-facing)

Define these entities early so UI and backend stay aligned:

1. `VideoMeta`

- id, filename, duration_s, fps, width, height, frame_count

1. `Scene`

- scene_id, start_frame, end_frame, start_tc, end_tc, duration_s

1. `Shot`

- shot_id, scene_id, start_frame, end_frame, duration_s, shot_scale

1. `SceneColorSummary`

- scene_id, dominant_hue_deg, dominant_rgb, wheel_bin, palette[]

1. `SceneObjectSummary`

- scene_id, objects[] (`label`, `score`, `count`)

## Proposed UI Rewrite Folder Structure (Design-first)

```text
pyCinemetrics/
├── docs/
│   ├── product/
│   │   ├── vision.md
│   │   ├── user-flows.md
│   │   └── metrics-definitions.md
│   ├── ui/
│   │   ├── information-architecture.md
│   │   ├── wireframes.md
│   │   └── component-spec.md
│   └── api/
│       └── ui-data-contracts.md
├── app/
│   ├── web/
│   └── backend/
│       └── algorithms/
└── README.md
```

## Milestones

1. **M0 - Design Spec Complete**

- finalize IA, wireframes, metric definitions, scene/shot terminology

1. **M1 - Clickable Prototype**

- no real model inference
- mock data for all major screens

1. **M2 - Real Data Integration**

- metadata + scene/shot metrics endpoints connected

1. **M3 - Analysis Views**

- scene-level color wheel and object summaries from real pipeline

1. **M4 - Export + Review**

- report export and analyst feedback cycle

## Non-Goals For First Iteration

1. Perfect model accuracy.
2. Full cloud deployment.
3. LLM meaning analysis (only keep integration-ready output format now).

## Immediate Next Steps

1. Freeze KPI definitions:

- ASL, average scene length, average shot length per scene.

1. Lock the scene detection strategy:

- choose algorithm and scene/shot merge rule.

1. Draft wireframes for these 5 screens:

- Import, Overview, Detailed Shot Data, Color Analysis, Object Analysis.

1. Define API/JSON contracts for all UI panels before coding.

## Homage / Original Work

This V2 rewrite is built in respect of the original PyCinemetrics effort and contributors.

Please cite and acknowledge the original work:

1. Project portal: [https://movie.yingshinet.com](https://movie.yingshinet.com)
2. Research paper: [https://www.sciencedirect.com/science/article/pii/S2352711024000578](https://www.sciencedirect.com/science/article/pii/S2352711024000578)

V2 changes focus on architecture, UI, and API modernization while preserving the research intent of computational film analysis.
