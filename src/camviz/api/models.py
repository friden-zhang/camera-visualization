from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, PositiveFloat, PositiveInt, model_validator


class Vector3(BaseModel):
    x: float
    y: float
    z: float


class Point2D(BaseModel):
    x: float
    y: float


class LabeledPoint3D(Vector3):
    id: str


class Edge(BaseModel):
    start_id: str
    end_id: str


class Face(BaseModel):
    point_ids: list[str]
    label: str | None = None


class Pose3D(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    yaw: float = 0.0
    pitch: float = 0.0
    roll: float = 0.0


class CameraIntrinsics(BaseModel):
    fx: PositiveFloat
    fy: PositiveFloat
    cx: float
    cy: float
    image_width: PositiveInt
    image_height: PositiveInt


class DistortionModel(BaseModel):
    model: Literal["opencv", "fisheye"] = "opencv"
    k1: float = 0.0
    k2: float = 0.0
    p1: float = 0.0
    p2: float = 0.0
    k3: float = 0.0
    k4: float = 0.0
    k5: float = 0.0
    k6: float = 0.0


class DisplayOptions(BaseModel):
    show_frustum: bool = True
    show_bbox: bool = True
    show_distorted: bool = True
    show_undistorted: bool = True
    show_labels: bool = True
    show_axes: bool = True


class BoxSpec(BaseModel):
    type: Literal["box"]
    width: PositiveFloat
    length: PositiveFloat
    height: PositiveFloat
    pose: Pose3D = Field(default_factory=Pose3D)


class RectangleSpec(BaseModel):
    type: Literal["rectangle"]
    width: PositiveFloat
    length: PositiveFloat
    pose: Pose3D = Field(default_factory=Pose3D)


class CustomPointSpec(BaseModel):
    type: Literal["custom_points"]
    pose: Pose3D = Field(default_factory=Pose3D)
    points: list[LabeledPoint3D]
    edges: list[Edge] = Field(default_factory=list)
    faces: list[Face] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_topology(self) -> CustomPointSpec:
        point_ids = [point.id for point in self.points]
        if len(point_ids) != len(set(point_ids)):
            raise ValueError("custom_points point ids must be unique")
        point_id_set = set(point_ids)
        for edge in self.edges:
            if edge.start_id not in point_id_set or edge.end_id not in point_id_set:
                raise ValueError("custom_points edges must reference existing point ids")
        for face in self.faces:
            if not face.point_ids:
                raise ValueError("custom_points faces must include at least one point id")
            if any(point_id not in point_id_set for point_id in face.point_ids):
                raise ValueError("custom_points faces must reference existing point ids")
        return self


ObjectSpec = Annotated[BoxSpec | RectangleSpec | CustomPointSpec, Field(discriminator="type")]


class ProjectionRequest(BaseModel):
    camera_intrinsics: CameraIntrinsics
    distortion: DistortionModel = Field(default_factory=DistortionModel)
    camera_pose: Pose3D = Field(default_factory=Pose3D)
    object_spec: ObjectSpec
    display_options: DisplayOptions = Field(default_factory=DisplayOptions)


class PointDiagnostic(BaseModel):
    point_id: str
    world: Vector3
    camera: Vector3
    undistorted_image: Point2D | None
    distorted_image: Point2D | None
    visible: bool
    inside_image: bool
    inside_image_undistorted: bool


class BoundingBox(BaseModel):
    min_x: float
    max_x: float
    min_y: float
    max_y: float
    width: float
    height: float
    inside_image: bool
    intersects_image: bool


class ProjectionAnalysis(BaseModel):
    pixel_width: float
    pixel_height: float
    coverage_ratio: float
    distortion_mean_offset_px: float
    distortion_max_offset_px: float
    visible_point_count: int
    hidden_point_count: int
    center_inside_image: bool
    bbox_intersects_image: bool
    bbox_inside_image: bool


class ProjectionResult(BaseModel):
    projected_points: list[PointDiagnostic]
    edges: list[Edge]
    faces: list[Face]
    center: PointDiagnostic
    bbox: BoundingBox
    undistorted_bbox: BoundingBox
    principal_point: Point2D
    analysis: ProjectionAnalysis


class ProjectionSchema(BaseModel):
    object_types: list[str]
    distortion_models: list[str]
    defaults: ProjectionRequest
