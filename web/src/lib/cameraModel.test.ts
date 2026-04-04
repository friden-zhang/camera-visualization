import { describe, expect, it } from "vitest";

import { cameraModelAxes } from "./cameraModel";

describe("cameraModelAxes", () => {
  it("aligns the default camera pose with the scene axes", () => {
    const axes = cameraModelAxes({
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      pitch: 0,
      roll: 0
    });

    expect(axes.right.map((value) => Number(value.toFixed(6)))).toEqual([1, 0, 0]);
    expect(axes.up.map((value) => Number(value.toFixed(6)))).toEqual([0, 1, 0]);
    expect(axes.forward.map((value) => Number(value.toFixed(6)))).toEqual([0, 0, 1]);
  });

  it("rotates the model forward axis with yaw", () => {
    const axes = cameraModelAxes({
      x: 0,
      y: 0,
      z: 0,
      yaw: 90,
      pitch: 0,
      roll: 0
    });

    expect(axes.forward.map((value) => Number(value.toFixed(6)))).toEqual([1, 0, 0]);
  });
});
