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
  return [x, z, -y];
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
  return [x, z, -y];
}

export function alignedOrbitViewWorld(
  cameraWorld: Pose3D,
  objectWorld: Vector3,
  objectSpan: number,
  maxObjectHeight: number
): {
  orbitWorld: Vector3;
  targetWorld: Vector3;
} {
  const { forward } = cameraBasis(cameraWorld);
  const planarForward = normalize([forward[0], forward[1], 0]);
  const cameraToObjectDistance = Math.hypot(
    objectWorld.x - cameraWorld.x,
    objectWorld.y - cameraWorld.y,
    objectWorld.z - cameraWorld.z
  );
  const backDistance = Math.max(18, Math.min(cameraToObjectDistance * 0.18, 52), objectSpan * 2.8);
  const lift = Math.max(5, maxObjectHeight * 1.8, objectSpan * 1.05);

  const orbitWorld: Vector3 = {
    x: cameraWorld.x - planarForward[0] * backDistance,
    y: cameraWorld.y - planarForward[1] * backDistance,
    z: Math.max(cameraWorld.z + lift, 3.5)
  };
  const opticalDepth = Math.max(30, Math.min(cameraToObjectDistance * 0.75, 180));
  const targetWorld: Vector3 = {
    x: cameraWorld.x + forward[0] * opticalDepth,
    y: cameraWorld.y + forward[1] * opticalDepth,
    z: cameraWorld.z + forward[2] * opticalDepth
  };

  return { orbitWorld, targetWorld };
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
  const { orbitWorld, targetWorld } = alignedOrbitViewWorld(
    request.camera_pose,
    {
      x: objectCenterX,
      y: objectCenterY,
      z: Math.max(objectWorld.z, maxObjectHeight * 0.5)
    },
    objectSpan,
    maxObjectHeight
  );
  const target: SceneVector = worldToScene(targetWorld);
  const orbitPosition = worldToScene(orbitWorld);

  const worldXs = [cameraWorld.x, objectWorld.x, ...worldPoints.map((point) => point.x)];
  const worldYs = [cameraWorld.y, objectWorld.y, ...worldPoints.map((point) => point.y)];
  const groundCenter = worldToScene({
    x: (Math.max(...worldXs) + Math.min(...worldXs)) / 2,
    y: (Math.max(...worldYs) + Math.min(...worldYs)) / 2,
    z: 0
  });
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
