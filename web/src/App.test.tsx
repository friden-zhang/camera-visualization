import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockPersistedLayoutState {
  panelWidth: number;
  sceneHeight: number;
  imageWidth: number;
}

const persistenceMock = vi.hoisted(() => ({
  loadPersistedInputState: vi.fn<
    () => Promise<{ request: unknown | null; overlayUrl: string | null }>
  >(async () => ({ request: null, overlayUrl: null })),
  loadPersistedLayout: vi.fn<() => MockPersistedLayoutState | null>(() => null),
  resolvePersistedRequest: vi.fn<(schema: unknown, rawRequest: unknown) => unknown | null>(
    (_: unknown, rawRequest: unknown) => rawRequest
  ),
  savePersistedRequest: vi.fn(),
  savePersistedLayout: vi.fn(),
  savePersistedOverlayUrl: vi.fn(async () => undefined)
}));

vi.mock("./lib/persistence", () => persistenceMock);

import App from "./App";
import "./styles.css";

const objectPose = {
  x: 0,
  y: 14,
  z: 0,
  yaw: 0,
  pitch: 0,
  roll: 0
};

const customDefaults = {
  type: "custom_points",
  pose: objectPose,
  points: [
    { id: "a", x: -1, y: -1, z: 0 },
    { id: "b", x: 1, y: -1, z: 0 },
    { id: "c", x: 1, y: 1, z: 0 },
    { id: "d", x: -1, y: 1, z: 0 },
    { id: "e", x: 0, y: 0, z: 2 }
  ],
  edges: [
    { start_id: "a", end_id: "b" },
    { start_id: "b", end_id: "c" },
    { start_id: "c", end_id: "d" },
    { start_id: "d", end_id: "a" },
    { start_id: "a", end_id: "e" },
    { start_id: "b", end_id: "e" },
    { start_id: "c", end_id: "e" },
    { start_id: "d", end_id: "e" }
  ],
  faces: []
};

const schemaPayload = {
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
      type: "truck",
      label: "Truck",
      parameters: [
        { name: "cab_length", label: "cab length", group: "Cab", min: 1.8, max: 3.2, step: 0.1 },
        { name: "cargo_length", label: "cargo length", group: "Cargo", min: 3, max: 9, step: 0.1 },
        { name: "cargo_width", label: "cargo width", group: "Cargo", min: 2, max: 3.2, step: 0.05 },
        { name: "cargo_height", label: "cargo height", group: "Cargo", min: 2, max: 4.5, step: 0.05 },
        { name: "cab_height", label: "cab height", group: "Cab", min: 1.8, max: 3.2, step: 0.05 },
        { name: "wheelbase", label: "wheelbase", group: "Chassis", min: 3, max: 7, step: 0.1 }
      ],
      defaults: {
        type: "truck",
        cab_length: 2.3,
        cargo_length: 5.6,
        cargo_width: 2.45,
        cargo_height: 2.85,
        cab_height: 2.2,
        wheelbase: 4.6,
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
      type: "pedestrian",
      label: "Pedestrian",
      parameters: [
        { name: "body_height", label: "body height", group: "Body", min: 1.4, max: 2.1, step: 0.01 },
        { name: "shoulder_width", label: "shoulder width", group: "Body", min: 0.3, max: 0.7, step: 0.01 },
        { name: "torso_depth", label: "torso depth", group: "Body", min: 0.15, max: 0.45, step: 0.01 },
        { name: "hip_width", label: "hip width", group: "Body", min: 0.24, max: 0.55, step: 0.01 },
        { name: "head_scale", label: "head scale", group: "Profile", min: 0.7, max: 1.4, step: 0.01 }
      ],
      defaults: {
        type: "pedestrian",
        body_height: 1.74,
        shoulder_width: 0.46,
        torso_depth: 0.24,
        hip_width: 0.36,
        head_scale: 1,
        pose: objectPose
      }
    },
    {
      type: "traffic_cone",
      label: "Traffic Cone",
      parameters: [
        { name: "base_diameter", label: "base diameter", group: "Cone", min: 0.2, max: 0.8, step: 0.01 },
        { name: "top_diameter", label: "top diameter", group: "Cone", min: 0.03, max: 0.2, step: 0.01 },
        { name: "cone_height", label: "cone height", group: "Cone", min: 0.2, max: 1.1, step: 0.01 }
      ],
      defaults: {
        type: "traffic_cone",
        base_diameter: 0.38,
        top_diameter: 0.07,
        cone_height: 0.72,
        pose: objectPose
      }
    },
    {
      type: "custom_points",
      label: "Custom Points",
      parameters: [],
      defaults: customDefaults
    }
  ],
  distortion_models: ["radtan", "fisheye"],
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
      show_labels: true,
      show_axes: true
    }
  }
};

function makeEvaluationPayload(objectType = "sedan") {
  return {
    object_type: objectType,
    projected_points: [
      {
        point_id: "front_bumper_center",
        world: { x: 0, y: 16.1, z: 0.72 },
        camera: { x: 0, y: -0.38, z: 20.2 },
        image: { x: 640, y: 340 },
        visible: true,
        inside_image: true
      },
      {
        point_id: "rear_bumper_center",
        world: { x: 0, y: 11.9, z: 0.72 },
        camera: { x: 0, y: -0.15, z: 16.1 },
        image: { x: 640, y: 354 },
        visible: true,
        inside_image: true
      },
      {
        point_id: "roof_center",
        world: { x: 0, y: 14, z: 1.35 },
        camera: { x: 0, y: -0.88, z: 18.05 },
        image: { x: 640, y: 314 },
        visible: true,
        inside_image: true
      },
      {
        point_id: "front_left_wheel_center",
        world: { x: -0.72, y: 15.35, z: 0.33 },
        camera: { x: -0.72, y: 0.05, z: 19.4 },
        image: { x: 603, y: 363 },
        visible: true,
        inside_image: true
      },
      {
        point_id: "front_right_wheel_center",
        world: { x: 0.72, y: 15.35, z: 0.33 },
        camera: { x: 0.72, y: 0.05, z: 19.4 },
        image: { x: 677, y: 363 },
        visible: true,
        inside_image: true
      }
    ],
    edges: [],
    faces: [],
    center: {
      point_id: "object_center",
      world: { x: 0, y: 14, z: 0.75 },
      camera: { x: 0, y: -0.62, z: 18.01 },
      image: { x: 640, y: 326.83 },
      visible: true,
      inside_image: true
    },
    bbox: {
      min_x: 586,
      max_x: 694,
      min_y: 281,
      max_y: 377,
      width: 108,
      height: 96,
      inside_image: true,
      intersects_image: true
    },
    principal_point: { x: 640, y: 360 },
    analysis: {
      pixel_width: 108,
      pixel_height: 96,
      coverage_ratio: 0.012,
      visible_point_count: 5,
      hidden_point_count: 0,
      center_inside_image: true,
      bbox_intersects_image: true,
      bbox_inside_image: true
    },
    display_mesh: {
      vertices: [
        { x: -0.9, y: 11.8, z: 0.28 },
        { x: 0.9, y: 11.8, z: 0.28 },
        { x: 0.9, y: 16.2, z: 0.28 },
        { x: -0.9, y: 16.2, z: 0.28 },
        { x: -0.72, y: 12.65, z: 1.32 },
        { x: 0.72, y: 12.65, z: 1.32 },
        { x: 0.72, y: 15.25, z: 1.32 },
        { x: -0.72, y: 15.25, z: 1.32 }
      ],
      faces: [
        { vertex_indices: [0, 1, 2], label: "body" },
        { vertex_indices: [0, 2, 3], label: "body" },
        { vertex_indices: [4, 5, 6], label: "roof" },
        { vertex_indices: [4, 6, 7], label: "roof" },
        { vertex_indices: [0, 1, 5], label: "side" },
        { vertex_indices: [0, 5, 4], label: "side" }
      ]
    },
    silhouette: [
      {
        points: [
          { x: 592, y: 376 },
          { x: 587, y: 312 },
          { x: 640, y: 282 },
          { x: 693, y: 312 },
          { x: 688, y: 376 }
        ]
      }
    ]
  };
}

function mockElementRect(
  element: Element,
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  }
): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => rect
    })
  });
}

describe("App", () => {
  beforeEach(() => {
    persistenceMock.loadPersistedInputState.mockResolvedValue({ request: null, overlayUrl: null });
    persistenceMock.loadPersistedLayout.mockReturnValue(null);
    persistenceMock.resolvePersistedRequest.mockImplementation((_: unknown, rawRequest: unknown) =>
      rawRequest ?? null
    );
    persistenceMock.savePersistedRequest.mockClear();
    persistenceMock.savePersistedLayout.mockClear();
    persistenceMock.savePersistedOverlayUrl.mockClear();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1440
    });
    if (!("PointerEvent" in window)) {
      Object.defineProperty(window, "PointerEvent", {
        configurable: true,
        value: MouseEvent
      });
    }
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/schema")) {
        return {
          ok: true,
          json: async () => schemaPayload
        } as Response;
      }
      if (url.endsWith("/api/projection/evaluate")) {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        return {
          ok: true,
          json: async () => makeEvaluationPayload(body?.object_spec?.type ?? "sedan")
        } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders grouped controls and does not recompute for display-only changes", async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole("heading", { name: /camera intrinsics/i });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    await user.click(screen.getByLabelText(/show bbox/i));
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText(/show distorted/i)).toBeNull();
    expect(screen.queryByLabelText(/show undistorted/i)).toBeNull();
  });

  it("shows the renamed distortion model labels", async () => {
    render(<App />);

    await screen.findByLabelText(/model/i);

    expect(screen.getByRole("option", { name: "Standard (RadTan)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Fisheye" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "opencv" })).toBeNull();
  });

  it("restores persisted request, layout, and overlay, then recomputes from restored inputs", async () => {
    const persistedRequest = {
      ...schemaPayload.defaults,
      camera_intrinsics: {
        ...schemaPayload.defaults.camera_intrinsics,
        fx: 1024
      },
      object_spec: {
        ...schemaPayload.object_types.find((item) => item.type === "bicycle")!.defaults,
        pose: {
          ...objectPose,
          x: 1.2
        }
      }
    };

    persistenceMock.loadPersistedLayout.mockReturnValue({
      panelWidth: 420,
      sceneHeight: 380,
      imageWidth: 720
    });
    persistenceMock.loadPersistedInputState.mockResolvedValue({
      request: persistedRequest,
      overlayUrl: "data:image/png;base64,AAAA"
    });

    render(<App />);

    await screen.findByDisplayValue("1024");
    await screen.findByLabelText(/wheel diameter/i);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const shell = document.querySelector(".app-shell");
    expect(shell).not.toBeNull();
    expect((shell as HTMLElement).style.gridTemplateColumns).toBe("420px 12px minmax(0, 1fr)");

    const overlayImage = document.querySelector("image[href='data:image/png;base64,AAAA']");
    expect(overlayImage).not.toBeNull();

    const evaluateCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(evaluateCall).toBeDefined();
    const evaluateBody = JSON.parse(String(evaluateCall[1]?.body));
    expect(evaluateBody.camera_intrinsics.fx).toBe(1024);
    expect(evaluateBody.object_spec.type).toBe("bicycle");
    expect(evaluateBody.object_spec.pose.x).toBe(1.2);
  });

  it("resets request, layout, and overlay back to defaults", async () => {
    const user = userEvent.setup();
    const persistedRequest = {
      ...schemaPayload.defaults,
      camera_intrinsics: {
        ...schemaPayload.defaults.camera_intrinsics,
        fx: 1024
      },
      object_spec: {
        ...schemaPayload.object_types.find((item) => item.type === "bicycle")!.defaults,
        pose: {
          ...objectPose,
          x: 1.2
        }
      }
    };

    persistenceMock.loadPersistedLayout.mockReturnValue({
      panelWidth: 420,
      sceneHeight: 380,
      imageWidth: 720
    });
    persistenceMock.loadPersistedInputState.mockResolvedValue({
      request: persistedRequest,
      overlayUrl: "data:image/png;base64,AAAA"
    });

    render(<App />);

    await screen.findByDisplayValue("1024");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("button", { name: /reset to defaults/i }));

    await screen.findByDisplayValue("1567.36");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));

    const shell = document.querySelector(".app-shell");
    expect(shell).not.toBeNull();
    expect((shell as HTMLElement).style.gridTemplateColumns).toBe("360px 12px minmax(0, 1fr)");

    const overlayImage = document.querySelector("image[href='data:image/png;base64,AAAA']");
    expect(overlayImage).toBeNull();

    const evaluateCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[2];
    expect(evaluateCall).toBeDefined();
    const evaluateBody = JSON.parse(String(evaluateCall[1]?.body));
    expect(evaluateBody.camera_intrinsics.fx).toBe(1567.36);
    expect(evaluateBody.camera_intrinsics.image_width).toBe(1920);
    expect(evaluateBody.object_spec.type).toBe("sedan");
    expect(persistenceMock.savePersistedOverlayUrl).toHaveBeenLastCalledWith(null);
  });

  it("renders schema-driven object controls and switches parameter sets by object type", async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByLabelText(/hood length/i);
    expect(screen.getByLabelText(/wheelbase/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^type$/i), "bicycle");

    await screen.findByLabelText(/wheel diameter/i);
    expect(screen.queryByLabelText(/hood length/i)).not.toBeInTheDocument();
  });

  it("removes ground and distortion auxiliary views from the main workspace", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: /3d scene view/i });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    expect(screen.getByRole("heading", { name: /image projection view/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /debug info/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /ground top view/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /distortion compare view/i })
    ).not.toBeInTheDocument();
  });

  it("renders a compact top toolbar instead of a multiline hero title", async () => {
    render(<App />);

    await screen.findByText(/spatial camera-object inspection/i);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    expect(screen.getByLabelText(/workspace status/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("pins the toolbar row instead of letting the main grid stretch it", async () => {
    render(<App />);

    await screen.findByText(/spatial camera-object inspection/i);

    const mainContent = document.querySelector(".main-content");
    expect(mainContent).not.toBeNull();

    expect(mainContent).toHaveStyle({
      gridTemplateRows: "auto minmax(0, 1fr)",
      alignContent: "start"
    });
  });

  it("keeps the desktop shell fixed so the parameter panel scrolls internally", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: /camera intrinsics/i });

    const shell = document.querySelector(".app-shell");
    const panel = document.querySelector(".panel");
    const mainContent = document.querySelector(".main-content");
    expect(shell).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(mainContent).not.toBeNull();

    expect(shell).toHaveStyle({
      height: "100vh",
      overflow: "hidden"
    });
    expect(panel).toHaveStyle({
      height: "100vh",
      overflowY: "auto"
    });
    expect(mainContent).toHaveStyle({
      height: "100vh",
      overflow: "hidden"
    });
  });

  it("packs the 3d row and lower row together instead of stretching the workspace gap", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: /3d scene view/i });

    const workspaceStack = document.querySelector(".workspace-stack");
    expect(workspaceStack).not.toBeNull();

    expect(workspaceStack).toHaveStyle({
      alignContent: "start"
    });
    expect(workspaceStack).not.toHaveStyle({ alignItems: "start" });
  });

  it("renders a full-width shallow ground plane and solid silhouettes in the image view", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: /image projection view/i });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.querySelector(".ground-plane")).not.toBeNull());
    await waitFor(() => expect(document.querySelector(".object-silhouette")).not.toBeNull());
    expect(document.querySelector(".object-silhouette-undistorted")).toBeNull();
    expect(document.querySelector(".object-silhouette-distorted")).toBeNull();
    expect(document.querySelector(".point-label")).toBeNull();

    const gradientStops = document.querySelectorAll("#imageGroundGradient stop");
    expect(gradientStops).toHaveLength(2);
    expect(gradientStops[0]).toHaveAttribute("stop-color", "#e8ecef");
    expect(gradientStops[1]).toHaveAttribute("stop-color", "#cfd7de");
  });

  it("renders the image viewport on a white matte with a more sky-like sensor backdrop", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: /image projection view/i });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const imageViewportShell = document.querySelector(".image-viewport-shell");
    expect(imageViewportShell).not.toBeNull();
    expect(getComputedStyle(imageViewportShell as Element).backgroundColor).toBe(
      "rgb(255, 255, 255)"
    );

    const skyStops = document.querySelectorAll("#imageSkyGradient stop");
    expect(skyStops).toHaveLength(3);
    expect(skyStops[0]).toHaveAttribute("stop-color", "#8fc6f5");
    expect(skyStops[1]).toHaveAttribute("stop-color", "#d8edff");
    expect(skyStops[2]).toHaveAttribute("stop-color", "#f7fbff");
    expect(document.querySelector(".image-sky-glow")).not.toBeNull();
  });

  it("renders desktop separators for all three resizable splits", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: /3d scene view/i });

    expect(
      screen.getByRole("separator", { name: /resize parameter panel/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: /resize scene and analysis panels/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: /resize image and debug panels/i })
    ).toBeInTheDocument();
  });

  it("updates the parameter panel width when dragging the sidebar separator", async () => {
    render(<App />);

    await screen.findByRole("separator", { name: /resize parameter panel/i });

    const shell = document.querySelector(".app-shell");
    expect(shell).not.toBeNull();
    mockElementRect(shell as Element, { left: 0, top: 0, width: 1500, height: 1000 });

    fireEvent.pointerDown(screen.getByRole("separator", { name: /resize parameter panel/i }), {
      button: 0,
      clientX: 360,
      clientY: 0
    });
    fireEvent.pointerMove(window, { clientX: 420, clientY: 0 });
    fireEvent.pointerUp(window, { clientX: 420, clientY: 0 });

    expect((shell as HTMLElement).style.gridTemplateColumns).toBe("420px 12px minmax(0, 1fr)");
  });

  it("updates the 3d scene height when dragging the horizontal workspace separator", async () => {
    render(<App />);

    await screen.findByRole("separator", { name: /resize scene and analysis panels/i });

    const stack = document.querySelector(".workspace-stack");
    expect(stack).not.toBeNull();
    mockElementRect(stack as Element, { left: 0, top: 100, width: 1000, height: 900 });

    fireEvent.pointerDown(
      screen.getByRole("separator", { name: /resize scene and analysis panels/i }),
      {
        button: 0,
        clientX: 0,
        clientY: 560
      }
    );
    fireEvent.pointerMove(window, { clientX: 0, clientY: 480 });
    fireEvent.pointerUp(window, { clientX: 0, clientY: 480 });

    expect((stack as HTMLElement).style.gridTemplateRows).toBe("380px 12px minmax(0, 1fr)");
  });

  it("updates the image projection width when dragging the lower vertical separator", async () => {
    render(<App />);

    await screen.findByRole("separator", { name: /resize image and debug panels/i });

    const secondary = document.querySelector(".workspace-secondary");
    expect(secondary).not.toBeNull();
    mockElementRect(secondary as Element, { left: 0, top: 0, width: 1200, height: 320 });

    fireEvent.pointerDown(
      screen.getByRole("separator", { name: /resize image and debug panels/i }),
      {
        button: 0,
        clientX: 940,
        clientY: 0
      }
    );
    fireEvent.pointerMove(window, { clientX: 720, clientY: 0 });
    fireEvent.pointerUp(window, { clientX: 720, clientY: 0 });

    expect((secondary as HTMLElement).style.gridTemplateColumns).toBe(
      "720px 12px minmax(300px, 1fr)"
    );
  });

  it("recomputes after geometry-affecting numeric input blur", async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", { name: /camera intrinsics/i });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const fxInput = screen.getByLabelText(/^fx$/i);
    await user.clear(fxInput);
    await user.type(fxInput, "1024");
    await user.tab();

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  });
});
