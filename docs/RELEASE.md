# Release Guide (V2)

This project has shifted to a V2 web + backend architecture.

## Scope

Release artifacts focus on:

1. Backend API (`app/backend`)
2. Web client (`app/web`)
3. Algorithm integration under `app/backend/algorithms`

Legacy Windows desktop packaging flow has been removed from the active release process.

## 1. Pre-release Checks

```bash
python -m compileall app/backend
node --check app/web/app.js
```

## 2. Version Update

1. Update `version` in `pyproject.toml`.
2. Refresh lockfile if dependencies changed:

```bash
uv lock
```

## 3. Validate API Contract

Run locally:

```bash
python3 -m uvicorn app.backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Then verify:

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/contract
```

## 4. Validate Web Client

Run static server:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173/app/web/` and run one full analysis pass:

1. Import video.
2. Run analysis.
3. Confirm all tabs render.
4. Export JSON + CSV outputs.

## 5. Tag and Publish

1. Create annotated tag (for example `v0.2.0`).
2. Push branch and tag.
3. Publish release notes including API contract changes.
