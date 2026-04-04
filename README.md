# camera-visualization

Interactive camera projection validator with a Python/FastAPI math backend and a React/Vite visualization frontend.

## Stack

- Backend: `uv`, `FastAPI`, `Pydantic`, `NumPy`, `OpenCV`
- Frontend: `React`, `TypeScript`, `Vite`, `zustand`, `react-three-fiber`

## Features

- Camera intrinsics, distortion, camera pose, and object pose editing
- Object types: `box`, `rectangle`, `custom_points`
- Views: ground top view, 3D scene, image projection, distortion compare
- Numeric diagnostics: bbox, pixel span, coverage ratio, visibility, distortion offset
- Overlay image loading for the projection view
- Hover and selection sync across views through shared point ids

## Project Layout

```text
src/camviz/core/   projection math, geometry, transforms
src/camviz/api/    FastAPI app and request/response models
tests/             backend projection and API tests
web/               React single-page app
```

## Backend Setup

```bash
uv sync --dev
uv run uvicorn camviz.api.app:app --reload
```

Backend API is available at `http://127.0.0.1:8000`.

## Frontend Setup

```bash
cd web
corepack pnpm install
corepack pnpm dev
```

Frontend dev server runs at `http://127.0.0.1:5173` and proxies `/api` to the FastAPI backend.

## One Command Dev Startup

```bash
./scripts/dev.sh
```

This script syncs Python dependencies, installs frontend dependencies, then starts both the FastAPI backend and the Vite frontend together.

Optional environment overrides:

```bash
BACKEND_HOST=0.0.0.0 BACKEND_PORT=8000 FRONTEND_HOST=0.0.0.0 FRONTEND_PORT=5173 ./scripts/dev.sh
SKIP_INSTALL=1 ./scripts/dev.sh
```

## Verification

```bash
uv run pytest
uv run ruff check
uv run mypy
cd web && corepack pnpm test
cd web && corepack pnpm build
```

## Notes

- The backend serves `web/dist` automatically after a production build.
- The current production bundle is large because the first pass includes `three` and related rendering libraries without code-splitting yet.
