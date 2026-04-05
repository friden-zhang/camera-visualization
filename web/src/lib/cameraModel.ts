import { Matrix4, Quaternion, Vector3 as ThreeVector3 } from "three";

import { type Pose3D } from "../types";
import { cameraBasis, type SceneVector } from "./sceneMath";

function worldDirectionToScene([x, y, z]: [number, number, number]): SceneVector {
  return [x, z, -y];
}

export function cameraModelAxes(pose: Pose3D): {
  right: SceneVector;
  up: SceneVector;
  forward: SceneVector;
} {
  const basis = cameraBasis(pose);
  return {
    right: worldDirectionToScene(basis.right),
    up: worldDirectionToScene([
      -basis.down[0],
      -basis.down[1],
      -basis.down[2]
    ]),
    forward: worldDirectionToScene(basis.forward)
  };
}

export function cameraModelQuaternion(pose: Pose3D): Quaternion {
  const axes = cameraModelAxes(pose);
  const matrix = new Matrix4().makeBasis(
    new ThreeVector3(...axes.right),
    new ThreeVector3(...axes.up),
    new ThreeVector3(...axes.forward)
  );
  return new Quaternion().setFromRotationMatrix(matrix);
}
