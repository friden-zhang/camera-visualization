from __future__ import annotations

import math

import cv2
import numpy as np
import pytest

from camviz.api.models import (
    BicycleSpec,
    CameraIntrinsics,
    CustomPointSpec,
    DistortionModel,
    PedestrianSpec,
    Pose3D,
    ProjectionRequest,
    SedanSpec,
    TrafficConeSpec,
    TruckSpec,
)
from camviz.core.engine import _project_image_point, evaluate_projection
from camviz.core.transforms import local_to_world, world_to_camera


def build_request(object_spec: object) -> ProjectionRequest:
    return ProjectionRequest(
        camera_intrinsics=CameraIntrinsics(
            fx=960.0,
            fy=940.0,
            cx=640.0,
            cy=360.0,
            image_width=1280,
            image_height=720,
        ),
        distortion=DistortionModel(
            model="radtan",
            k1=0.11,
            k2=-0.03,
            p1=0.001,
            p2=-0.002,
            k3=0.004,
        ),
        camera_pose=Pose3D(x=0.4, y=-2.5, z=1.6, yaw=4.0, pitch=7.5, roll=-2.0),
        object_spec=object_spec,
    )


@pytest.mark.parametrize(
    ("object_type", "object_spec"),
    [
        (
            "sedan",
            SedanSpec(
                type="sedan",
                length=4.6,
                width=1.82,
                height=1.48,
                wheelbase=2.75,
                roof_height=1.18,
                hood_length=1.1,
                trunk_length=0.9,
                pose=Pose3D(x=0.0, y=18.0, z=0.0, yaw=-8.0, pitch=0.0, roll=0.0),
            ),
        ),
        (
            "truck",
            TruckSpec(
                type="truck",
                cab_length=2.2,
                cargo_length=5.4,
                cargo_width=2.4,
                cargo_height=2.5,
                cab_height=2.2,
                wheelbase=4.8,
                pose=Pose3D(x=-1.0, y=22.0, z=0.0, yaw=4.0, pitch=0.0, roll=0.0),
            ),
        ),
        (
            "bicycle",
            BicycleSpec(
                type="bicycle",
                wheel_diameter=0.72,
                wheelbase=1.06,
                frame_height=0.58,
                handlebar_width=0.48,
                saddle_height=0.86,
                pose=Pose3D(x=0.5, y=14.0, z=0.0, yaw=12.0, pitch=0.0, roll=0.0),
            ),
        ),
        (
            "pedestrian",
            PedestrianSpec(
                type="pedestrian",
                body_height=1.74,
                shoulder_width=0.46,
                torso_depth=0.26,
                hip_width=0.34,
                head_scale=1.0,
                pose=Pose3D(x=-0.4, y=11.0, z=0.0, yaw=0.0, pitch=0.0, roll=0.0),
            ),
        ),
        (
            "traffic_cone",
            TrafficConeSpec(
                type="traffic_cone",
                base_diameter=0.36,
                top_diameter=0.08,
                cone_height=0.72,
                pose=Pose3D(x=0.0, y=8.0, z=0.0, yaw=0.0, pitch=0.0, roll=0.0),
            ),
        ),
    ],
)
def test_parameterized_objects_project_mesh_and_silhouette(
    object_type: str, object_spec: object
) -> None:
    result = evaluate_projection(build_request(object_spec))

    assert result.object_type == object_type
    assert len(result.display_mesh.vertices) > 0
    assert len(result.display_mesh.faces) > 0
    assert len(result.projected_points) > 0
    assert result.projected_points[0].image is not None
    assert result.silhouette
    assert result.analysis.coverage_ratio > 0.0
    assert result.bbox.width > 0.0
    assert result.bbox.height > 0.0
    assert math.isclose(
        min(vertex.z for vertex in result.display_mesh.vertices),
        0.0,
        abs_tol=1e-6,
    )


def test_sedan_length_parameter_changes_mesh_extent_and_projection() -> None:
    short_result = evaluate_projection(
        build_request(
            SedanSpec(
                type="sedan",
                length=4.2,
                width=1.82,
                height=1.48,
                wheelbase=2.6,
                roof_height=1.15,
                hood_length=1.0,
                trunk_length=0.8,
                pose=Pose3D(x=0.0, y=18.0, z=0.0, yaw=-8.0, pitch=0.0, roll=0.0),
            )
        )
    )
    long_result = evaluate_projection(
        build_request(
            SedanSpec(
                type="sedan",
                length=5.4,
                width=1.82,
                height=1.48,
                wheelbase=3.1,
                roof_height=1.15,
                hood_length=1.35,
                trunk_length=1.1,
                pose=Pose3D(x=0.0, y=18.0, z=0.0, yaw=-8.0, pitch=0.0, roll=0.0),
            )
        )
    )

    short_length_span = max(vertex.y for vertex in short_result.display_mesh.vertices) - min(
        vertex.y for vertex in short_result.display_mesh.vertices
    )
    long_length_span = max(vertex.y for vertex in long_result.display_mesh.vertices) - min(
        vertex.y for vertex in long_result.display_mesh.vertices
    )

    assert long_length_span > short_length_span + 0.8
    assert long_result.bbox.height >= short_result.bbox.height
    assert len(long_result.silhouette[0].points) >= 3


def test_custom_points_still_work_as_debug_geometry() -> None:
    result = evaluate_projection(
        build_request(
            CustomPointSpec(
                type="custom_points",
                pose=Pose3D(x=0.0, y=12.0, z=0.0, yaw=0.0, pitch=0.0, roll=0.0),
                points=[
                    {"id": "a", "x": -1.0, "y": 0.0, "z": 0.0},
                    {"id": "b", "x": 1.0, "y": 0.0, "z": 0.0},
                    {"id": "c", "x": 0.0, "y": 0.0, "z": 2.0},
                ],
                edges=[
                    {"start_id": "a", "end_id": "b"},
                    {"start_id": "b", "end_id": "c"},
                ],
            )
        )
    )

    assert result.object_type == "custom_points"
    assert len(result.projected_points) == 3
    assert len(result.display_mesh.faces) == 0
    assert result.analysis.visible_point_count == 3


def test_radtan_projection_matches_cv2_project_points() -> None:
    intrinsics = CameraIntrinsics(
        fx=1567.356367755675,
        fy=1567.306968974894,
        cx=961.587845652537,
        cy=542.296141020186,
        image_width=1920,
        image_height=1080,
    )
    distortion = DistortionModel(
        model="radtan",
        k1=-0.310387649487,
        k2=0.076313217331,
        p1=-0.000111535757,
        p2=-0.000564977398,
        k3=0.070410443420,
    )
    camera_points = np.array(
        [
            [0.0, 0.0, 10.0],
            [1.2, 0.3, 20.0],
            [-2.5, 1.1, 35.0],
            [4.0, -1.2, 55.0],
        ],
        dtype=np.float64,
    )
    camera_matrix = np.array(
        [
            [intrinsics.fx, 0.0, intrinsics.cx],
            [0.0, intrinsics.fy, intrinsics.cy],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )
    distortion_vector = np.array(
        [distortion.k1, distortion.k2, distortion.p1, distortion.p2, distortion.k3],
        dtype=np.float64,
    )

    for camera_point in camera_points:
        ours = _project_image_point(camera_point, intrinsics, distortion)
        cv_projected, _ = cv2.projectPoints(
            camera_point.reshape(1, 1, 3),
            np.zeros((3, 1), dtype=np.float64),
            np.zeros((3, 1), dtype=np.float64),
            camera_matrix,
            distortion_vector,
        )
        cv_point = cv_projected.reshape(2)

        assert ours is not None
        assert ours.x == pytest.approx(float(cv_point[0]), abs=1e-9)
        assert ours.y == pytest.approx(float(cv_point[1]), abs=1e-9)


def test_fisheye_projection_matches_cv2_fisheye_project_points() -> None:
    intrinsics = CameraIntrinsics(
        fx=1220.0,
        fy=1212.0,
        cx=960.0,
        cy=540.0,
        image_width=1920,
        image_height=1080,
    )
    distortion = DistortionModel(
        model="fisheye",
        k1=-0.02,
        k2=0.003,
        k3=-0.0004,
        k4=0.00003,
    )
    camera_points = np.array(
        [
            [0.0, 0.0, 8.0],
            [0.6, 0.2, 7.0],
            [-1.1, 0.5, 9.5],
            [1.8, -0.7, 12.0],
        ],
        dtype=np.float64,
    )
    camera_matrix = np.array(
        [
            [intrinsics.fx, 0.0, intrinsics.cx],
            [0.0, intrinsics.fy, intrinsics.cy],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )
    distortion_vector = np.array(
        [distortion.k1, distortion.k2, distortion.k3, distortion.k4],
        dtype=np.float64,
    )

    for camera_point in camera_points:
        ours = _project_image_point(camera_point, intrinsics, distortion)
        cv_projected, _ = cv2.fisheye.projectPoints(
            camera_point.reshape(1, 1, 3),
            np.zeros((3, 1), dtype=np.float64),
            np.zeros((3, 1), dtype=np.float64),
            camera_matrix,
            distortion_vector,
        )
        cv_point = cv_projected.reshape(2)

        assert ours is not None
        assert ours.x == pytest.approx(float(cv_point[0]), abs=1e-9)
        assert ours.y == pytest.approx(float(cv_point[1]), abs=1e-9)


def test_full_projection_pipeline_stays_aligned_with_opencv_point_results() -> None:
    request = ProjectionRequest(
        camera_intrinsics=CameraIntrinsics(
            fx=1567.356367755675,
            fy=1567.306968974894,
            cx=961.587845652537,
            cy=542.296141020186,
            image_width=1920,
            image_height=1080,
        ),
        distortion=DistortionModel(
            model="radtan",
            k1=-0.310387649487,
            k2=0.076313217331,
            p1=-0.000111535757,
            p2=-0.000564977398,
            k3=0.070410443420,
        ),
        camera_pose=Pose3D(x=0.0, y=-4.0, z=1.7, yaw=0.0, pitch=5.0, roll=0.0),
        object_spec=CustomPointSpec(
            type="custom_points",
            pose=Pose3D(x=0.0, y=14.0, z=0.0, yaw=0.0, pitch=0.0, roll=0.0),
            points=[
                {"id": "left_base", "x": -1.0, "y": 0.0, "z": 0.0},
                {"id": "right_base", "x": 1.0, "y": 0.0, "z": 0.0},
                {"id": "top", "x": 0.0, "y": 0.0, "z": 3.65},
            ],
            edges=[
                {"start_id": "left_base", "end_id": "right_base"},
                {"start_id": "left_base", "end_id": "top"},
                {"start_id": "right_base", "end_id": "top"},
            ],
        ),
    )
    result = evaluate_projection(request)
    camera_matrix = np.array(
        [
            [request.camera_intrinsics.fx, 0.0, request.camera_intrinsics.cx],
            [0.0, request.camera_intrinsics.fy, request.camera_intrinsics.cy],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )
    distortion_vector = np.array(
        [
            request.distortion.k1,
            request.distortion.k2,
            request.distortion.p1,
            request.distortion.p2,
            request.distortion.k3,
        ],
        dtype=np.float64,
    )

    local_points = np.array(
        [[point.x, point.y, point.z] for point in request.object_spec.points],
        dtype=np.float64,
    )
    world_points = local_to_world(local_points, request.object_spec.pose)
    camera_points = world_to_camera(world_points, request.camera_pose)
    cv_projected, _ = cv2.projectPoints(
        camera_points.reshape(-1, 1, 3),
        np.zeros((3, 1), dtype=np.float64),
        np.zeros((3, 1), dtype=np.float64),
        camera_matrix,
        distortion_vector,
    )
    expected_by_id = {
        point.id: cv_point.reshape(2)
        for point, cv_point in zip(request.object_spec.points, cv_projected, strict=True)
    }

    by_id = {point.point_id: point for point in result.projected_points}
    for point_id, expected in expected_by_id.items():
        diagnostic = by_id[point_id]
        assert diagnostic.image is not None
        assert diagnostic.image.x == pytest.approx(float(expected[0]), abs=1e-9)
        assert diagnostic.image.y == pytest.approx(float(expected[1]), abs=1e-9)
