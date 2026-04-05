import { describe, expect, it } from "vitest";

import { alignedOrbitViewWorld, clipWorldSegmentToGround, sceneFrame, worldToScene } from "./sceneMath";

describe("sceneMath ground clipping", () => {
  it("clips a segment where it crosses the ground plane", () => {
    expect(
      clipWorldSegmentToGround(
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 2, z: -1 }
      )
    ).toEqual([
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 1, z: 0 }
    ]);
  });

  it("drops a segment that stays entirely below ground", () => {
    expect(
      clipWorldSegmentToGround(
        { x: -1, y: 0, z: -0.5 },
        { x: 1, y: 2, z: -1.5 }
      )
    ).toBeNull();
  });
});

describe("sceneMath aligned orbit view", () => {
  it("keeps the spectator aligned to the physical camera optical axis", () => {
    const frame = alignedOrbitViewWorld(
      { x: 0, y: -4, z: 1.7, yaw: 0, pitch: 5, roll: 0 },
      { x: 100, y: 198.9, z: 1.8 },
      7,
      3.65
    );

    expect(frame.orbitWorld.y).toBeLessThan(-4);
    expect(frame.orbitWorld.x).toBeCloseTo(0, 6);
    expect(frame.targetWorld.x).toBeCloseTo(0, 6);
    expect(frame.targetWorld.y).toBeGreaterThan(150);
  });
});

describe("sceneMath coordinate mapping", () => {
  it("maps world forward to negative scene z so the 3D view is not mirrored", () => {
    expect(worldToScene({ x: 100, y: 200, z: 3 })).toEqual([100, 3, -200]);
  });

  it("maps the ground center with the same forward inversion", () => {
    const frame = sceneFrame(
      {
        camera_intrinsics: {
          fx: 1567.36,
          fy: 1567.31,
          cx: 961.59,
          cy: 542.3,
          image_width: 1920,
          image_height: 1080
        },
        distortion: {
          model: "radtan",
          k1: -0.31,
          k2: 0.08,
          p1: 0,
          p2: 0,
          k3: 0.07,
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
          type: "truck",
          cab_length: 2.2,
          cargo_length: 5.4,
          cargo_width: 2.4,
          cargo_height: 2.5,
          cab_height: 2.2,
          wheelbase: 4.8,
          pose: {
            x: 100,
            y: 200.11,
            z: 0.63,
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
      },
      null
    );

    expect(frame.groundCenter[2]).toBeLessThan(0);
  });
});
