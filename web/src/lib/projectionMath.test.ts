import { describe, expect, it } from "vitest";

import { buildGroundProjectionSurface, projectWorldPoint } from "./projectionMath";
import { type ProjectionRequest, type ProjectionResult } from "../types";

const request: ProjectionRequest = {
  camera_intrinsics: {
    fx: 960,
    fy: 960,
    cx: 640,
    cy: 360,
    image_width: 1280,
    image_height: 720
  },
  distortion: {
    model: "radtan",
    k1: 0,
    k2: 0,
    p1: 0,
    p2: 0,
    k3: 0,
    k4: 0,
    k5: 0,
    k6: 0
  },
  camera_pose: {
    x: 0,
    y: -4,
    z: 1.7,
    yaw: 0,
    pitch: 5,
    roll: 0
  },
  object_spec: {
    type: "sedan",
    length: 4.6,
    width: 1.82,
    height: 1.46,
    wheelbase: 2.75,
    roof_height: 1.34,
    hood_length: 1.05,
    trunk_length: 0.9,
    pose: {
      x: 0,
      y: 14,
      z: 0,
      yaw: 0,
      pitch: 0,
      roll: 0
    }
  },
  display_options: {
    show_frustum: true,
    show_bbox: true,
    show_labels: true,
    show_axes: true
  }
};

const projection: ProjectionResult = {
  object_type: "sedan",
  projected_points: [
    {
      point_id: "front_left_wheel_center",
      world: { x: -0.72, y: 15.35, z: 0.33 },
      camera: { x: -0.72, y: 0.05, z: 19.4 },
      undistorted_image: { x: 604, y: 362 },
      distorted_image: { x: 603, y: 363 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "front_right_wheel_center",
      world: { x: 0.72, y: 15.35, z: 0.33 },
      camera: { x: 0.72, y: 0.05, z: 19.4 },
      undistorted_image: { x: 676, y: 362 },
      distorted_image: { x: 677, y: 363 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "rear_left_wheel_center",
      world: { x: -0.72, y: 12.65, z: 0.33 },
      camera: { x: -0.72, y: 0.02, z: 16.65 },
      undistorted_image: { x: 598, y: 372 },
      distorted_image: { x: 597, y: 373 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "rear_right_wheel_center",
      world: { x: 0.72, y: 12.65, z: 0.33 },
      camera: { x: 0.72, y: 0.02, z: 16.65 },
      undistorted_image: { x: 682, y: 372 },
      distorted_image: { x: 683, y: 373 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    }
  ],
  edges: [],
  faces: [],
  center: {
    point_id: "object_center",
    world: { x: 0, y: 14, z: 0.75 },
    camera: { x: 0, y: -0.62, z: 18.01 },
    undistorted_image: { x: 640, y: 325.83 },
    distorted_image: { x: 640, y: 326.83 },
    visible: true,
    inside_image: true,
    inside_image_undistorted: true
  },
  bbox: {
    min_x: 586,
    max_x: 694,
    min_y: 281,
    max_y: 377,
    width: 108,
    height: 96,
    inside_image: true,
    intersects_image: true
  },
  undistorted_bbox: {
    min_x: 586,
    max_x: 694,
    min_y: 281,
    max_y: 377,
    width: 108,
    height: 96,
    inside_image: true,
    intersects_image: true
  },
  principal_point: { x: 640, y: 360 },
  analysis: {
    pixel_width: 108,
    pixel_height: 96,
    coverage_ratio: 0.012,
    distortion_mean_offset_px: 0.92,
    distortion_max_offset_px: 1.31,
    visible_point_count: 4,
    hidden_point_count: 0,
    center_inside_image: true,
    bbox_intersects_image: true,
    bbox_inside_image: true
  },
  display_mesh: {
    vertices: [
      { x: -0.91, y: 11.7, z: 0.28 },
      { x: 0.91, y: 11.7, z: 0.28 },
      { x: 0.91, y: 16.3, z: 0.28 },
      { x: -0.91, y: 16.3, z: 0.28 }
    ],
    faces: [
      { vertex_indices: [0, 1, 2], label: "body" },
      { vertex_indices: [0, 2, 3], label: "body" }
    ]
  },
  silhouette: {
    distorted: [
      {
        points: [
          { x: 592, y: 376 },
          { x: 587, y: 312 },
          { x: 640, y: 282 },
          { x: 693, y: 312 },
          { x: 688, y: 376 }
        ]
      }
    ],
    undistorted: [
      {
        points: [
          { x: 593, y: 375 },
          { x: 588, y: 311 },
          { x: 640, y: 281 },
          { x: 692, y: 311 },
          { x: 687, y: 375 }
        ]
      }
    ]
  }
};

describe("projectionMath ground surface", () => {
  it("builds a full-width visible ground plane instead of a local patch near the object", () => {
    const surface = buildGroundProjectionSurface(request, projection);

    expect(surface).toHaveLength(4);
    expect(surface.every((corner) => corner.distorted_image)).toBe(true);

    const footprintProjection = projection.projected_points.map((point) =>
      projectWorldPoint({ ...point.world, z: 0 }, request)
    );
    const footprintBottom = Math.max(
      ...footprintProjection.map((point) => point.distorted_image?.y ?? -Infinity)
    );
    const surfaceBottom = Math.max(
      ...surface.map((corner) => corner.distorted_image?.y ?? -Infinity)
    );
    const objectMinX = Math.min(
      ...footprintProjection.map((point) => point.distorted_image?.x ?? Infinity)
    );
    const objectMaxX = Math.max(
      ...footprintProjection.map((point) => point.distorted_image?.x ?? -Infinity)
    );
    const surfaceMinX = Math.min(...surface.map((corner) => corner.distorted_image?.x ?? Infinity));
    const surfaceMaxX = Math.max(...surface.map((corner) => corner.distorted_image?.x ?? -Infinity));
    const surfaceMaxY = Math.max(...surface.map((corner) => corner.distorted_image?.y ?? -Infinity));

    expect(surfaceBottom).toBeGreaterThan(footprintBottom);
    expect(surfaceMinX).toBeLessThanOrEqual(1);
    expect(surfaceMaxX).toBeGreaterThanOrEqual(request.camera_intrinsics.image_width - 1);
    expect(surfaceMaxY).toBeGreaterThanOrEqual(request.camera_intrinsics.image_height - 1);
    expect(surfaceMinX).toBeLessThan(objectMinX);
    expect(surfaceMaxX).toBeGreaterThan(objectMaxX);
  });
});
