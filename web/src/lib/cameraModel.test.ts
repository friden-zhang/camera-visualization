import { describe, expect, it } from "vitest";

import { cameraModelAxes } from "./cameraModel";

function roundedAxis(values: number[]): number[] {
  return values.map((value) => {
    const rounded = Number(value.toFixed(6));
    return Object.is(rounded, -0) ? 0 : rounded;
  });
}

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

    expect(roundedAxis(axes.right)).toEqual([1, 0, 0]);
    expect(roundedAxis(axes.up)).toEqual([0, 1, 0]);
    expect(roundedAxis(axes.forward)).toEqual([0, 0, -1]);
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

    expect(roundedAxis(axes.forward)).toEqual([1, 0, 0]);
  });
});
