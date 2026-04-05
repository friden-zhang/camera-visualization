from __future__ import annotations

import cv2
import numpy as np
from fastapi.testclient import TestClient

from camviz.api.app import build_app
from camviz.api.models import Pose3D
from camviz.core.transforms import local_to_world, world_to_camera


def build_payload() -> dict[str, object]:
    return {
        "camera_intrinsics": {
            "fx": 900.0,
            "fy": 900.0,
            "cx": 640.0,
            "cy": 360.0,
            "image_width": 1280,
            "image_height": 720,
        },
        "distortion": {
            "model": "radtan",
            "k1": 0.1,
            "k2": -0.02,
            "p1": 0.001,
            "p2": -0.002,
            "k3": 0.002,
        },
        "camera_pose": {"x": 0.0, "y": -3.0, "z": 1.6, "yaw": 0.0, "pitch": 5.0, "roll": 0.0},
        "object_spec": {
            "type": "sedan",
            "length": 4.6,
            "width": 1.82,
            "height": 1.48,
            "wheelbase": 2.75,
            "roof_height": 1.18,
            "hood_length": 1.1,
            "trunk_length": 0.9,
            "pose": {"x": 0.0, "y": 14.0, "z": 0.0, "yaw": 0.0, "pitch": 0.0, "roll": 0.0},
        },
        "display_options": {
            "show_frustum": True,
            "show_bbox": True,
            "show_labels": True,
            "show_axes": True,
        },
    }


def test_schema_endpoint_exposes_supported_object_definitions_and_defaults() -> None:
    client = TestClient(build_app())

    response = client.get("/api/schema")

    assert response.status_code == 200
    payload = response.json()
    assert [item["type"] for item in payload["object_types"]] == [
        "sedan",
        "truck",
        "bicycle",
        "pedestrian",
        "traffic_cone",
        "custom_points",
    ]
    assert payload["defaults"]["object_spec"]["type"] == "sedan"
    assert payload["defaults"]["camera_intrinsics"] == {
        "fx": 1567.36,
        "fy": 1567.31,
        "cx": 961.59,
        "cy": 542.3,
        "image_width": 1920,
        "image_height": 1080,
    }
    assert payload["defaults"]["distortion"] == {
        "model": "radtan",
        "k1": -0.31,
        "k2": 0.08,
        "p1": 0.0,
        "p2": 0.0,
        "k3": 0.07,
        "k4": 0.0,
        "k5": 0.0,
        "k6": 0.0,
    }
    sedan = next(item for item in payload["object_types"] if item["type"] == "sedan")
    assert any(parameter["name"] == "wheelbase" for parameter in sedan["parameters"])
    assert payload["distortion_models"] == ["radtan", "fisheye"]


def test_evaluate_projection_returns_landmarks_mesh_silhouette_and_analysis() -> None:
    client = TestClient(build_app())

    response = client.post("/api/projection/evaluate", json=build_payload())

    assert response.status_code == 200
    payload = response.json()
    assert payload["object_type"] == "sedan"
    assert len(payload["projected_points"]) > 0
    assert "image" in payload["projected_points"][0]
    assert "distorted_image" not in payload["projected_points"][0]
    assert "undistorted_image" not in payload["projected_points"][0]
    assert len(payload["display_mesh"]["vertices"]) > 0
    assert len(payload["display_mesh"]["faces"]) > 0
    assert len(payload["silhouette"]) > 0
    assert payload["bbox"]["width"] > 0.0
    assert payload["analysis"]["coverage_ratio"] > 0.0
    assert "undistorted_bbox" not in payload
    assert "distortion_mean_offset_px" not in payload["analysis"]
    assert "distortion_max_offset_px" not in payload["analysis"]
    assert payload["analysis"]["pixel_width"] == payload["bbox"]["width"]
    assert payload["analysis"]["pixel_height"] == payload["bbox"]["height"]
    assert payload["center"]["point_id"] == "object_center"


def test_legacy_opencv_distortion_alias_is_still_accepted() -> None:
    client = TestClient(build_app())
    payload = build_payload()
    payload["distortion"]["model"] = "opencv"

    response = client.post("/api/projection/evaluate", json=payload)

    assert response.status_code == 200


def test_api_projection_matches_opencv_reference_points() -> None:
    client = TestClient(build_app())
    payload = build_payload()
    payload["camera_intrinsics"] = {
        "fx": 1567.356367755675,
        "fy": 1567.306968974894,
        "cx": 961.587845652537,
        "cy": 542.296141020186,
        "image_width": 1920,
        "image_height": 1080,
    }
    payload["distortion"] = {
        "model": "radtan",
        "k1": -0.310387649487,
        "k2": 0.076313217331,
        "p1": -0.000111535757,
        "p2": -0.000564977398,
        "k3": 0.070410443420,
        "k4": 0.0,
        "k5": 0.0,
        "k6": 0.0,
    }
    payload["camera_pose"] = {
        "x": 0.0,
        "y": -4.0,
        "z": 1.7,
        "yaw": 0.0,
        "pitch": 5.0,
        "roll": 0.0,
    }
    payload["object_spec"] = {
        "type": "custom_points",
        "pose": {"x": 0.0, "y": 14.0, "z": 0.0, "yaw": 0.0, "pitch": 0.0, "roll": 0.0},
        "points": [
            {"id": "left_base", "x": -1.0, "y": 0.0, "z": 0.0},
            {"id": "right_base", "x": 1.0, "y": 0.0, "z": 0.0},
            {"id": "top", "x": 0.0, "y": 0.0, "z": 3.65},
        ],
        "edges": [
            {"start_id": "left_base", "end_id": "right_base"},
            {"start_id": "left_base", "end_id": "top"},
            {"start_id": "right_base", "end_id": "top"},
        ],
    }

    response = client.post("/api/projection/evaluate", json=payload)

    assert response.status_code == 200
    body = response.json()
    camera_matrix = np.array(
        [
            [payload["camera_intrinsics"]["fx"], 0.0, payload["camera_intrinsics"]["cx"]],
            [0.0, payload["camera_intrinsics"]["fy"], payload["camera_intrinsics"]["cy"]],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )
    distortion_vector = np.array(
        [
            payload["distortion"]["k1"],
            payload["distortion"]["k2"],
            payload["distortion"]["p1"],
            payload["distortion"]["p2"],
            payload["distortion"]["k3"],
        ],
        dtype=np.float64,
    )
    local_points = np.array(
        [[point["x"], point["y"], point["z"]] for point in payload["object_spec"]["points"]],
        dtype=np.float64,
    )
    world_points = local_to_world(local_points, Pose3D(**payload["object_spec"]["pose"]))
    camera_points = world_to_camera(world_points, Pose3D(**payload["camera_pose"]))
    cv_projected, _ = cv2.projectPoints(
        camera_points.reshape(-1, 1, 3),
        np.zeros((3, 1), dtype=np.float64),
        np.zeros((3, 1), dtype=np.float64),
        camera_matrix,
        distortion_vector,
    )
    expected_by_id = {
        point["id"]: cv_point.reshape(2)
        for point, cv_point in zip(payload["object_spec"]["points"], cv_projected, strict=True)
    }
    actual_by_id = {point["point_id"]: point for point in body["projected_points"]}

    for point_id, expected in expected_by_id.items():
        actual = actual_by_id[point_id]["image"]
        assert actual is not None
        assert actual["x"] == expected[0]
        assert actual["y"] == expected[1]


def test_invalid_custom_point_topology_returns_validation_error() -> None:
    client = TestClient(build_app())
    payload = build_payload()
    payload["object_spec"] = {
        "type": "custom_points",
        "pose": {"x": 0.0, "y": 12.0, "z": 0.0, "yaw": 0.0, "pitch": 0.0, "roll": 0.0},
        "points": [
            {"id": "a", "x": -1.0, "y": 0.0, "z": 0.0},
            {"id": "b", "x": 1.0, "y": 0.0, "z": 0.0},
            {"id": "c", "x": 0.0, "y": 0.0, "z": 2.0},
        ],
        "edges": [
            {"start_id": "a", "end_id": "b"},
            {"start_id": "missing", "end_id": "a"},
        ],
    }

    response = client.post("/api/projection/evaluate", json=payload)

    assert response.status_code == 422


def test_invalid_parameterized_object_payload_returns_validation_error() -> None:
    client = TestClient(build_app())
    payload = build_payload()
    payload["object_spec"]["wheelbase"] = -1.0

    response = client.post("/api/projection/evaluate", json=payload)

    assert response.status_code == 422
