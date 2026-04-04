import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadPersistedInputState,
  loadPersistedLayout,
  resolvePersistedRequest,
  savePersistedLayout,
  savePersistedOverlayUrl,
  savePersistedRequest
} from "./persistence";
import type { ProjectionSchema } from "../types";

const objectPose = {
  x: 0,
  y: 14,
  z: 0,
  yaw: 0,
  pitch: 0,
  roll: 0
};

const schema: ProjectionSchema = {
  object_types: [
    {
      type: "sedan",
      label: "Sedan",
      parameters: [
        { name: "length", label: "length", group: "Body", min: 3.8, max: 5.8, step: 0.1 },
        { name: "width", label: "width", group: "Body", min: 1.5, max: 2.2, step: 0.05 },
        { name: "height", label: "height", group: "Body", min: 1.2, max: 2, step: 0.05 },
        { name: "wheelbase", label: "wheelbase", group: "Body", min: 2.1, max: 3.6, step: 0.05 },
        { name: "roof_height", label: "roof height", group: "Profile", min: 1, max: 1.8, step: 0.05 },
        { name: "hood_length", label: "hood length", group: "Profile", min: 0.6, max: 1.6, step: 0.05 },
        { name: "trunk_length", label: "trunk length", group: "Profile", min: 0.5, max: 1.6, step: 0.05 }
      ],
      defaults: {
        type: "sedan",
        length: 4.6,
        width: 1.82,
        height: 1.46,
        wheelbase: 2.75,
        roof_height: 1.34,
        hood_length: 1.05,
        trunk_length: 0.9,
        pose: objectPose
      }
    },
    {
      type: "bicycle",
      label: "Bicycle",
      parameters: [
        { name: "wheel_diameter", label: "wheel diameter", group: "Frame", min: 0.45, max: 0.9, step: 0.01 },
        { name: "wheelbase", label: "wheelbase", group: "Frame", min: 0.9, max: 1.4, step: 0.01 },
        { name: "frame_height", label: "frame height", group: "Frame", min: 0.45, max: 0.9, step: 0.01 },
        { name: "handlebar_width", label: "handlebar width", group: "Cockpit", min: 0.32, max: 0.8, step: 0.01 },
        { name: "saddle_height", label: "saddle height", group: "Cockpit", min: 0.55, max: 1.2, step: 0.01 }
      ],
      defaults: {
        type: "bicycle",
        wheel_diameter: 0.68,
        wheelbase: 1.08,
        frame_height: 0.62,
        handlebar_width: 0.48,
        saddle_height: 0.92,
        pose: objectPose
      }
    },
    {
      type: "custom_points",
      label: "Custom Points",
      parameters: [],
      defaults: {
        type: "custom_points",
        pose: objectPose,
        points: [
          { id: "a", x: -1, y: -1, z: 0 },
          { id: "b", x: 1, y: -1, z: 0 },
          { id: "c", x: 0, y: 1, z: 0 }
        ],
        edges: [
          { start_id: "a", end_id: "b" },
          { start_id: "b", end_id: "c" },
          { start_id: "c", end_id: "a" }
        ],
        faces: []
      }
    }
  ],
  distortion_models: ["opencv", "fisheye"],
  defaults: {
    camera_intrinsics: {
      fx: 1567.36,
      fy: 1567.31,
      cx: 961.59,
      cy: 542.3,
      image_width: 1920,
      image_height: 1080
    },
    distortion: {
      model: "opencv",
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
      type: "sedan",
      length: 4.6,
      width: 1.82,
      height: 1.46,
      wheelbase: 2.75,
      roof_height: 1.34,
      hood_length: 1.05,
      trunk_length: 0.9,
      pose: objectPose
    },
    display_options: {
      show_frustum: true,
      show_bbox: true,
      show_distorted: true,
      show_undistorted: true,
      show_labels: true,
      show_axes: true
    }
  }
};

function installIndexedDbMock(): void {
  const records = new Map<string, string>();
  let hasOverlayStore = false;

  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      open: vi.fn(() => {
        const request = {
          result: null as FakeDatabase | null,
          onupgradeneeded: null as (() => void) | null,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null
        };

        window.setTimeout(() => {
          const database: FakeDatabase = {
            objectStoreNames: {
              contains: (name: string) => hasOverlayStore && name === "overlay"
            },
            createObjectStore: (_name: string) => {
              hasOverlayStore = true;
              return {};
            },
            transaction: () => {
              const transaction = {
                objectStore: () => ({
                  get: (key: string) => {
                    const getRequest = {
                      result: undefined as string | undefined,
                      onsuccess: null as (() => void) | null,
                      onerror: null as (() => void) | null
                    };
                    window.setTimeout(() => {
                      getRequest.result = records.get(key);
                      getRequest.onsuccess?.();
                    }, 0);
                    return getRequest;
                  },
                  put: (value: string, key: string) => {
                    records.set(key, value);
                    window.setTimeout(() => transaction.oncomplete?.(), 0);
                  },
                  delete: (key: string) => {
                    records.delete(key);
                    window.setTimeout(() => transaction.oncomplete?.(), 0);
                  }
                }),
                oncomplete: null as (() => void) | null,
                onerror: null as (() => void) | null
              };
              return transaction;
            },
            close: vi.fn()
          };

          request.result = database;
          if (!hasOverlayStore) {
            request.onupgradeneeded?.();
          }
          request.onsuccess?.();
        }, 0);

        return request;
      })
    }
  });
}

interface FakeDatabase {
  objectStoreNames: {
    contains: (name: string) => boolean;
  };
  createObjectStore: (name: string) => object;
  transaction: () => {
    objectStore: () => {
      get: (key: string) => {
        result: string | undefined;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
      };
      put: (value: string, key: string) => void;
      delete: (key: string) => void;
    };
    oncomplete: (() => void) | null;
    onerror: (() => void) | null;
  };
  close: () => void;
}

describe("persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    installIndexedDbMock();
  });

  afterEach(() => {
    window.localStorage.clear();
    // @ts-expect-error test cleanup
    delete globalThis.indexedDB;
  });

  it("saves and restores layout dimensions from localStorage", () => {
    savePersistedLayout({
      panelWidth: 420,
      sceneHeight: 380,
      imageWidth: 720
    });

    expect(loadPersistedLayout()).toEqual({
      panelWidth: 420,
      sceneHeight: 380,
      imageWidth: 720
    });
  });

  it("merges a persisted request into the latest schema defaults", () => {
    const restored = resolvePersistedRequest(schema, {
      camera_intrinsics: {
        fx: 1024
      },
      distortion: {
        model: "fisheye",
        k1: 0.1
      },
      camera_pose: {
        y: -6,
        pitch: 9
      },
      object_spec: {
        ...schema.object_types[1].defaults,
        pose: {
          ...objectPose,
          x: 1.2
        }
      },
      display_options: {
        show_bbox: false
      }
    });

    expect(restored).not.toBeNull();
    expect(restored?.camera_intrinsics.fx).toBe(1024);
    expect(restored?.camera_intrinsics.fy).toBe(schema.defaults.camera_intrinsics.fy);
    expect(restored?.distortion.model).toBe("fisheye");
    expect(restored?.distortion.k1).toBe(0.1);
    expect(restored?.camera_pose.y).toBe(-6);
    expect(restored?.camera_pose.pitch).toBe(9);
    expect(restored?.object_spec.type).toBe("bicycle");
    expect(restored?.object_spec.pose.x).toBe(1.2);
    expect(restored?.display_options.show_bbox).toBe(false);
    expect(restored?.display_options.show_axes).toBe(true);
  });

  it("persists the request in localStorage and the overlay image in IndexedDB", async () => {
    savePersistedRequest(schema.defaults);
    await savePersistedOverlayUrl("data:image/png;base64,AAAA");

    const restored = await loadPersistedInputState();
    expect(restored.request).toEqual(schema.defaults);
    expect(restored.overlayUrl).toBe("data:image/png;base64,AAAA");

    await savePersistedOverlayUrl(null);
    const restoredWithoutOverlay = await loadPersistedInputState();
    expect(restoredWithoutOverlay.overlayUrl).toBeNull();
  });
});
