from __future__ import annotations

from fastapi.testclient import TestClient

from camviz.api.app import build_app


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
            "model": "opencv",
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
            "show_distorted": True,
            "show_undistorted": True,
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
        "model": "opencv",
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
    assert payload["distortion_models"] == ["opencv", "fisheye"]


def test_evaluate_projection_returns_landmarks_mesh_silhouette_and_analysis() -> None:
    client = TestClient(build_app())

    response = client.post("/api/projection/evaluate", json=build_payload())

    assert response.status_code == 200
    payload = response.json()
    assert payload["object_type"] == "sedan"
    assert len(payload["projected_points"]) > 0
    assert len(payload["display_mesh"]["vertices"]) > 0
    assert len(payload["display_mesh"]["faces"]) > 0
    assert len(payload["silhouette"]["distorted"]) > 0
    assert payload["bbox"]["width"] > 0.0
    assert payload["analysis"]["coverage_ratio"] > 0.0
    assert payload["center"]["point_id"] == "object_center"


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
