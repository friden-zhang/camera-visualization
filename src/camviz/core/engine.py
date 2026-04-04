from __future__ import annotations

import math

import numpy as np

from camviz.api.models import (
    BoundingBox,
    BoxSpec,
    CameraIntrinsics,
    CustomPointSpec,
    DistortionModel,
    Edge,
    Face,
    Point2D,
    PointDiagnostic,
    ProjectionAnalysis,
    ProjectionRequest,
    ProjectionResult,
    RectangleSpec,
    Vector3,
)
from camviz.core.geometry import build_box_geometry, build_custom_geometry, build_rectangle_geometry
from camviz.core.transforms import local_to_world, world_to_camera


def _distort_normalized(
    x_value: float, y_value: float, distortion: DistortionModel
) -> tuple[float, float]:
    if distortion.model == "fisheye":
        r_value = math.hypot(x_value, y_value)
        if r_value < 1e-12:
            return x_value, y_value
        theta = math.atan(r_value)
        theta2 = theta * theta
        theta_d = theta * (
            1.0
            + distortion.k1 * theta2
            + distortion.k2 * theta2 * theta2
            + distortion.k3 * theta2**3
            + distortion.k4 * theta2**4
        )
        scale = theta_d / r_value
        return x_value * scale, y_value * scale

    r2 = x_value * x_value + y_value * y_value
    r4 = r2 * r2
    r6 = r4 * r2
    numerator = 1.0 + distortion.k1 * r2 + distortion.k2 * r4 + distortion.k3 * r6
    denominator = 1.0 + distortion.k4 * r2 + distortion.k5 * r4 + distortion.k6 * r6
    radial = numerator / denominator if abs(denominator) > 1e-12 else numerator
    x_distorted = (
        x_value * radial
        + 2.0 * distortion.p1 * x_value * y_value
        + distortion.p2 * (r2 + 2.0 * x_value * x_value)
    )
    y_distorted = (
        y_value * radial
        + distortion.p1 * (r2 + 2.0 * y_value * y_value)
        + 2.0 * distortion.p2 * x_value * y_value
    )
    return x_distorted, y_distorted


def _project_image_point(
    point_camera: np.ndarray, intrinsics: CameraIntrinsics, distortion: DistortionModel
) -> tuple[Point2D | None, Point2D | None]:
    z_value = float(point_camera[2])
    if z_value <= 1e-9:
        return None, None

    x_norm = float(point_camera[0] / z_value)
    y_norm = float(point_camera[1] / z_value)
    undistorted = Point2D(
        x=intrinsics.fx * x_norm + intrinsics.cx,
        y=intrinsics.fy * y_norm + intrinsics.cy,
    )
    x_distorted, y_distorted = _distort_normalized(x_norm, y_norm, distortion)
    distorted = Point2D(
        x=intrinsics.fx * x_distorted + intrinsics.cx,
        y=intrinsics.fy * y_distorted + intrinsics.cy,
    )
    return undistorted, distorted


def _inside_image(point: Point2D | None, intrinsics: CameraIntrinsics) -> bool:
    if point is None:
        return False
    return (
        0.0 <= point.x <= float(intrinsics.image_width)
        and 0.0 <= point.y <= float(intrinsics.image_height)
    )


def _build_bbox(points: list[Point2D | None], intrinsics: CameraIntrinsics) -> BoundingBox:
    valid_points = [point for point in points if point is not None]
    if not valid_points:
        return BoundingBox(
            min_x=0.0,
            max_x=0.0,
            min_y=0.0,
            max_y=0.0,
            width=0.0,
            height=0.0,
            inside_image=False,
            intersects_image=False,
        )

    x_values = [point.x for point in valid_points]
    y_values = [point.y for point in valid_points]
    min_x = min(x_values)
    max_x = max(x_values)
    min_y = min(y_values)
    max_y = max(y_values)
    image_width = float(intrinsics.image_width)
    image_height = float(intrinsics.image_height)
    intersects = not (max_x < 0.0 or max_y < 0.0 or min_x > image_width or min_y > image_height)
    inside = min_x >= 0.0 and min_y >= 0.0 and max_x <= image_width and max_y <= image_height
    return BoundingBox(
        min_x=min_x,
        max_x=max_x,
        min_y=min_y,
        max_y=max_y,
        width=max_x - min_x,
        height=max_y - min_y,
        inside_image=inside,
        intersects_image=intersects,
    )


def _coverage_ratio(bbox: BoundingBox, intrinsics: CameraIntrinsics) -> float:
    if not bbox.intersects_image or bbox.width <= 0.0 or bbox.height <= 0.0:
        return 0.0
    clipped_width = max(
        0.0,
        min(bbox.max_x, float(intrinsics.image_width)) - max(bbox.min_x, 0.0),
    )
    clipped_height = max(
        0.0,
        min(bbox.max_y, float(intrinsics.image_height)) - max(bbox.min_y, 0.0),
    )
    return clipped_width * clipped_height / float(intrinsics.image_width * intrinsics.image_height)


def _diagnostic_from_vectors(
    *,
    point_id: str,
    world: np.ndarray,
    camera: np.ndarray,
    intrinsics: CameraIntrinsics,
    distortion: DistortionModel,
) -> PointDiagnostic:
    undistorted_image, distorted_image = _project_image_point(camera, intrinsics, distortion)
    return PointDiagnostic(
        point_id=point_id,
        world=Vector3(x=float(world[0]), y=float(world[1]), z=float(world[2])),
        camera=Vector3(x=float(camera[0]), y=float(camera[1]), z=float(camera[2])),
        undistorted_image=undistorted_image,
        distorted_image=distorted_image,
        visible=camera[2] > 1e-9,
        inside_image=_inside_image(distorted_image, intrinsics),
        inside_image_undistorted=_inside_image(undistorted_image, intrinsics),
    )


def _geometry_for_spec(
    object_spec: BoxSpec | RectangleSpec | CustomPointSpec,
) -> tuple[np.ndarray, list[str], list[Edge], list[Face], np.ndarray]:
    if isinstance(object_spec, BoxSpec):
        points, edges, faces, center = build_box_geometry(object_spec)
    elif isinstance(object_spec, RectangleSpec):
        points, edges, faces, center = build_rectangle_geometry(object_spec)
    else:
        points, edges, faces, center = build_custom_geometry(object_spec)
    array = np.array([[point.x, point.y, point.z] for point in points], dtype=np.float64)
    return array, [point.id for point in points], edges, faces, center


def evaluate_projection(request: ProjectionRequest) -> ProjectionResult:
    local_points, point_ids, edges, faces, local_center = _geometry_for_spec(request.object_spec)
    world_points = local_to_world(local_points, request.object_spec.pose)
    center_world = local_to_world(
        np.array([local_center], dtype=np.float64),
        request.object_spec.pose,
    )[0]
    camera_points = world_to_camera(world_points, request.camera_pose)
    center_camera = world_to_camera(
        np.array([center_world], dtype=np.float64),
        request.camera_pose,
    )[0]

    projected_points = [
        _diagnostic_from_vectors(
            point_id=point_id,
            world=world_point,
            camera=camera_point,
            intrinsics=request.camera_intrinsics,
            distortion=request.distortion,
        )
        for point_id, world_point, camera_point in zip(
            point_ids,
            world_points,
            camera_points,
            strict=True,
        )
    ]
    center_point = _diagnostic_from_vectors(
        point_id="object_center",
        world=center_world,
        camera=center_camera,
        intrinsics=request.camera_intrinsics,
        distortion=request.distortion,
    )

    distorted_bbox = _build_bbox(
        [point.distorted_image for point in projected_points], request.camera_intrinsics
    )
    undistorted_bbox = _build_bbox(
        [point.undistorted_image for point in projected_points], request.camera_intrinsics
    )
    distortion_offsets = [
        math.hypot(
            point.distorted_image.x - point.undistorted_image.x,
            point.distorted_image.y - point.undistorted_image.y,
        )
        for point in projected_points
        if point.distorted_image is not None and point.undistorted_image is not None
    ]
    analysis = ProjectionAnalysis(
        pixel_width=distorted_bbox.width,
        pixel_height=distorted_bbox.height,
        coverage_ratio=_coverage_ratio(distorted_bbox, request.camera_intrinsics),
        distortion_mean_offset_px=float(np.mean(distortion_offsets)) if distortion_offsets else 0.0,
        distortion_max_offset_px=float(np.max(distortion_offsets)) if distortion_offsets else 0.0,
        visible_point_count=sum(point.visible for point in projected_points),
        hidden_point_count=sum(not point.visible for point in projected_points),
        center_inside_image=center_point.inside_image,
        bbox_intersects_image=distorted_bbox.intersects_image,
        bbox_inside_image=distorted_bbox.inside_image,
    )
    return ProjectionResult(
        projected_points=projected_points,
        edges=edges,
        faces=faces,
        center=center_point,
        bbox=distorted_bbox,
        undistorted_bbox=undistorted_bbox,
        principal_point=Point2D(x=request.camera_intrinsics.cx, y=request.camera_intrinsics.cy),
        analysis=analysis,
    )
