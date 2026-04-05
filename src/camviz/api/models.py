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


class MeshFace(BaseModel):
    vertex_indices: tuple[int, int, int]
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
    model: Literal["radtan", "fisheye"] = "radtan"
    k1: float = 0.0
    k2: float = 0.0
    p1: float = 0.0
    p2: float = 0.0
    k3: float = 0.0
    k4: float = 0.0
    k5: float = 0.0
    k6: float = 0.0

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_model_name(cls, value: object) -> object:
        if isinstance(value, dict) and value.get("model") == "opencv":
            return {
                **value,
                "model": "radtan",
            }
        return value


class DisplayOptions(BaseModel):
    show_frustum: bool = True
    show_bbox: bool = True
    show_labels: bool = True
    show_axes: bool = True


class SedanSpec(BaseModel):
    type: Literal["sedan"]
    length: PositiveFloat
    width: PositiveFloat
    height: PositiveFloat
    wheelbase: PositiveFloat
    roof_height: PositiveFloat
    hood_length: PositiveFloat
    trunk_length: PositiveFloat
    pose: Pose3D = Field(default_factory=Pose3D)

    @model_validator(mode="after")
    def validate_proportions(self) -> SedanSpec:
        if self.hood_length + self.trunk_length >= self.length:
            raise ValueError("sedan hood_length + trunk_length must be less than total length")
        if self.wheelbase >= self.length:
            raise ValueError("sedan wheelbase must be less than total length")
        if self.roof_height > self.height:
            raise ValueError("sedan roof_height must not exceed total height")
        return self


class TruckSpec(BaseModel):
    type: Literal["truck"]
    cab_length: PositiveFloat
    cargo_length: PositiveFloat
    cargo_width: PositiveFloat
    cargo_height: PositiveFloat
    cab_height: PositiveFloat
    wheelbase: PositiveFloat
    pose: Pose3D = Field(default_factory=Pose3D)

    @model_validator(mode="after")
    def validate_proportions(self) -> TruckSpec:
        if self.wheelbase >= self.cab_length + self.cargo_length:
            raise ValueError("truck wheelbase must be shorter than the total truck length")
        return self


class BicycleSpec(BaseModel):
    type: Literal["bicycle"]
    wheel_diameter: PositiveFloat
    wheelbase: PositiveFloat
    frame_height: PositiveFloat
    handlebar_width: PositiveFloat
    saddle_height: PositiveFloat
    pose: Pose3D = Field(default_factory=Pose3D)

    @model_validator(mode="after")
    def validate_proportions(self) -> BicycleSpec:
        if self.saddle_height <= self.wheel_diameter / 2.0:
            raise ValueError("bicycle saddle_height must be above the wheel radius")
        return self


class PedestrianSpec(BaseModel):
    type: Literal["pedestrian"]
    body_height: PositiveFloat
    shoulder_width: PositiveFloat
    torso_depth: PositiveFloat
    hip_width: PositiveFloat
    head_scale: PositiveFloat
    pose: Pose3D = Field(default_factory=Pose3D)


class TrafficConeSpec(BaseModel):
    type: Literal["traffic_cone"]
    base_diameter: PositiveFloat
    top_diameter: PositiveFloat
    cone_height: PositiveFloat
    pose: Pose3D = Field(default_factory=Pose3D)

    @model_validator(mode="after")
    def validate_proportions(self) -> TrafficConeSpec:
        if self.top_diameter >= self.base_diameter:
            raise ValueError("traffic_cone top_diameter must be smaller than base_diameter")
        return self


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


ObjectSpec = Annotated[
    SedanSpec | TruckSpec | BicycleSpec | PedestrianSpec | TrafficConeSpec | CustomPointSpec,
    Field(discriminator="type"),
]


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
    image: Point2D | None
    visible: bool
    inside_image: bool


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
    visible_point_count: int
    hidden_point_count: int
    center_inside_image: bool
    bbox_intersects_image: bool
    bbox_inside_image: bool


class Contour2D(BaseModel):
    points: list[Point2D]


class DisplayMesh(BaseModel):
    vertices: list[Vector3]
    faces: list[MeshFace]


class ProjectionResult(BaseModel):
    object_type: str
    projected_points: list[PointDiagnostic]
    edges: list[Edge]
    faces: list[Face]
    center: PointDiagnostic
    bbox: BoundingBox
    principal_point: Point2D
    analysis: ProjectionAnalysis
    display_mesh: DisplayMesh
    silhouette: list[Contour2D]


class ObjectParameterDefinition(BaseModel):
    name: str
    label: str
    group: str
    min: float
    max: float
    step: float


class ObjectTypeDefinition(BaseModel):
    type: str
    label: str
    parameters: list[ObjectParameterDefinition]
    defaults: ObjectSpec


class ProjectionSchema(BaseModel):
    object_types: list[ObjectTypeDefinition]
    distortion_models: list[str]
    defaults: ProjectionRequest
