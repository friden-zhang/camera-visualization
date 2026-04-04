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
    model: "opencv",
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
    type: "box",
    width: 1.8,
    length: 4.4,
    height: 1.5,
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
    show_distorted: true,
    show_undistorted: true,
    show_labels: true,
    show_axes: true
  }
};

const projection: ProjectionResult = {
  projected_points: [
    {
      point_id: "p0",
      world: { x: -0.9, y: 11.8, z: 0 },
      camera: { x: 0, y: 0, z: 0 },
      undistorted_image: { x: 0, y: 0 },
      distorted_image: { x: 0, y: 0 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "p1",
      world: { x: 0.9, y: 11.8, z: 0 },
      camera: { x: 0, y: 0, z: 0 },
      undistorted_image: { x: 0, y: 0 },
      distorted_image: { x: 0, y: 0 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "p2",
      world: { x: 0.9, y: 16.2, z: 0 },
      camera: { x: 0, y: 0, z: 0 },
      undistorted_image: { x: 0, y: 0 },
      distorted_image: { x: 0, y: 0 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "p3",
      world: { x: -0.9, y: 16.2, z: 0 },
      camera: { x: 0, y: 0, z: 0 },
      undistorted_image: { x: 0, y: 0 },
      distorted_image: { x: 0, y: 0 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "p4",
      world: { x: -0.9, y: 11.8, z: 1.5 },
      camera: { x: 0, y: 0, z: 0 },
      undistorted_image: { x: 0, y: 0 },
      distorted_image: { x: 0, y: 0 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "p5",
      world: { x: 0.9, y: 11.8, z: 1.5 },
      camera: { x: 0, y: 0, z: 0 },
      undistorted_image: { x: 0, y: 0 },
      distorted_image: { x: 0, y: 0 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "p6",
      world: { x: 0.9, y: 16.2, z: 1.5 },
      camera: { x: 0, y: 0, z: 0 },
      undistorted_image: { x: 0, y: 0 },
      distorted_image: { x: 0, y: 0 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "p7",
      world: { x: -0.9, y: 16.2, z: 1.5 },
      camera: { x: 0, y: 0, z: 0 },
      undistorted_image: { x: 0, y: 0 },
      distorted_image: { x: 0, y: 0 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    }
  ],
  edges: [
    { start_id: "p0", end_id: "p1" },
    { start_id: "p1", end_id: "p2" },
    { start_id: "p2", end_id: "p3" },
    { start_id: "p3", end_id: "p0" },
    { start_id: "p4", end_id: "p5" },
    { start_id: "p5", end_id: "p6" },
    { start_id: "p6", end_id: "p7" },
    { start_id: "p7", end_id: "p4" }
  ],
  faces: [],
  center: {
    point_id: "object_center",
    world: { x: 0, y: 14, z: 0.75 },
    camera: { x: 0, y: 0, z: 0 },
    undistorted_image: { x: 640, y: 320 },
    distorted_image: { x: 640, y: 320 },
    visible: true,
    inside_image: true,
    inside_image_undistorted: true
  },
  bbox: {
    min_x: 0,
    max_x: 0,
    min_y: 0,
    max_y: 0,
    width: 0,
    height: 0,
    inside_image: true,
    intersects_image: true
  },
  undistorted_bbox: {
    min_x: 0,
    max_x: 0,
    min_y: 0,
    max_y: 0,
    width: 0,
    height: 0,
    inside_image: true,
    intersects_image: true
  },
  principal_point: { x: 640, y: 360 },
  analysis: {
    pixel_width: 0,
    pixel_height: 0,
    coverage_ratio: 0,
    distortion_mean_offset_px: 0,
    distortion_max_offset_px: 0,
    visible_point_count: 8,
    hidden_point_count: 0,
    center_inside_image: true,
    bbox_intersects_image: true,
    bbox_inside_image: true
  }
};

describe("projectionMath ground surface", () => {
  it("builds a full-width visible ground plane instead of a local patch near the object", () => {
    const surface = buildGroundProjectionSurface(request, projection);

    expect(surface).toHaveLength(4);
    expect(surface.every((corner) => corner.distorted_image)).toBe(true);

    const footprintProjection = projection.projected_points
      .filter((point) => point.world.z === 0)
      .map((point) => projectWorldPoint(point.world, request));
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
