# PyCinemetrics (Fork)

This repository is a forked and refined version of PyCinemetrics, a desktop application for computational film analysis.

The project combines a Qt-based GUI player with multiple AI-assisted analysis pipelines:
- Shot boundary detection (TransNetV2)
- Color analysis (K-Means on shot frames)
- Object detection (VGG19 / ImageNet top-1 labels)
- Subtitle extraction (EasyOCR)
- Shot scale estimation (OpenPose-style keypoint reasoning)

The application generates visual outputs (`.png`) and structured data (`.csv`, `.srt`) under `img/<video_name>/`, so results can be used in both qualitative and quantitative film studies.

## Current Project Status

- GUI stack has been rewritten to **PySide6** (`src/main.py`, `src/ui/*`).
- Core analysis modules are in `src/algorithms/*`.
- Local model/runtime assets are included in-repo (`models/`, `native/`, `resources/`).
- A Windows PyInstaller spec is provided in `package/win64.spec`.

## Main Features

1. **ShotCut (Shot Segmentation)**
   - Uses TransNetV2 to detect scene boundaries.
   - Extracts representative frame images into `img/<video>/frame/`.
   - Exports `shotlen.csv`, `shotcut.csv`, and `shotlen.png`.

2. **Colors**
   - Runs K-Means on extracted shot frames.
   - Exports `colors.csv` (RGB values) and `colors.png` (3D color scatter).

3. **Objects**
   - Runs VGG19 inference on shot frames.
   - Exports `objects.csv` and `objects.png` (word cloud).

4. **Subtitles**
   - Uses EasyOCR to detect subtitle changes and text.
   - Exports `subtitle.csv`, `subtitle.srt`, and `subtitle.png` (word cloud).

5. **ShotScale**
   - Uses a pose-estimation model to classify shot size.
   - Exports `shotscale.csv` and `shotscale.png`.

6. **Timeline / Storyboard**
   - Displays extracted shot frames as clickable thumbnails.
   - Selecting a frame seeks the VLC player to the corresponding frame.
   - Double-clicking a frame runs single-image color pie analysis.

## Architecture Overview

- `src/main.py`
  - Creates `MainWindow`, docks, signals, and the global workflow.
- `src/ui/vlcplayer.py`
  - VLC-based video playback widget.
- `src/ui/control.py`
  - Main command panel and analysis trigger buttons.
- `src/ui/info.py`
  - Video metadata panel (FPS, dimensions, frame count, ASL, shot count).
- `src/ui/timeline.py`
  - Shot frame browser and player sync logic.
- `src/ui/subtitle.py`
  - Subtitle text panel.
- `src/ui/analyze.py`
  - Preview/zoom panel for generated analysis images.
- `src/algorithms/*`
  - Independent analysis pipelines for shots, colors, objects, subtitles, and shot scale.

## Requirements

### Python
- Python `>=3.11,<3.13` (from `pyproject.toml`)

### External Runtime Dependencies
- FFmpeg CLI (required by TransNetV2 video frame extraction)
- VLC runtime/library (required by `python-vlc`)

### Python Dependencies (core)
- `PySide6`
- `tensorflow` + `transnetv2`
- `torch`/`torchvision`
- `easyocr`
- `opencv-python`
- `matplotlib`, `numpy`, `pillow`
- `python-vlc`
- `wordcloud`, `jieba`

## Setup

Use one of the following:

### Option A: `uv` (recommended if you use `uv.lock`)

```bash
uv sync
```

### Option B: standard virtual environment

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e .
```

## Run

Important: the desktop GUI entry point is `src/main.py` (not root `main.py`).

```bash
python src/main.py
```

## Typical Workflow in the App

1. Open a video file from the File menu or VLC open button.
2. Run `ShotCut` first to generate frame-level shot assets.
3. Run `Colors`, `Objects`, `Subtitles`, and `ShotScale` as needed.
4. Inspect generated charts in the Analyze panel.
5. Export CSV files with the `.csv` buttons.
6. Use Timeline thumbnails to navigate and inspect frames.

## Generated Outputs

For an input video `<name>.mp4`, outputs are stored in:

```text
img/<name>/
```

Expected files include:

- `frame/frameXXXX.png` (shot keyframes)
- `shotcut.csv`
- `shotlen.csv`
- `shotlen.png`
- `colors.csv`
- `colors.png`
- `objects.csv`
- `objects.png`
- `subtitle.csv`
- `subtitle.srt`
- `subtitle.png`
- `shotscale.csv`
- `shotscale.png`

## File Structure

```text
pyCinemetrics/
├── src/
│   ├── main.py
│   ├── helper.py
│   ├── ui/
│   │   ├── analyze.py
│   │   ├── control.py
│   │   ├── info.py
│   │   ├── subtitle.py
│   │   ├── timeline.py
│   │   └── vlcplayer.py
│   └── algorithms/
│       ├── shotcutTransNetV2.py
│       ├── img2Colors.py
│       ├── objectDetection.py
│       ├── subtitleEasyOcr.py
│       ├── shotscale.py
│       ├── shotscaleconfig.py
│       ├── resultsave.py
│       ├── wordcloud2frame.py
│       ├── imagenet_classes.txt
│       ├── stopword.txt
│       └── AIDict.txt
├── models/
│   ├── transnetv2-weights/
│   │   ├── saved_model.pb
│   │   └── variables/
│   └── pose/
│       ├── body_25/
│       │   ├── pose_deploy.prototxt
│       │   └── pose_iter_584000.caffemodel
│       └── coco/
│           └── pose_deploy_linevec.prototxt
├── native/
│   ├── vlc-3.0.18-win64/   # bundled VLC runtime (Windows packaging)
│   └── upx-4.1.0-win64/
├── package/
│   └── win64.spec          # PyInstaller spec
├── resources/
│   ├── icon.ico
│   └── splash.png
├── img/
│   ├── sample/             # sample generated outputs
│   └── <video-name>/       # generated per-video analysis outputs
├── video/                  # optional source videos
├── pyproject.toml
├── uv.lock
├── requirements.txt
├── LICENSE.txt
├── GUIDE.pdf
├── main.py                 # placeholder script, not GUI entrypoint
└── readme.md
```

## Known Gaps / Caveats

- `requirements.txt` still references older dependencies (for example PySide2), while current GUI code uses PySide6.
- `pyproject.toml` references `README.md` but this repository currently uses `readme.md` (case-sensitive systems may fail packaging metadata reads).
- `WordCloud2Frame` currently uses a Windows font path (`c:\Windows\Fonts\simfang.ttf`), which may require adaptation on macOS/Linux.
- First-time model use may trigger large downloads/caching (for example torchvision weights).
- There are no automated tests in this fork yet.

## References

- Original project page: [movie.yingshinet.com](https://movie.yingshinet.com)
- Paper: [Computational film studies tool article](https://www.sciencedirect.com/science/article/pii/S2352711024000578)

## What You Should Do Next

1. **Unify dependency management**
   - Decide on one source of truth (`pyproject.toml` + `uv.lock` or `requirements.txt`) and remove drift.
   - Align README filename/reference (`README.md` vs `readme.md`) for packaging consistency.

2. **Stabilize cross-platform runtime**
   - Replace hard-coded Windows font path with OS-aware font discovery.
   - Verify VLC loading on macOS/Linux and document platform-specific setup.

3. **Make startup/entry points explicit**
   - Keep `src/main.py` as canonical app entry.
   - Update root `main.py` or remove it to avoid confusion.

4. **Add automated checks**
   - Start with smoke tests for core pipelines and output file generation.
   - Add lint/type checks for safer refactors.

5. **Document versioned release flow**
   - Capture packaging and release steps (especially Windows `package/win64.spec`) in a dedicated release guide.
