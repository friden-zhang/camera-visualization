from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

from camviz.api.models import (
    BicycleSpec,
    CustomPointSpec,
    Edge,
    LabeledPoint3D,
    ObjectParameterDefinition,
    ObjectSpec,
    ObjectTypeDefinition,
    PedestrianSpec,
    Pose3D,
    SedanSpec,
    TrafficConeSpec,
    TruckSpec,
)

OBJECT_TYPE_ORDER = ["sedan", "truck", "bicycle", "pedestrian", "traffic_cone"]
ASSET_DIRECTORY = Path(__file__).resolve().parents[1] / "assets" / "objects"


class ObjectAssetMetadata(BaseModel):
    type: str
    label: str
    parameters: list[ObjectParameterDefinition]
    defaults: dict[str, float]
    landmarks: list[str]


def _default_object_pose() -> Pose3D:
    return Pose3D(x=0.0, y=14.0, z=0.0, yaw=0.0, pitch=0.0, roll=0.0)


@lru_cache(maxsize=1)
def load_object_assets() -> dict[str, ObjectAssetMetadata]:
    assets: dict[str, ObjectAssetMetadata] = {}
    for object_type in OBJECT_TYPE_ORDER:
        asset_path = ASSET_DIRECTORY / f"{object_type}.json"
        payload = json.loads(asset_path.read_text(encoding="utf-8"))
        asset = ObjectAssetMetadata.model_validate(payload)
        assets[asset.type] = asset
    return assets


def build_parameterized_spec(object_type: str, pose: Pose3D | None = None) -> ObjectSpec:
    asset = load_object_assets()[object_type]
    resolved_pose = pose or _default_object_pose()
    if object_type == "sedan":
        return SedanSpec(type="sedan", pose=resolved_pose, **asset.defaults)
    if object_type == "truck":
        return TruckSpec(type="truck", pose=resolved_pose, **asset.defaults)
    if object_type == "bicycle":
        return BicycleSpec(type="bicycle", pose=resolved_pose, **asset.defaults)
    if object_type == "pedestrian":
        return PedestrianSpec(type="pedestrian", pose=resolved_pose, **asset.defaults)
    if object_type == "traffic_cone":
        return TrafficConeSpec(type="traffic_cone", pose=resolved_pose, **asset.defaults)
    raise KeyError(f"Unsupported object type: {object_type}")


def build_custom_points_default() -> CustomPointSpec:
    return CustomPointSpec(
        type="custom_points",
        pose=_default_object_pose(),
        points=[
            LabeledPoint3D(id="a", x=-1.0, y=-1.0, z=0.0),
            LabeledPoint3D(id="b", x=1.0, y=-1.0, z=0.0),
            LabeledPoint3D(id="c", x=1.0, y=1.0, z=0.0),
            LabeledPoint3D(id="d", x=-1.0, y=1.0, z=0.0),
            LabeledPoint3D(id="e", x=0.0, y=0.0, z=2.0),
        ],
        edges=[
            Edge(start_id="a", end_id="b"),
            Edge(start_id="b", end_id="c"),
            Edge(start_id="c", end_id="d"),
            Edge(start_id="d", end_id="a"),
            Edge(start_id="a", end_id="e"),
            Edge(start_id="b", end_id="e"),
            Edge(start_id="c", end_id="e"),
            Edge(start_id="d", end_id="e"),
        ],
        faces=[],
    )


def build_object_type_definitions() -> list[ObjectTypeDefinition]:
    assets = load_object_assets()
    definitions = [
        ObjectTypeDefinition(
            type=object_type,
            label=assets[object_type].label,
            parameters=assets[object_type].parameters,
            defaults=build_parameterized_spec(object_type),
        )
        for object_type in OBJECT_TYPE_ORDER
    ]
    definitions.append(
        ObjectTypeDefinition(
            type="custom_points",
            label="Custom Points",
            parameters=[],
            defaults=build_custom_points_default(),
        )
    )
    return definitions
