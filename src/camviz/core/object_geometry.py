from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
import numpy.typing as npt

from camviz.api.models import (
    BicycleSpec,
    CustomPointSpec,
    Edge,
    Face,
    MeshFace,
    PedestrianSpec,
    SedanSpec,
    TrafficConeSpec,
    TruckSpec,
)
from camviz.core.geometry import build_custom_geometry

FloatArray = npt.NDArray[np.float64]


@dataclass
class GeneratedObjectGeometry:
    vertices: FloatArray
    mesh_faces: list[MeshFace]
    landmarks: dict[str, FloatArray]
    debug_edges: list[Edge]
    debug_faces: list[Face]
    center: FloatArray


@dataclass
class MeshBuilder:
    vertices: list[tuple[float, float, float]] = field(default_factory=list)
    faces: list[tuple[int, int, int, str | None]] = field(default_factory=list)

    def add_box(
        self,
        *,
        min_x: float,
        max_x: float,
        min_y: float,
        max_y: float,
        min_z: float,
        max_z: float,
        label: str,
    ) -> None:
        base = len(self.vertices)
        self.vertices.extend(
            [
                (min_x, min_y, min_z),
                (max_x, min_y, min_z),
                (max_x, max_y, min_z),
                (min_x, max_y, min_z),
                (min_x, min_y, max_z),
                (max_x, min_y, max_z),
                (max_x, max_y, max_z),
                (min_x, max_y, max_z),
            ]
        )
        face_indices = [
            (0, 1, 2),
            (0, 2, 3),
            (4, 5, 6),
            (4, 6, 7),
            (0, 1, 5),
            (0, 5, 4),
            (1, 2, 6),
            (1, 6, 5),
            (2, 3, 7),
            (2, 7, 6),
            (3, 0, 4),
            (3, 4, 7),
        ]
        for i0, i1, i2 in face_indices:
            self.faces.append((base + i0, base + i1, base + i2, label))

    def add_cylinder_x(
        self,
        *,
        center_x: float,
        center_y: float,
        center_z: float,
        radius: float,
        length: float,
        segments: int,
        label: str,
    ) -> None:
        start_x = center_x - length / 2.0
        end_x = center_x + length / 2.0
        base = len(self.vertices)
        for x_value in (start_x, end_x):
            for segment in range(segments):
                angle = 2.0 * math.pi * segment / segments
                y_value = center_y + radius * math.cos(angle)
                z_value = center_z + radius * math.sin(angle)
                self.vertices.append((x_value, y_value, z_value))
        start_center = len(self.vertices)
        self.vertices.append((start_x, center_y, center_z))
        end_center = len(self.vertices)
        self.vertices.append((end_x, center_y, center_z))

        for segment in range(segments):
            next_segment = (segment + 1) % segments
            start0 = base + segment
            start1 = base + next_segment
            end0 = base + segments + segment
            end1 = base + segments + next_segment
            self.faces.append((start0, end0, end1, label))
            self.faces.append((start0, end1, start1, label))
            self.faces.append((start_center, start1, start0, label))
            self.faces.append((end_center, end0, end1, label))

    def add_cone_z(
        self,
        *,
        center_x: float,
        center_y: float,
        min_z: float,
        max_z: float,
        base_radius: float,
        top_radius: float,
        segments: int,
        label: str,
    ) -> None:
        base = len(self.vertices)
        for z_value, radius in ((min_z, base_radius), (max_z, top_radius)):
            for segment in range(segments):
                angle = 2.0 * math.pi * segment / segments
                x_value = center_x + radius * math.cos(angle)
                y_value = center_y + radius * math.sin(angle)
                self.vertices.append((x_value, y_value, z_value))
        bottom_center = len(self.vertices)
        self.vertices.append((center_x, center_y, min_z))
        top_center = len(self.vertices)
        self.vertices.append((center_x, center_y, max_z))

        for segment in range(segments):
            next_segment = (segment + 1) % segments
            bottom0 = base + segment
            bottom1 = base + next_segment
            top0 = base + segments + segment
            top1 = base + segments + next_segment
            self.faces.append((bottom0, top0, top1, label))
            self.faces.append((bottom0, top1, bottom1, label))
            self.faces.append((bottom_center, bottom1, bottom0, label))
            self.faces.append((top_center, top0, top1, label))

    def add_cylinder_between(
        self,
        start: FloatArray,
        end: FloatArray,
        *,
        radius: float,
        segments: int,
        label: str,
    ) -> None:
        axis = end - start
        length = float(np.linalg.norm(axis))
        if length <= 1e-9:
            return

        direction = axis / length
        reference = np.array([0.0, 0.0, 1.0], dtype=np.float64)
        if abs(float(np.dot(direction, reference))) > 0.9:
            reference = np.array([0.0, 1.0, 0.0], dtype=np.float64)
        side = np.cross(direction, reference)
        side /= np.linalg.norm(side)
        up = np.cross(direction, side)

        base = len(self.vertices)
        for endpoint in (start, end):
            for segment in range(segments):
                angle = 2.0 * math.pi * segment / segments
                ring_offset = side * (radius * math.cos(angle)) + up * (radius * math.sin(angle))
                vertex = endpoint + ring_offset
                self.vertices.append((float(vertex[0]), float(vertex[1]), float(vertex[2])))

        start_center = len(self.vertices)
        self.vertices.append((float(start[0]), float(start[1]), float(start[2])))
        end_center = len(self.vertices)
        self.vertices.append((float(end[0]), float(end[1]), float(end[2])))

        for segment in range(segments):
            next_segment = (segment + 1) % segments
            start0 = base + segment
            start1 = base + next_segment
            end0 = base + segments + segment
            end1 = base + segments + next_segment
            self.faces.append((start0, end0, end1, label))
            self.faces.append((start0, end1, start1, label))
            self.faces.append((start_center, start0, start1, label))
            self.faces.append((end_center, end1, end0, label))

    def build(self) -> tuple[FloatArray, list[MeshFace]]:
        vertices = np.array(self.vertices, dtype=np.float64) if self.vertices else np.empty((0, 3))
        faces = [
            MeshFace(vertex_indices=(i0, i1, i2), label=label)
            for i0, i1, i2, label in self.faces
        ]
        return vertices, faces


def _vector(x_value: float, y_value: float, z_value: float) -> FloatArray:
    return np.array([x_value, y_value, z_value], dtype=np.float64)


def _mean_center(vertices: FloatArray) -> FloatArray:
    return np.asarray(np.mean(vertices, axis=0), dtype=np.float64)


def _build_sedan_geometry(spec: SedanSpec) -> GeneratedObjectGeometry:
    builder = MeshBuilder()
    wheel_radius = min(spec.height * 0.22, 0.36)
    wheel_width = spec.width * 0.14
    half_width = spec.width / 2.0
    half_length = spec.length / 2.0
    body_bottom = wheel_radius * 0.55
    body_top = spec.height * 0.68
    roof_top = spec.roof_height
    roof_start = -half_length + spec.hood_length
    roof_end = half_length - spec.trunk_length

    builder.add_box(
        min_x=-half_width * 0.96,
        max_x=half_width * 0.96,
        min_y=-half_length,
        max_y=half_length,
        min_z=body_bottom,
        max_z=body_top,
        label="body",
    )
    builder.add_box(
        min_x=-half_width * 0.72,
        max_x=half_width * 0.72,
        min_y=roof_start,
        max_y=roof_end,
        min_z=body_top - 0.03,
        max_z=roof_top,
        label="cabin",
    )

    front_axle_y = spec.wheelbase / 2.0
    rear_axle_y = -spec.wheelbase / 2.0
    wheel_x = half_width * 0.72
    for wheel_y in (front_axle_y, rear_axle_y):
        builder.add_cylinder_x(
            center_x=-wheel_x,
            center_y=wheel_y,
            center_z=wheel_radius,
            radius=wheel_radius,
            length=wheel_width,
            segments=12,
            label="wheel",
        )
        builder.add_cylinder_x(
            center_x=wheel_x,
            center_y=wheel_y,
            center_z=wheel_radius,
            radius=wheel_radius,
            length=wheel_width,
            segments=12,
            label="wheel",
        )

    vertices, faces = builder.build()
    landmarks = {
        "front_bumper_center": _vector(
            0.0,
            half_length,
            body_bottom + (body_top - body_bottom) * 0.5,
        ),
        "rear_bumper_center": _vector(
            0.0,
            -half_length,
            body_bottom + (body_top - body_bottom) * 0.5,
        ),
        "roof_center": _vector(0.0, (roof_start + roof_end) / 2.0, roof_top),
        "front_left_wheel_center": _vector(-wheel_x, front_axle_y, wheel_radius),
        "front_right_wheel_center": _vector(wheel_x, front_axle_y, wheel_radius),
        "rear_left_wheel_center": _vector(-wheel_x, rear_axle_y, wheel_radius),
        "rear_right_wheel_center": _vector(wheel_x, rear_axle_y, wheel_radius),
    }
    return GeneratedObjectGeometry(
        vertices=vertices,
        mesh_faces=faces,
        landmarks=landmarks,
        debug_edges=[],
        debug_faces=[],
        center=_mean_center(vertices),
    )


def _build_truck_geometry(spec: TruckSpec) -> GeneratedObjectGeometry:
    builder = MeshBuilder()
    total_length = spec.cab_length + spec.cargo_length
    half_total_length = total_length / 2.0
    half_width = spec.cargo_width / 2.0
    wheel_radius = min(spec.cargo_height * 0.17, 0.48)
    wheel_width = spec.cargo_width * 0.14
    body_bottom = wheel_radius * 0.55
    cargo_front = half_total_length - spec.cab_length
    cargo_rear = -half_total_length
    cab_front = half_total_length
    cab_rear = cargo_front

    builder.add_box(
        min_x=-half_width,
        max_x=half_width,
        min_y=cargo_rear,
        max_y=cargo_front,
        min_z=body_bottom,
        max_z=spec.cargo_height,
        label="cargo",
    )
    builder.add_box(
        min_x=-half_width * 0.82,
        max_x=half_width * 0.82,
        min_y=cab_rear,
        max_y=cab_front,
        min_z=body_bottom,
        max_z=spec.cab_height,
        label="cab",
    )

    front_axle_y = spec.wheelbase / 2.0
    rear_axle_y = -spec.wheelbase / 2.0
    wheel_x = half_width * 0.76
    for wheel_y in (front_axle_y, rear_axle_y):
        builder.add_cylinder_x(
            center_x=-wheel_x,
            center_y=wheel_y,
            center_z=wheel_radius,
            radius=wheel_radius,
            length=wheel_width,
            segments=12,
            label="wheel",
        )
        builder.add_cylinder_x(
            center_x=wheel_x,
            center_y=wheel_y,
            center_z=wheel_radius,
            radius=wheel_radius,
            length=wheel_width,
            segments=12,
            label="wheel",
        )

    vertices, faces = builder.build()
    landmarks = {
        "front_bumper_center": _vector(0.0, cab_front, body_bottom + spec.cab_height * 0.45),
        "cargo_rear_center": _vector(0.0, cargo_rear, body_bottom + spec.cargo_height * 0.45),
        "cargo_roof_center": _vector(0.0, (cargo_rear + cargo_front) / 2.0, spec.cargo_height),
        "front_left_wheel_center": _vector(-wheel_x, front_axle_y, wheel_radius),
        "front_right_wheel_center": _vector(wheel_x, front_axle_y, wheel_radius),
        "rear_left_wheel_center": _vector(-wheel_x, rear_axle_y, wheel_radius),
        "rear_right_wheel_center": _vector(wheel_x, rear_axle_y, wheel_radius),
    }
    return GeneratedObjectGeometry(
        vertices=vertices,
        mesh_faces=faces,
        landmarks=landmarks,
        debug_edges=[],
        debug_faces=[],
        center=_mean_center(vertices),
    )


def _build_bicycle_geometry(spec: BicycleSpec) -> GeneratedObjectGeometry:
    builder = MeshBuilder()
    wheel_radius = spec.wheel_diameter / 2.0
    tire_width = max(0.03, spec.handlebar_width * 0.08)
    front_wheel = _vector(0.0, spec.wheelbase / 2.0, wheel_radius)
    rear_wheel = _vector(0.0, -spec.wheelbase / 2.0, wheel_radius)
    bottom_bracket = _vector(0.0, -spec.wheelbase * 0.08, wheel_radius + spec.frame_height * 0.14)
    seat_joint = _vector(0.0, -spec.wheelbase * 0.14, spec.saddle_height)
    head_top = _vector(0.0, spec.wheelbase * 0.3, wheel_radius + spec.frame_height)
    head_bottom = _vector(0.0, spec.wheelbase * 0.24, wheel_radius + spec.frame_height * 0.55)
    handlebar_left = head_top + _vector(-spec.handlebar_width / 2.0, 0.0, 0.03)
    handlebar_right = head_top + _vector(spec.handlebar_width / 2.0, 0.0, 0.03)

    for wheel_center in (front_wheel, rear_wheel):
        builder.add_cylinder_x(
            center_x=float(wheel_center[0]),
            center_y=float(wheel_center[1]),
            center_z=float(wheel_center[2]),
            radius=wheel_radius,
            length=tire_width,
            segments=16,
            label="wheel",
        )

    tube_radius = max(0.018, spec.wheel_diameter * 0.025)
    for start, end in (
        (rear_wheel, bottom_bracket),
        (bottom_bracket, head_bottom),
        (head_bottom, head_top),
        (seat_joint, head_top),
        (bottom_bracket, seat_joint),
        (rear_wheel, seat_joint),
        (head_bottom, front_wheel),
    ):
        builder.add_cylinder_between(start, end, radius=tube_radius, segments=8, label="frame")

    builder.add_cylinder_between(
        handlebar_left,
        handlebar_right,
        radius=tube_radius * 0.85,
        segments=8,
        label="handlebar",
    )
    builder.add_box(
        min_x=-spec.handlebar_width * 0.18,
        max_x=spec.handlebar_width * 0.18,
        min_y=float(seat_joint[1] - 0.06),
        max_y=float(seat_joint[1] + 0.06),
        min_z=float(seat_joint[2]),
        max_z=float(seat_joint[2] + 0.04),
        label="saddle",
    )

    vertices, faces = builder.build()
    landmarks = {
        "front_wheel_center": front_wheel,
        "rear_wheel_center": rear_wheel,
        "handlebar_center": (handlebar_left + handlebar_right) / 2.0,
        "saddle_center": seat_joint + _vector(0.0, 0.0, 0.02),
        "bottom_bracket": bottom_bracket,
    }
    return GeneratedObjectGeometry(
        vertices=vertices,
        mesh_faces=faces,
        landmarks=landmarks,
        debug_edges=[],
        debug_faces=[],
        center=_mean_center(vertices),
    )


def _build_pedestrian_geometry(spec: PedestrianSpec) -> GeneratedObjectGeometry:
    builder = MeshBuilder()
    body_height = spec.body_height
    head_radius = body_height * 0.09 * spec.head_scale
    leg_height = body_height * 0.47
    torso_height = body_height * 0.31
    hip_height = leg_height
    shoulder_height = hip_height + torso_height
    torso_width = spec.shoulder_width
    hip_width = spec.hip_width
    leg_width = hip_width * 0.34
    arm_width = torso_width * 0.16
    foot_length = spec.torso_depth * 0.9
    foot_width = leg_width * 1.2

    left_leg_x = -hip_width * 0.22
    right_leg_x = hip_width * 0.22

    for leg_x in (left_leg_x, right_leg_x):
        builder.add_box(
            min_x=leg_x - leg_width / 2.0,
            max_x=leg_x + leg_width / 2.0,
            min_y=-spec.torso_depth / 2.0,
            max_y=spec.torso_depth / 2.0,
            min_z=0.0,
            max_z=leg_height,
            label="leg",
        )
        builder.add_box(
            min_x=leg_x - foot_width / 2.0,
            max_x=leg_x + foot_width / 2.0,
            min_y=-foot_length * 0.35,
            max_y=foot_length * 0.65,
            min_z=0.0,
            max_z=body_height * 0.03,
            label="foot",
        )

    builder.add_box(
        min_x=-torso_width / 2.0,
        max_x=torso_width / 2.0,
        min_y=-spec.torso_depth / 2.0,
        max_y=spec.torso_depth / 2.0,
        min_z=hip_height,
        max_z=shoulder_height,
        label="torso",
    )
    for arm_x in (-torso_width / 2.0 - arm_width / 2.0, torso_width / 2.0 + arm_width / 2.0):
        builder.add_box(
            min_x=arm_x - arm_width / 2.0,
            max_x=arm_x + arm_width / 2.0,
            min_y=-spec.torso_depth / 2.5,
            max_y=spec.torso_depth / 2.5,
            min_z=hip_height + torso_height * 0.18,
            max_z=shoulder_height,
            label="arm",
        )

    builder.add_box(
        min_x=-head_radius,
        max_x=head_radius,
        min_y=-head_radius,
        max_y=head_radius,
        min_z=shoulder_height,
        max_z=shoulder_height + head_radius * 2.0,
        label="head",
    )

    vertices, faces = builder.build()
    landmarks = {
        "head_top": _vector(0.0, 0.0, shoulder_height + head_radius * 2.0),
        "shoulder_center": _vector(0.0, 0.0, shoulder_height),
        "hip_center": _vector(0.0, 0.0, hip_height),
        "left_foot_center": _vector(left_leg_x, foot_length * 0.15, body_height * 0.015),
        "right_foot_center": _vector(right_leg_x, foot_length * 0.15, body_height * 0.015),
    }
    return GeneratedObjectGeometry(
        vertices=vertices,
        mesh_faces=faces,
        landmarks=landmarks,
        debug_edges=[],
        debug_faces=[],
        center=_mean_center(vertices),
    )


def _build_traffic_cone_geometry(spec: TrafficConeSpec) -> GeneratedObjectGeometry:
    builder = MeshBuilder()
    base_height = spec.cone_height * 0.08
    base_radius = spec.base_diameter / 2.0
    top_radius = spec.top_diameter / 2.0
    builder.add_cone_z(
        center_x=0.0,
        center_y=0.0,
        min_z=base_height,
        max_z=spec.cone_height,
        base_radius=base_radius * 0.78,
        top_radius=top_radius,
        segments=16,
        label="cone",
    )
    builder.add_box(
        min_x=-base_radius,
        max_x=base_radius,
        min_y=-base_radius,
        max_y=base_radius,
        min_z=0.0,
        max_z=base_height,
        label="base",
    )

    vertices, faces = builder.build()
    landmarks = {
        "tip_center": _vector(0.0, 0.0, spec.cone_height),
        "base_center": _vector(0.0, 0.0, base_height / 2.0),
        "base_front_edge": _vector(0.0, base_radius, base_height),
    }
    return GeneratedObjectGeometry(
        vertices=vertices,
        mesh_faces=faces,
        landmarks=landmarks,
        debug_edges=[],
        debug_faces=[],
        center=_mean_center(vertices),
    )


def _build_custom_points_geometry(spec: CustomPointSpec) -> GeneratedObjectGeometry:
    points, edges, faces, center = build_custom_geometry(spec)
    vertices = np.array([[point.x, point.y, point.z] for point in points], dtype=np.float64)
    landmarks = {
        point.id: np.array([point.x, point.y, point.z], dtype=np.float64) for point in points
    }
    mesh_faces: list[MeshFace] = []
    point_index_by_id = {point.id: index for index, point in enumerate(points)}
    for face in faces:
        if len(face.point_ids) < 3:
            continue
        point_indices = [point_index_by_id[point_id] for point_id in face.point_ids]
        for index in range(1, len(point_indices) - 1):
            mesh_faces.append(
                MeshFace(
                    vertex_indices=(
                        point_indices[0],
                        point_indices[index],
                        point_indices[index + 1],
                    ),
                    label=face.label,
                )
            )
    return GeneratedObjectGeometry(
        vertices=vertices,
        mesh_faces=mesh_faces,
        landmarks=landmarks,
        debug_edges=edges,
        debug_faces=faces,
        center=center,
    )


def generate_object_geometry(
    object_spec: (
        SedanSpec
        | TruckSpec
        | BicycleSpec
        | PedestrianSpec
        | TrafficConeSpec
        | CustomPointSpec
    ),
) -> GeneratedObjectGeometry:
    if isinstance(object_spec, SedanSpec):
        return _build_sedan_geometry(object_spec)
    if isinstance(object_spec, TruckSpec):
        return _build_truck_geometry(object_spec)
    if isinstance(object_spec, BicycleSpec):
        return _build_bicycle_geometry(object_spec)
    if isinstance(object_spec, PedestrianSpec):
        return _build_pedestrian_geometry(object_spec)
    if isinstance(object_spec, TrafficConeSpec):
        return _build_traffic_cone_geometry(object_spec)
    return _build_custom_points_geometry(object_spec)
