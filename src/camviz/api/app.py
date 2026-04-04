from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from camviz.api.models import (
    CameraIntrinsics,
    DisplayOptions,
    DistortionModel,
    Pose3D,
    ProjectionRequest,
    ProjectionResult,
    ProjectionSchema,
)
from camviz.core.engine import evaluate_projection
from camviz.core.object_assets import build_object_type_definitions, build_parameterized_spec


def build_default_request() -> ProjectionRequest:
    return ProjectionRequest(
        camera_intrinsics=CameraIntrinsics(
            fx=960.0,
            fy=960.0,
            cx=640.0,
            cy=360.0,
            image_width=1280,
            image_height=720,
        ),
        distortion=DistortionModel(),
        camera_pose=Pose3D(x=0.0, y=-4.0, z=1.7, yaw=0.0, pitch=5.0, roll=0.0),
        object_spec=build_parameterized_spec("sedan", pose=Pose3D(x=0.0, y=14.0, z=0.0)),
        display_options=DisplayOptions(),
    )


def build_schema() -> ProjectionSchema:
    return ProjectionSchema(
        object_types=build_object_type_definitions(),
        distortion_models=["opencv", "fisheye"],
        defaults=build_default_request(),
    )


def build_app() -> FastAPI:
    app = FastAPI(title="Camera Projection Visualizer", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/schema", response_model=ProjectionSchema)
    def schema() -> ProjectionSchema:
        return build_schema()

    @app.post("/api/projection/evaluate", response_model=ProjectionResult)
    def evaluate(request: ProjectionRequest) -> ProjectionResult:
        return evaluate_projection(request)

    dist_dir = Path(__file__).resolve().parents[3] / "web" / "dist"
    if dist_dir.exists():
        app.mount("/assets", StaticFiles(directory=dist_dir / "assets"), name="assets")

        @app.get("/{full_path:path}")
        def spa(full_path: str) -> FileResponse:
            candidate = dist_dir / full_path
            if full_path and candidate.exists() and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(dist_dir / "index.html")

    return app


app = build_app()

