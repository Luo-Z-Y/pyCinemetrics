# PyCinemetrics (Fork)

This repository is a refined fork of PyCinemetrics, a desktop toolkit for computational film analysis. The application combines video playback with AI-assisted analysis pipelines and exports reusable research artifacts (`.csv`, `.png`, `.srt`).

## Scope

- Shot boundary detection (TransNetV2)
- Dominant color analysis (K-Means)
- Object detection (VGG19 / ImageNet top-1)
- Subtitle extraction (EasyOCR)
- Shot scale estimation (OpenPose-style keypoint reasoning)

## Canonical Entrypoints

- GUI app entrypoint: `src/main.py`
- Root convenience entrypoint: `main.py` (delegates to `src/main.py`)

Run either:

```bash
python src/main.py
# or
python main.py
```

## Dependency Management

Source of truth is:

- `pyproject.toml`
- `uv.lock`

`requirements.txt` is kept only as a compatibility shim and installs the package from `pyproject.toml`:

```text
-e .
```

Recommended install:

```bash
uv sync
```

Alternative:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e .
```

## Runtime Setup

### FFmpeg

TransNetV2 frame extraction requires FFmpeg CLI to be available in `PATH`.

### VLC (`python-vlc`)

The app supports default VLC discovery and explicit overrides.

Supported env vars:

- `PYCINEMETRICS_VLC_LIB_PATH`
- `PYCINEMETRICS_VLC_PLUGIN_PATH`

These are mapped to `python-vlc` runtime vars internally:

- `PYTHON_VLC_LIB_PATH`
- `PYTHON_VLC_MODULE_PATH`

Platform notes:

- Windows: the app auto-detects bundled VLC at `native/vlc-3.0.18-win64`.
- macOS: install VLC (for example with Homebrew) if not already available to `python-vlc`.
- Linux: install `vlc` + `libvlc` packages from your distro.

Verification command:

```bash
python - <<'PY'
import vlc
inst = vlc.Instance()
print('VLC OK:', bool(inst))
PY
```

Verification status in this workspace:

- macOS (`Darwin`) verified on **February 25, 2026**: `import vlc` and `vlc.Instance()` both succeeded.
- Linux: documented setup above; run the same verification command on your target distro.

## WordCloud Font Handling

`src/algorithms/wordcloud2frame.py` now resolves fonts in this order:

1. `PYCINEMETRICS_WORDCLOUD_FONT` (if set)
2. OS-specific candidate fonts (Windows/macOS/Linux)
3. WordCloud default fallback

This removes the previous Windows-only hard-coded path.

## Typical App Workflow

1. Open a video in the player.
2. Run `ShotCut` first to produce shot frames.
3. Run other modules: `Colors`, `Objects`, `Subtitles`, `ShotScale`.
4. Inspect generated charts in Analyze panel.
5. Export artifacts with `.csv` buttons.

Outputs are generated per video under:

```text
img/<video_name>/
```

Typical artifacts:

- `frame/frameXXXX.png`
- `shotcut.csv`, `shotlen.csv`, `shotlen.png`
- `colors.csv`, `colors.png`
- `objects.csv`, `objects.png`
- `subtitle.csv`, `subtitle.srt`, `subtitle.png`
- `shotscale.csv`, `shotscale.png`

## Automated Checks

This fork now includes:

- Smoke tests for output generation (`tests/smoke/`)
- Lint: `ruff`
- Type checks: `mypy`

Run checks:

```bash
python -m pytest -q
python -m ruff check main.py src/algorithms/wordcloud2frame.py src/ui/vlcplayer.py tests
python -m mypy main.py src/algorithms/wordcloud2frame.py src/ui/vlcplayer.py
```

## File Structure

```text
pyCinemetrics/
├── docs/
│   ├── GUIDE.pdf
│   └── RELEASE.md
├── packaging/
│   └── pyinstaller/
│       └── win64.spec      # canonical PyInstaller spec
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
│       └── wordcloud2frame.py
├── models/
├── native/
├── package/
│   └── win64.spec          # compatibility wrapper to canonical spec
├── resources/
├── img/
├── video/
├── tests/
│   └── smoke/
├── .github/workflows/
│   └── ci.yml
├── pyproject.toml
├── uv.lock
├── requirements.txt
├── main.py
├── readme.md
└── readme.txt
```

## Release Flow

Versioning and packaging are documented in:

- `docs/RELEASE.md`

Canonical Windows packaging spec is `packaging/pyinstaller/win64.spec`.
Legacy path `package/win64.spec` is kept as a compatibility wrapper.

## References

- Original project page: [movie.yingshinet.com](https://movie.yingshinet.com)
- Paper: [Computational film studies tool article](https://www.sciencedirect.com/science/article/pii/S2352711024000578)
