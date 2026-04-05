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

## Parameter Setup Walkthrough

The screenshots below show a typical long-range truck setup. The left panel is the primary control surface: set calibration first, then set camera pose, then set object dimensions and pose. The right side updates the 3D scene, final-image projection, and debug statistics from the same inputs.

### 1. Workspace Overview

<img src="https://my-obsidian-vault-1419031144.cos.ap-beijing.myqcloud.com/images/20260405220229216.png" alt="Workspace overview with camera, object, and projection panels" />

- `3D Scene View` is used to sanity-check the spatial relationship between the camera and the object.
- `Image Projection View` shows the final distorted image-space result.
- `Debug Info` reports the current object type, selected landmark, image coordinates, pixel width, pixel height, coverage, and visibility counts.
- The left panel is organized into `Camera Intrinsics`, `Distortion`, `Camera Pose`, `Object`, and `Display Options`.

### 2. Camera Intrinsics and Distortion

<img src="https://my-obsidian-vault-1419031144.cos.ap-beijing.myqcloud.com/images/20260405215502464.png" alt="Camera intrinsics section in the full workspace layout" />

<img src="https://my-obsidian-vault-1419031144.cos.ap-beijing.myqcloud.com/images/20260405215527615.png" alt="Camera intrinsics and distortion parameter panels" />

- `fx` and `fy` are focal lengths in pixels. Use the calibrated values from your camera model.
- `cx` and `cy` are the principal point in pixels. These should normally come from the same calibration as `fx` and `fy`.
- `image_width` and `image_height` must match the target image resolution exactly; otherwise pixel coordinates and coverage statistics will be wrong.
- `Model` chooses the distortion family. Use `Standard (RadTan)` for normal pinhole cameras with radial+tangential distortion.
- Use `Fisheye` only when your calibration parameters come from a fisheye model.
- `k1` to `k6` and `p1`/`p2` are applied directly in the backend projection math. The `Image Projection View` and all reported image-space statistics use the final distorted coordinates produced by these values.
- In most workflows, set `Camera Intrinsics` and `Distortion` first and leave them fixed while exploring pose and object changes.

### 3. Camera Pose

<img src="https://my-obsidian-vault-1419031144.cos.ap-beijing.myqcloud.com/images/20260405215552753.png" alt="Camera pose parameter panel" />

- World coordinates use `x` to the right, `y` forward, and `z` up.
- `camera_pose.x`, `camera_pose.y`, and `camera_pose.z` place the camera in world space.
- `yaw` rotates the camera left/right around the vertical axis.
- `pitch` tilts the camera up/down. For the camera, a positive `pitch` means looking downward toward the scene.
- `roll` rotates the camera around its forward optical axis.
- A practical workflow is to set `z` to the real installation height first.
- Then set `y` so the camera sits behind the object or road scene origin.
- Use small positive `pitch` values to point the camera toward the ground plane.
- Leave `roll` at `0` unless the physical installation is intentionally canted.

### 4. Object Type, Dimensions, and Pose

<img src="https://my-obsidian-vault-1419031144.cos.ap-beijing.myqcloud.com/images/20260405215606902.png" alt="Object parameter panel for a truck example" />

- `Type` chooses the object family: `sedan`, `truck`, `bicycle`, `pedestrian`, `traffic_cone`, or `custom_points`.
- Each object type exposes its own physical parameters.
- In the truck example, `Cab Length`, `Cargo Length`, `Cargo Width`, `Cargo Height`, `Cab Height`, and `Wheelbase` control the generated mesh shape.
- `object x`, `object y`, and `object z` place the object in world space relative to the camera.
- `object yaw`, `object pitch`, and `object roll` rotate the object. In most road-scene cases, keep `pitch` and `roll` at `0` and adjust `yaw` only.
- Start by setting the physical size to the real object dimensions, then move the object with `x/y/z` until the projected size and position match the target scenario.
- `Pixel width`, `Pixel height`, and `Coverage` in `Debug Info` are useful for validating whether the chosen object dimensions and distance are producing a realistic final image footprint.

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
