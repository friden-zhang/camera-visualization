import {
  type DistortionModel,
  type Point2D,
  type ProjectionRequest,
  type ProjectionResult,
  type Vector3
} from "../types";
import { cameraBasis, clampWorldToGround } from "./sceneMath";

export interface ProjectedImagePoint {
  point_id: string;
  world: Vector3;
  undistorted_image: Point2D | null;
  distorted_image: Point2D | null;
  visible: boolean;
}

export interface GroundProjectionSegment {
  start_id: string;
  end_id: string;
  start: ProjectedImagePoint;
  end: ProjectedImagePoint;
}

export interface GroundProjectionSurface {
  corners: ProjectedImagePoint[];
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(Math.max(value, minValue), maxValue);
}

function createImagePoint(pointId: string, imagePoint: Point2D): ProjectedImagePoint {
  return {
    point_id: pointId,
    world: { x: 0, y: 0, z: 0 },
    undistorted_image: imagePoint,
    distorted_image: imagePoint,
    visible: true
  };
}

function horizonYAtX(xPixel: number, request: ProjectionRequest): number | null {
  const { right, down, forward } = cameraBasis(request.camera_pose);
  if (Math.abs(down[2]) < 1e-9) {
    return null;
  }

  const xNorm = (xPixel - request.camera_intrinsics.cx) / request.camera_intrinsics.fx;
  const yNorm = -(forward[2] + right[2] * xNorm) / down[2];
  return request.camera_intrinsics.fy * yNorm + request.camera_intrinsics.cy;
}

function lerpPoint(start: Point2D, end: Point2D, amount: number): Point2D {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount
  };
}

function distortNormalized(
  xValue: number,
  yValue: number,
  distortion: DistortionModel
): [number, number] {
  if (distortion.model === "fisheye") {
    const radius = Math.hypot(xValue, yValue);
    if (radius < 1e-12) {
      return [xValue, yValue];
    }
    const theta = Math.atan(radius);
    const theta2 = theta * theta;
    const thetaDistorted =
      theta *
      (1 +
        distortion.k1 * theta2 +
        distortion.k2 * theta2 * theta2 +
        distortion.k3 * theta2 ** 3 +
        distortion.k4 * theta2 ** 4);
    const scale = thetaDistorted / radius;
    return [xValue * scale, yValue * scale];
  }

  const r2 = xValue * xValue + yValue * yValue;
  const r4 = r2 * r2;
  const r6 = r4 * r2;
  const numerator = 1 + distortion.k1 * r2 + distortion.k2 * r4 + distortion.k3 * r6;
  const denominator = 1 + distortion.k4 * r2 + distortion.k5 * r4 + distortion.k6 * r6;
  const radial = Math.abs(denominator) > 1e-12 ? numerator / denominator : numerator;
  const xDistorted =
    xValue * radial +
    2 * distortion.p1 * xValue * yValue +
    distortion.p2 * (r2 + 2 * xValue * xValue);
  const yDistorted =
    yValue * radial +
    distortion.p1 * (r2 + 2 * yValue * yValue) +
    2 * distortion.p2 * xValue * yValue;
  return [xDistorted, yDistorted];
}

export function projectWorldPoint(
  point: Vector3,
  request: ProjectionRequest
): ProjectedImagePoint {
  const { right, down, forward } = cameraBasis(request.camera_pose);
  const offset: [number, number, number] = [
    point.x - request.camera_pose.x,
    point.y - request.camera_pose.y,
    point.z - request.camera_pose.z
  ];
  const cameraX = offset[0] * right[0] + offset[1] * right[1] + offset[2] * right[2];
  const cameraY = offset[0] * down[0] + offset[1] * down[1] + offset[2] * down[2];
  const cameraZ = offset[0] * forward[0] + offset[1] * forward[1] + offset[2] * forward[2];

  if (cameraZ <= 1e-9) {
    return {
      point_id: "",
      world: point,
      undistorted_image: null,
      distorted_image: null,
      visible: false
    };
  }

  const xNorm = cameraX / cameraZ;
  const yNorm = cameraY / cameraZ;
  const undistortedImage = {
    x: request.camera_intrinsics.fx * xNorm + request.camera_intrinsics.cx,
    y: request.camera_intrinsics.fy * yNorm + request.camera_intrinsics.cy
  };
  const [xDistorted, yDistorted] = distortNormalized(xNorm, yNorm, request.distortion);
  return {
    point_id: "",
    world: point,
    undistorted_image: undistortedImage,
    distorted_image: {
      x: request.camera_intrinsics.fx * xDistorted + request.camera_intrinsics.cx,
      y: request.camera_intrinsics.fy * yDistorted + request.camera_intrinsics.cy
    },
    visible: true
  };
}

export function buildGroundProjectionPoints(
  request: ProjectionRequest,
  projection: ProjectionResult | null
): ProjectedImagePoint[] {
  if (!projection) {
    return [];
  }

  return projection.projected_points.map((point) => {
    const groundWorld = clampWorldToGround({
      x: point.world.x,
      y: point.world.y,
      z: 0
    });
    const projectedGroundPoint = projectWorldPoint(groundWorld, request);
    return {
      ...projectedGroundPoint,
      point_id: point.point_id
    };
  });
}

export function buildGroundProjectionSurface(
  request: ProjectionRequest,
  projection: ProjectionResult | null
): ProjectedImagePoint[] {
  if (!projection) {
    return [];
  }

  const width = request.camera_intrinsics.image_width;
  const height = request.camera_intrinsics.image_height;
  const leftHorizon = horizonYAtX(0, request);
  const rightHorizon = horizonYAtX(width, request);

  if (leftHorizon === null || rightHorizon === null) {
    return [];
  }

  if (leftHorizon >= height && rightHorizon >= height) {
    return [];
  }

  const topLeft = { x: 0, y: clamp(leftHorizon, 0, height) };
  const topRight = { x: width, y: clamp(rightHorizon, 0, height) };
  const bottomRight = { x: width, y: height };
  const bottomLeft = { x: 0, y: height };

  return [
    createImagePoint("ground-corner-0", topLeft),
    createImagePoint("ground-corner-1", topRight),
    createImagePoint("ground-corner-2", bottomRight),
    createImagePoint("ground-corner-3", bottomLeft)
  ];
}

export function buildGroundProjectionSegments(
  request: ProjectionRequest,
  projection: ProjectionResult | null
): GroundProjectionSegment[] {
  const surface = buildGroundProjectionSurface(request, projection);
  if (surface.length !== 4) {
    return [];
  }

  const topLeft = surface[0].distorted_image;
  const topRight = surface[1].distorted_image;
  const bottomRight = surface[2].distorted_image;
  const bottomLeft = surface[3].distorted_image;
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
    return [];
  }

  const guideDepths = [0.18, 0.4, 0.68];
  const guideColumns = [0.32, 0.5, 0.68];
  const segments: GroundProjectionSegment[] = [];

  guideDepths.forEach((depth, index) => {
    const easedDepth = depth * depth;
    const startPoint = lerpPoint(topLeft, bottomLeft, easedDepth);
    const endPoint = lerpPoint(topRight, bottomRight, easedDepth);
    segments.push({
      start_id: `ground-guide-depth-${index}-start`,
      end_id: `ground-guide-depth-${index}-end`,
      start: createImagePoint(`ground-guide-depth-${index}-start`, startPoint),
      end: createImagePoint(`ground-guide-depth-${index}-end`, endPoint)
    });
  });

  guideColumns.forEach((column, index) => {
    const startPoint = lerpPoint(topLeft, topRight, column);
    const endPoint = lerpPoint(bottomLeft, bottomRight, column);
    segments.push({
      start_id: `ground-guide-column-${index}-start`,
      end_id: `ground-guide-column-${index}-end`,
      start: createImagePoint(`ground-guide-column-${index}-start`, startPoint),
      end: createImagePoint(`ground-guide-column-${index}-end`, endPoint)
    });
  });

  return segments;
}
