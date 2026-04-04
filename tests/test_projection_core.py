from __future__ import annotations

import math

import cv2
import numpy as np

from camviz.api.models import BoxSpec, CameraIntrinsics, DistortionModel, Pose3D, ProjectionRequest
from camviz.core.engine import evaluate_projection
from camviz.core.transforms import world_to_camera_extrinsics


def build_request() -> ProjectionRequest:
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
            model="opencv",
            k1=0.11,
            k2=-0.03,
            p1=0.001,
            p2=-0.002,
            k3=0.004,
        ),
        camera_pose=Pose3D(x=0.4, y=-2.5, z=1.6, yaw=4.0, pitch=7.5, roll=-2.0),
        object_spec=BoxSpec(
            type="box",
            width=1.9,
            length=4.2,
            height=1.6,
            pose=Pose3D(x=1.2, y=18.0, z=0.0, yaw=-12.0, pitch=0.0, roll=0.0),
        ),
    )


def test_box_projection_matches_opencv_project_points() -> None:
    request = build_request()

    result = evaluate_projection(request)

    world_points = np.array([[p.world.x, p.world.y, p.world.z] for p in result.projected_points])
    rotation, translation = world_to_camera_extrinsics(request.camera_pose)
    rvec, _ = cv2.Rodrigues(rotation)
    camera_matrix = np.array(
        [
            [request.camera_intrinsics.fx, 0.0, request.camera_intrinsics.cx],
            [0.0, request.camera_intrinsics.fy, request.camera_intrinsics.cy],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )
    dist = np.array(
        [
            request.distortion.k1,
            request.distortion.k2,
            request.distortion.p1,
            request.distortion.p2,
            request.distortion.k3,
            request.distortion.k4,
            request.distortion.k5,
            request.distortion.k6,
        ],
        dtype=np.float64,
    )

    expected, _ = cv2.projectPoints(world_points, rvec, translation, camera_matrix, dist)
    actual = np.array([[p.distorted_image.x, p.distorted_image.y] for p in result.projected_points])

    np.testing.assert_allclose(actual, expected.reshape(-1, 2), atol=1e-4)


def test_projection_analysis_reports_bbox_visibility_and_distortion() -> None:
    request = build_request()

    result = evaluate_projection(request)

    assert result.bbox.width > 0.0
    assert result.bbox.height > 0.0
    assert result.analysis.pixel_width == result.bbox.width
    assert result.analysis.pixel_height == result.bbox.height
    assert result.analysis.coverage_ratio > 0.0
    assert result.analysis.distortion_mean_offset_px > 0.0
    assert result.analysis.distortion_max_offset_px >= result.analysis.distortion_mean_offset_px
    assert result.analysis.visible_point_count == len(result.projected_points)
    assert result.center.distorted_image is not None
    assert result.principal_point.x == request.camera_intrinsics.cx
    assert result.principal_point.y == request.camera_intrinsics.cy


def test_fisheye_projection_keeps_optical_axis_at_principal_point() -> None:
    request = build_request().model_copy(
        update={
            "distortion": DistortionModel(model="fisheye", k1=0.01, k2=-0.002, k3=0.0005, k4=0.0),
            "camera_pose": Pose3D(x=0.0, y=0.0, z=1.5, yaw=0.0, pitch=0.0, roll=0.0),
            "object_spec": BoxSpec(
                type="box",
                width=2.0,
                length=2.0,
                height=2.0,
                pose=Pose3D(x=0.0, y=12.0, z=0.0, yaw=0.0, pitch=0.0, roll=0.0),
            ),
        }
    )

    result = evaluate_projection(request)
    center = result.center

    assert center.distorted_image is not None
    assert math.isclose(center.distorted_image.x, request.camera_intrinsics.cx, abs_tol=1e-6)
    assert center.distorted_image.y > request.camera_intrinsics.cy
