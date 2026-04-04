from __future__ import annotations

import math

import numpy as np

from camviz.api.models import (
    BoundingBox,
    CameraIntrinsics,
    DisplayMesh,
    DistortionModel,
    MeshFace,
    Point2D,
    PointDiagnostic,
    ProjectionAnalysis,
    ProjectionRequest,
    ProjectionResult,
    SilhouetteSet,
    Vector3,
)
from camviz.core.object_geometry import generate_object_geometry
from camviz.core.software_render import (
    bbox_from_mask,
    contours_from_mask,
    coverage_ratio,
    rasterize_visible_mask,
)
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


def _project_vertices(
    camera_vertices: np.ndarray, intrinsics: CameraIntrinsics, distortion: DistortionModel
) -> tuple[list[Point2D | None], list[Point2D | None]]:
    undistorted: list[Point2D | None] = []
    distorted: list[Point2D | None] = []
    for vertex_camera in camera_vertices:
        vertex_undistorted, vertex_distorted = _project_image_point(
            vertex_camera,
            intrinsics,
            distortion,
        )
        undistorted.append(vertex_undistorted)
        distorted.append(vertex_distorted)
    return undistorted, distorted


def _mesh_to_display(vertices_world: np.ndarray, mesh_faces: list[MeshFace]) -> DisplayMesh:
    return DisplayMesh(
        vertices=[
            Vector3(x=float(vertex[0]), y=float(vertex[1]), z=float(vertex[2]))
            for vertex in vertices_world
        ],
        faces=list(mesh_faces),
    )


def evaluate_projection(request: ProjectionRequest) -> ProjectionResult:
    geometry = generate_object_geometry(request.object_spec)
    if len(geometry.vertices) > 0:
        world_vertices = local_to_world(geometry.vertices, request.object_spec.pose)
        camera_vertices = world_to_camera(world_vertices, request.camera_pose)
    else:
        world_vertices = np.empty((0, 3), dtype=np.float64)
        camera_vertices = np.empty((0, 3), dtype=np.float64)

    landmark_ids = list(geometry.landmarks.keys())
    local_landmarks = (
        np.array([geometry.landmarks[point_id] for point_id in landmark_ids], dtype=np.float64)
        if landmark_ids
        else np.empty((0, 3), dtype=np.float64)
    )
    world_landmarks = (
        local_to_world(local_landmarks, request.object_spec.pose)
        if len(local_landmarks) > 0
        else np.empty((0, 3), dtype=np.float64)
    )
    camera_landmarks = (
        world_to_camera(world_landmarks, request.camera_pose)
        if len(world_landmarks) > 0
        else np.empty((0, 3), dtype=np.float64)
    )

    projected_points = [
        _diagnostic_from_vectors(
            point_id=point_id,
            world=world_point,
            camera=camera_point,
            intrinsics=request.camera_intrinsics,
            distortion=request.distortion,
        )
        for point_id, world_point, camera_point in zip(
            landmark_ids,
            world_landmarks,
            camera_landmarks,
            strict=True,
        )
    ]

    center_world = local_to_world(
        np.array([geometry.center], dtype=np.float64),
        request.object_spec.pose,
    )[0]
    center_camera = world_to_camera(
        np.array([center_world], dtype=np.float64),
        request.camera_pose,
    )[0]
    center_point = _diagnostic_from_vectors(
        point_id="object_center",
        world=center_world,
        camera=center_camera,
        intrinsics=request.camera_intrinsics,
        distortion=request.distortion,
    )

    undistorted_vertex_points, distorted_vertex_points = _project_vertices(
        camera_vertices,
        request.camera_intrinsics,
        request.distortion,
    )

    if geometry.mesh_faces:
        undistorted_mask = rasterize_visible_mask(
            undistorted_vertex_points,
            camera_vertices[:, 2],
            geometry.mesh_faces,
            image_width=request.camera_intrinsics.image_width,
            image_height=request.camera_intrinsics.image_height,
        )
        distorted_mask = rasterize_visible_mask(
            distorted_vertex_points,
            camera_vertices[:, 2],
            geometry.mesh_faces,
            image_width=request.camera_intrinsics.image_width,
            image_height=request.camera_intrinsics.image_height,
        )
        distorted_bbox = bbox_from_mask(distorted_mask)
        undistorted_bbox = bbox_from_mask(undistorted_mask)
        silhouette = SilhouetteSet(
            distorted=contours_from_mask(distorted_mask),
            undistorted=contours_from_mask(undistorted_mask),
        )
        coverage = coverage_ratio(distorted_mask)
    else:
        distorted_bbox = _build_bbox(
            [point.distorted_image for point in projected_points], request.camera_intrinsics
        )
        undistorted_bbox = _build_bbox(
            [point.undistorted_image for point in projected_points], request.camera_intrinsics
        )
        silhouette = SilhouetteSet(distorted=[], undistorted=[])
        coverage = (
            distorted_bbox.width * distorted_bbox.height
            / float(request.camera_intrinsics.image_width * request.camera_intrinsics.image_height)
            if distorted_bbox.width > 0.0 and distorted_bbox.height > 0.0
            else 0.0
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
        coverage_ratio=coverage,
        distortion_mean_offset_px=float(np.mean(distortion_offsets)) if distortion_offsets else 0.0,
        distortion_max_offset_px=float(np.max(distortion_offsets)) if distortion_offsets else 0.0,
        visible_point_count=sum(point.visible for point in projected_points),
        hidden_point_count=sum(not point.visible for point in projected_points),
        center_inside_image=center_point.inside_image,
        bbox_intersects_image=distorted_bbox.intersects_image,
        bbox_inside_image=distorted_bbox.inside_image,
    )
    return ProjectionResult(
        object_type=request.object_spec.type,
        projected_points=projected_points,
        edges=geometry.debug_edges,
        faces=geometry.debug_faces,
        center=center_point,
        bbox=distorted_bbox,
        undistorted_bbox=undistorted_bbox,
        principal_point=Point2D(x=request.camera_intrinsics.cx, y=request.camera_intrinsics.cy),
        analysis=analysis,
        display_mesh=_mesh_to_display(world_vertices, geometry.mesh_faces),
        silhouette=silhouette,
    )
