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
            "type": "custom_points",
            "pose": {"x": 0.0, "y": 12.0, "z": 0.0, "yaw": 0.0, "pitch": 0.0, "roll": 0.0},
            "points": [
                {"id": "a", "x": -1.0, "y": 0.0, "z": 0.0},
                {"id": "b", "x": 1.0, "y": 0.0, "z": 0.0},
                {"id": "c", "x": 0.0, "y": 0.0, "z": 2.0},
            ],
            "edges": [
                {"start_id": "a", "end_id": "b"},
                {"start_id": "b", "end_id": "c"},
            ],
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


def test_schema_endpoint_exposes_supported_types_and_defaults() -> None:
    client = TestClient(build_app())

    response = client.get("/api/schema")

    assert response.status_code == 200
    payload = response.json()
    assert payload["object_types"] == ["box", "rectangle", "custom_points"]
    assert payload["distortion_models"] == ["opencv", "fisheye"]
    assert payload["defaults"]["camera_intrinsics"]["image_width"] == 1280


def test_evaluate_projection_returns_points_bbox_and_analysis() -> None:
    client = TestClient(build_app())

    response = client.post("/api/projection/evaluate", json=build_payload())

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["projected_points"]) == 3
    assert payload["bbox"]["width"] > 0.0
    assert payload["analysis"]["visible_point_count"] == 3
    assert payload["center"]["point_id"] == "object_center"


def test_invalid_custom_point_topology_returns_validation_error() -> None:
    client = TestClient(build_app())
    payload = build_payload()
    payload["object_spec"]["edges"].append({"start_id": "missing", "end_id": "a"})

    response = client.post("/api/projection/evaluate", json=payload)

    assert response.status_code == 422
