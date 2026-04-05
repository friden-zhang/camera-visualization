# camera-visualization

Interactive camera projection validator with a Python/FastAPI math backend and a React/Vite visualization frontend.

## Stack

- Backend: `uv`, `FastAPI`, `Pydantic`, `NumPy`, `OpenCV`
- Frontend: `React`, `TypeScript`, `Vite`, `zustand`, `react-three-fiber`

## Features

- Camera intrinsics, distortion, camera pose, and object pose editing
- Object types: `sedan`, `truck`, `bicycle`, `pedestrian`, `traffic_cone`, `custom_points`
- Views: 3D scene, image projection, and debug info
- Final-image diagnostics: distorted bbox, pixel span, coverage ratio, and visibility
- Overlay image loading for the projection view
- Persistent local workspace state, including layout sizes and overlay image
- Reset-to-defaults workflow for restoring schema defaults and layout

## Distortion Models

- `Standard (RadTan)`: standard radial+tangential distortion model for normal pinhole cameras
- `Fisheye`: fisheye distortion model for ultra-wide or fisheye lenses

The legacy internal name `opencv` is still accepted on input for compatibility, but the UI and API schema now use `radtan`.

`Image Projection View` and all reported image-space statistics use the final distorted image coordinates produced by the selected distortion model and coefficients.

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
