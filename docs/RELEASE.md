# Release Guide

This document defines the versioned release flow for this fork.

## 1. Pre-release Checks

Run locally before version bumps:

```bash
python -m ruff check main.py src/algorithms/wordcloud2frame.py src/ui/vlcplayer.py tests
python -m mypy main.py src/algorithms/wordcloud2frame.py src/ui/vlcplayer.py
python -m pytest -q
```

Ensure CI is green for the release branch/tag.

## 2. Version Update

1. Update `version` in `pyproject.toml`.
2. Refresh lockfile if dependencies changed:

```bash
uv lock
```

3. Commit with a release message (for example `release: v0.1.1`).

## 3. Changelog Snapshot

Summarize:

- user-facing features
- bug fixes
- breaking changes
- migration/setup notes

## 4. Windows Packaging (`packaging/pyinstaller/win64.spec`)

Build from repository root (Windows environment):

```bash
pyinstaller packaging/pyinstaller/win64.spec
```

Expected spec behavior:

- entry script: `src/main.py`
- includes bundled VLC runtime: `native/vlc-3.0.18-win64/`
- includes splash/icon resources from `resources/`

Compatibility note:

- Legacy path `package/win64.spec` is retained and delegates to the canonical spec.

Validate packaged app:

1. Launch executable.
2. Open a video and play.
3. Run `ShotCut`, `Colors`, and one additional module.
4. Confirm output files generated under `img/<video_name>/`.

## 5. Tag and Publish

1. Create annotated git tag (for example `v0.1.1`).
2. Push branch and tag.
3. Publish release notes + packaged artifacts.

## 6. Post-release

- Track regressions from user reports.
- Backport urgent fixes to a patch release if needed.
