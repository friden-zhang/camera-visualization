import { describe, expect, it } from "vitest";

import { clipWorldSegmentToGround } from "./sceneMath";

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
