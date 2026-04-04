from __future__ import annotations

import cv2
import numpy as np
import numpy.typing as npt

from camviz.api.models import BoundingBox, Contour2D, MeshFace, Point2D

FloatArray = npt.NDArray[np.float64]
BoolArray = npt.NDArray[np.bool_]


def _edge_function(
    start_x: float,
    start_y: float,
    end_x: float,
    end_y: float,
    point_x: FloatArray,
    point_y: FloatArray,
) -> FloatArray:
    return (point_x - start_x) * (end_y - start_y) - (point_y - start_y) * (end_x - start_x)


def rasterize_visible_mask(
    projected_vertices: list[Point2D | None],
    depths: FloatArray,
    mesh_faces: list[MeshFace],
    *,
    image_width: int,
    image_height: int,
) -> BoolArray:
    if not mesh_faces:
        return np.zeros((image_height, image_width), dtype=bool)

    z_buffer = np.full((image_height, image_width), np.inf, dtype=np.float64)

    for face in mesh_faces:
        indices = face.vertex_indices
        if any(index >= len(projected_vertices) for index in indices):
            continue
        vertices = [projected_vertices[index] for index in indices]
        if any(vertex is None for vertex in vertices):
            continue
        z_values = np.array([depths[index] for index in indices], dtype=np.float64)
        if np.any(z_values <= 1e-9):
            continue

        assert vertices[0] is not None
        assert vertices[1] is not None
        assert vertices[2] is not None
        p0 = vertices[0]
        p1 = vertices[1]
        p2 = vertices[2]
        min_x = max(int(np.floor(min(p0.x, p1.x, p2.x))), 0)
        max_x = min(int(np.ceil(max(p0.x, p1.x, p2.x))), image_width - 1)
        min_y = max(int(np.floor(min(p0.y, p1.y, p2.y))), 0)
        max_y = min(int(np.ceil(max(p0.y, p1.y, p2.y))), image_height - 1)
        if min_x > max_x or min_y > max_y:
            continue

        x_grid, y_grid = np.meshgrid(
            np.arange(min_x, max_x + 1, dtype=np.float64) + 0.5,
            np.arange(min_y, max_y + 1, dtype=np.float64) + 0.5,
        )
        area = _edge_function(p0.x, p0.y, p1.x, p1.y, np.array(p2.x), np.array(p2.y))
        if abs(float(area)) <= 1e-9:
            continue

        weight0 = _edge_function(p1.x, p1.y, p2.x, p2.y, x_grid, y_grid) / area
        weight1 = _edge_function(p2.x, p2.y, p0.x, p0.y, x_grid, y_grid) / area
        weight2 = _edge_function(p0.x, p0.y, p1.x, p1.y, x_grid, y_grid) / area
        inside = (weight0 >= -1e-6) & (weight1 >= -1e-6) & (weight2 >= -1e-6)
        if not np.any(inside):
            continue

        depth = weight0 * z_values[0] + weight1 * z_values[1] + weight2 * z_values[2]
        sub_buffer = z_buffer[min_y : max_y + 1, min_x : max_x + 1]
        update_mask = inside & (depth < sub_buffer)
        sub_buffer[update_mask] = depth[update_mask]

    return np.isfinite(z_buffer)


def contours_from_mask(mask: BoolArray) -> list[Contour2D]:
    if not np.any(mask):
        return []

    contours, _ = cv2.findContours(
        mask.astype(np.uint8),
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    result: list[Contour2D] = []
    for contour in contours:
        if len(contour) < 3:
            continue
        result.append(
            Contour2D(
                points=[
                    Point2D(x=float(point[0][0]), y=float(point[0][1])) for point in contour
                ]
            )
        )
    return result


def bbox_from_mask(mask: BoolArray) -> BoundingBox:
    if not np.any(mask):
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

    y_indices, x_indices = np.nonzero(mask)
    min_x = float(np.min(x_indices))
    max_x = float(np.max(x_indices))
    min_y = float(np.min(y_indices))
    max_y = float(np.max(y_indices))
    return BoundingBox(
        min_x=min_x,
        max_x=max_x,
        min_y=min_y,
        max_y=max_y,
        width=max_x - min_x,
        height=max_y - min_y,
        inside_image=True,
        intersects_image=True,
    )


def coverage_ratio(mask: BoolArray) -> float:
    return float(np.count_nonzero(mask) / mask.size) if mask.size else 0.0
