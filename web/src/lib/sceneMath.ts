import { type ProjectionRequest, type ProjectionResult, type Pose3D, type Vector3 } from "../types";

export type SceneVector = [number, number, number];

const WORLD_UP: SceneVector = [0, 0, 1];

function normalize([x, y, z]: SceneVector): SceneVector {
  const magnitude = Math.hypot(x, y, z) || 1;
  return [x / magnitude, y / magnitude, z / magnitude];
}

function cross([ax, ay, az]: SceneVector, [bx, by, bz]: SceneVector): SceneVector {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function dot([ax, ay, az]: SceneVector, [bx, by, bz]: SceneVector): number {
  return ax * bx + ay * by + az * bz;
}

function add([ax, ay, az]: SceneVector, [bx, by, bz]: SceneVector): SceneVector {
  return [ax + bx, ay + by, az + bz];
}

function scale([x, y, z]: SceneVector, amount: number): SceneVector {
  return [x * amount, y * amount, z * amount];
}

function rotateAroundAxis(vector: SceneVector, axis: SceneVector, angleRadians: number): SceneVector {
  const normalizedAxis = normalize(axis);
  const cosAngle = Math.cos(angleRadians);
  const sinAngle = Math.sin(angleRadians);
  const term1 = scale(vector, cosAngle);
  const term2 = scale(cross(normalizedAxis, vector), sinAngle);
  const term3 = scale(normalizedAxis, dot(normalizedAxis, vector) * (1 - cosAngle));
  return add(add(term1, term2), term3);
}

function forwardFromYawPitch(
  yawDegrees: number,
  pitchDegrees: number,
  pitchDownPositive: boolean
): SceneVector {
  const yawRadians = (yawDegrees * Math.PI) / 180;
  const pitchRadians = (pitchDegrees * Math.PI) / 180;
  const zValue = pitchDownPositive ? -Math.sin(pitchRadians) : Math.sin(pitchRadians);
  return normalize([
    Math.sin(yawRadians) * Math.cos(pitchRadians),
    Math.cos(yawRadians) * Math.cos(pitchRadians),
    zValue
  ]);
}

export function cameraBasis(pose: Pose3D): {
  forward: SceneVector;
  right: SceneVector;
  down: SceneVector;
} {
  const forward = forwardFromYawPitch(pose.yaw, pose.pitch, true);
  let right = normalize(cross(forward, WORLD_UP));
  let down = normalize(cross(forward, right));

  if (Math.abs(pose.roll) > 1e-6) {
    const rollRadians = (pose.roll * Math.PI) / 180;
    right = rotateAroundAxis(right, forward, rollRadians);
    down = rotateAroundAxis(down, forward, rollRadians);
  }

  return { forward, right, down };
}

export function worldToScene({ x, y, z }: Vector3): SceneVector {
  return [x, z, y];
}

export function clampWorldToGround(point: Vector3): Vector3 {
  return {
    ...point,
    z: Math.max(point.z, 0)
  };
}

export function clipWorldSegmentToGround(start: Vector3, end: Vector3): [Vector3, Vector3] | null {
  if (start.z >= 0 && end.z >= 0) {
    return [start, end];
  }
  if (start.z < 0 && end.z < 0) {
    return null;
  }

  const denominator = end.z - start.z;
  if (Math.abs(denominator) < 1e-12) {
    return null;
  }

  const interpolation = (0 - start.z) / denominator;
  const intersection: Vector3 = {
    x: start.x + (end.x - start.x) * interpolation,
    y: start.y + (end.y - start.y) * interpolation,
    z: 0
  };

  return start.z >= 0 ? [start, intersection] : [intersection, end];
}

export function worldArrayToScene([x, y, z]: SceneVector): SceneVector {
  return [x, z, y];
}

export function sceneFrame(
  request: ProjectionRequest,
  projection: ProjectionResult | null
): {
  cameraPosition: SceneVector;
  target: SceneVector;
  orbitPosition: SceneVector;
  groundSize: number;
  groundCenter: SceneVector;
} {
  const cameraWorld: Vector3 = {
    x: request.camera_pose.x,
    y: request.camera_pose.y,
    z: request.camera_pose.z
  };
  const meshVertices = projection?.display_mesh.vertices ?? [];
  const worldPoints =
    meshVertices.length > 0
      ? meshVertices
      : projection?.projected_points.map((point) => point.world) ?? [];
  const objectWorld =
    projection?.center.world ?? {
      x: request.object_spec.pose.x,
      y: request.object_spec.pose.y,
      z: request.object_spec.pose.z
    };
  const cameraScene = worldToScene(cameraWorld);
  const objectScene = worldToScene(objectWorld);
  const cameraToObjectDistance = Math.hypot(
    objectWorld.x - cameraWorld.x,
    objectWorld.y - cameraWorld.y,
    objectWorld.z - cameraWorld.z
  );
  const maxObjectHeight =
    worldPoints.length > 0 ? Math.max(...worldPoints.map((point) => point.z)) : objectWorld.z;
  const minX = worldPoints.length > 0 ? Math.min(...worldPoints.map((point) => point.x)) : objectWorld.x;
  const maxX = worldPoints.length > 0 ? Math.max(...worldPoints.map((point) => point.x)) : objectWorld.x;
  const minY = worldPoints.length > 0 ? Math.min(...worldPoints.map((point) => point.y)) : objectWorld.y;
  const maxY = worldPoints.length > 0 ? Math.max(...worldPoints.map((point) => point.y)) : objectWorld.y;
  const objectSpan = Math.max(maxX - minX, maxY - minY, maxObjectHeight, 2);
  const objectCenterX = (minX + maxX) / 2;
  const objectCenterY = (minY + maxY) / 2;
  const target: SceneVector = [
    objectCenterX,
    Math.max(objectScene[1] + maxObjectHeight * 0.16, maxObjectHeight * 0.52, 0.72),
    objectCenterY
  ];
  const lookDistance = Math.max(16, cameraToObjectDistance * 0.92, objectSpan * 5.6);
  const orbitOffset = scale(normalize([0.68, 0.52, -0.92]), lookDistance);
  const orbitPosition = add(target, orbitOffset);

  const worldXs = [cameraWorld.x, objectWorld.x, ...worldPoints.map((point) => point.x)];
  const worldYs = [cameraWorld.y, objectWorld.y, ...worldPoints.map((point) => point.y)];
  const groundCenter: SceneVector = [
    (Math.max(...worldXs) + Math.min(...worldXs)) / 2,
    0,
    (Math.max(...worldYs) + Math.min(...worldYs)) / 2
  ];
  const groundSize = Math.max(
    26,
    (Math.max(...worldXs) - Math.min(...worldXs) + Math.max(...worldYs) - Math.min(...worldYs)) * 2.4
  );

  return {
    cameraPosition: cameraScene,
    target,
    orbitPosition,
    groundSize,
    groundCenter
  };
}

export function frustumWorldPoints(request: ProjectionRequest, depth: number): SceneVector[] {
  const { forward, right, down } = cameraBasis(request.camera_pose);
  const intrinsics = request.camera_intrinsics;
  const corners = [
    [0, 0],
    [intrinsics.image_width, 0],
    [intrinsics.image_width, intrinsics.image_height],
    [0, intrinsics.image_height]
  ] as const;

  return corners.map(([u, v]) => {
    const x = ((u - intrinsics.cx) / intrinsics.fx) * depth;
    const y = ((v - intrinsics.cy) / intrinsics.fy) * depth;
    const world = add(
      add(
        add([request.camera_pose.x, request.camera_pose.y, request.camera_pose.z], scale(right, x)),
        scale(down, y)
      ),
      scale(forward, depth)
    );
    return world;
  });
}

export function projectedWorldDistance(request: ProjectionRequest, projection: ProjectionResult | null): number {
  const center = projection?.center.world;
  if (!center) {
    return 8;
  }
  return Math.max(
    4,
    Math.hypot(
      center.x - request.camera_pose.x,
      center.y - request.camera_pose.y,
      center.z - request.camera_pose.z
    ) * 0.5
  );
}
