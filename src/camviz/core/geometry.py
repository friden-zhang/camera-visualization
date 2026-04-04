from __future__ import annotations

from typing import cast

import numpy as np
import numpy.typing as npt

from camviz.api.models import BoxSpec, CustomPointSpec, Edge, Face, LabeledPoint3D, RectangleSpec


def build_box_geometry(
    spec: BoxSpec,
) -> tuple[list[LabeledPoint3D], list[Edge], list[Face], np.ndarray]:
    half_width = spec.width / 2.0
    half_length = spec.length / 2.0
    point_defs = [
        ("p0", -half_width, -half_length, 0.0),
        ("p1", half_width, -half_length, 0.0),
        ("p2", half_width, half_length, 0.0),
        ("p3", -half_width, half_length, 0.0),
        ("p4", -half_width, -half_length, spec.height),
        ("p5", half_width, -half_length, spec.height),
        ("p6", half_width, half_length, spec.height),
        ("p7", -half_width, half_length, spec.height),
    ]
    points = [LabeledPoint3D(id=pid, x=x, y=y, z=z) for pid, x, y, z in point_defs]
    edges = [
        Edge(start_id="p0", end_id="p1"),
        Edge(start_id="p1", end_id="p2"),
        Edge(start_id="p2", end_id="p3"),
        Edge(start_id="p3", end_id="p0"),
        Edge(start_id="p4", end_id="p5"),
        Edge(start_id="p5", end_id="p6"),
        Edge(start_id="p6", end_id="p7"),
        Edge(start_id="p7", end_id="p4"),
        Edge(start_id="p0", end_id="p4"),
        Edge(start_id="p1", end_id="p5"),
        Edge(start_id="p2", end_id="p6"),
        Edge(start_id="p3", end_id="p7"),
    ]
    faces = [
        Face(point_ids=["p0", "p1", "p2", "p3"], label="bottom"),
        Face(point_ids=["p4", "p5", "p6", "p7"], label="top"),
        Face(point_ids=["p0", "p1", "p5", "p4"], label="rear"),
        Face(point_ids=["p1", "p2", "p6", "p5"], label="right"),
        Face(point_ids=["p2", "p3", "p7", "p6"], label="front"),
        Face(point_ids=["p3", "p0", "p4", "p7"], label="left"),
    ]
    center = np.array([0.0, 0.0, spec.height / 2.0], dtype=np.float64)
    return points, edges, faces, center


def build_rectangle_geometry(
    spec: RectangleSpec,
) -> tuple[list[LabeledPoint3D], list[Edge], list[Face], np.ndarray]:
    half_width = spec.width / 2.0
    half_length = spec.length / 2.0
    point_defs = [
        ("p0", -half_width, -half_length, 0.0),
        ("p1", half_width, -half_length, 0.0),
        ("p2", half_width, half_length, 0.0),
        ("p3", -half_width, half_length, 0.0),
    ]
    points = [LabeledPoint3D(id=pid, x=x, y=y, z=z) for pid, x, y, z in point_defs]
    edges = [
        Edge(start_id="p0", end_id="p1"),
        Edge(start_id="p1", end_id="p2"),
        Edge(start_id="p2", end_id="p3"),
        Edge(start_id="p3", end_id="p0"),
    ]
    faces = [Face(point_ids=["p0", "p1", "p2", "p3"], label="plane")]
    center = np.array([0.0, 0.0, 0.0], dtype=np.float64)
    return points, edges, faces, center


def build_custom_geometry(
    spec: CustomPointSpec,
) -> tuple[list[LabeledPoint3D], list[Edge], list[Face], np.ndarray]:
    if not spec.points:
        raise ValueError("custom_points requires at least one point")
    center = cast(
        npt.NDArray[np.float64],
        np.mean(
            [[point.x, point.y, point.z] for point in spec.points],
            axis=0,
            dtype=np.float64,
        ),
    )
    return spec.points, spec.edges, spec.faces, center
