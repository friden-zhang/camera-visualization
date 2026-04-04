from __future__ import annotations

import math
from typing import TypeAlias, cast

import numpy as np
import numpy.typing as npt

from camviz.api.models import Pose3D

FloatArray: TypeAlias = npt.NDArray[np.float64]

WORLD_UP: FloatArray = np.array([0.0, 0.0, 1.0], dtype=np.float64)
WORLD_DOWN: FloatArray = np.array([0.0, 0.0, -1.0], dtype=np.float64)


def _normalize(vector: FloatArray) -> FloatArray:
    norm = float(np.linalg.norm(vector))
    if norm < 1e-12:
        raise ValueError("cannot normalize near-zero vector")
    return vector / norm


def _rodrigues(axis: FloatArray, angle_rad: float) -> FloatArray:
    axis = _normalize(axis)
    x_axis, y_axis, z_axis = axis
    skew: FloatArray = np.array(
        [[0.0, -z_axis, y_axis], [z_axis, 0.0, -x_axis], [-y_axis, x_axis, 0.0]],
        dtype=np.float64,
    )
    identity: FloatArray = np.eye(3, dtype=np.float64)
    return cast(
        FloatArray,
        identity
        + math.sin(angle_rad) * skew
        + (1.0 - math.cos(angle_rad)) * np.matmul(skew, skew),
    )


def _forward_from_yaw_pitch(
    yaw_deg: float,
    pitch_deg: float,
    *,
    pitch_down_positive: bool,
) -> FloatArray:
    yaw_rad = math.radians(yaw_deg)
    pitch_rad = math.radians(pitch_deg)
    z_value = -math.sin(pitch_rad) if pitch_down_positive else math.sin(pitch_rad)
    forward: FloatArray = np.array(
        [
            math.sin(yaw_rad) * math.cos(pitch_rad),
            math.cos(yaw_rad) * math.cos(pitch_rad),
            z_value,
        ],
        dtype=np.float64,
    )
    return _normalize(forward)


def object_rotation_matrix(pose: Pose3D) -> FloatArray:
    forward = _forward_from_yaw_pitch(pose.yaw, pose.pitch, pitch_down_positive=False)
    right = cast(FloatArray, np.cross(forward, WORLD_UP))
    if np.linalg.norm(right) < 1e-12:
        right = np.array([1.0, 0.0, 0.0], dtype=np.float64)
    right = _normalize(right)
    up = _normalize(cast(FloatArray, np.cross(right, forward)))
    if abs(pose.roll) > 1e-12:
        rotation = _rodrigues(forward, math.radians(pose.roll))
        right = rotation @ right
        up = rotation @ up
    return cast(FloatArray, np.column_stack((right, forward, up)))


def camera_rotation_matrix(pose: Pose3D) -> FloatArray:
    forward = _forward_from_yaw_pitch(pose.yaw, pose.pitch, pitch_down_positive=True)
    right = cast(FloatArray, np.cross(forward, WORLD_UP))
    if np.linalg.norm(right) < 1e-12:
        right = np.array([1.0, 0.0, 0.0], dtype=np.float64)
    right = _normalize(right)
    down = _normalize(cast(FloatArray, np.cross(forward, right)))
    if abs(pose.roll) > 1e-12:
        rotation = _rodrigues(forward, math.radians(pose.roll))
        right = rotation @ right
        down = rotation @ down
    return cast(FloatArray, np.column_stack((right, down, forward)))


def local_to_world(points: FloatArray, pose: Pose3D) -> FloatArray:
    rotation = object_rotation_matrix(pose)
    translation: FloatArray = np.array([pose.x, pose.y, pose.z], dtype=np.float64)
    return (rotation @ points.T).T + translation


def world_to_camera_extrinsics(camera_pose: Pose3D) -> tuple[FloatArray, FloatArray]:
    camera_to_world = camera_rotation_matrix(camera_pose)
    world_to_camera = camera_to_world.T
    camera_origin: FloatArray = np.array(
        [camera_pose.x, camera_pose.y, camera_pose.z],
        dtype=np.float64,
    )
    translation = -world_to_camera @ camera_origin
    return world_to_camera, translation


def world_to_camera(points: FloatArray, camera_pose: Pose3D) -> FloatArray:
    rotation, translation = world_to_camera_extrinsics(camera_pose)
    return (rotation @ points.T).T + translation
