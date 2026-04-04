import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import "./styles.css";

const schemaPayload = {
  object_types: ["box", "rectangle", "custom_points"],
  distortion_models: ["opencv", "fisheye"],
  defaults: {
    camera_intrinsics: {
      fx: 960,
      fy: 960,
      cx: 640,
      cy: 360,
      image_width: 1280,
      image_height: 720
    },
    distortion: {
      model: "opencv",
      k1: 0,
      k2: 0,
      p1: 0,
      p2: 0,
      k3: 0,
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
      type: "box",
      width: 1.8,
      length: 4.4,
      height: 1.5,
      pose: {
        x: 0,
        y: 14,
        z: 0,
        yaw: 0,
        pitch: 0,
        roll: 0
      }
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

const evaluationPayload = {
  projected_points: [
    {
      point_id: "p0",
      world: { x: -1, y: 12, z: 0 },
      camera: { x: -1, y: 0.2, z: 12 },
      undistorted_image: { x: 560, y: 376 },
      distorted_image: { x: 561, y: 377 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    },
    {
      point_id: "p1",
      world: { x: 1, y: 12, z: 0 },
      camera: { x: 1, y: 0.2, z: 12 },
      undistorted_image: { x: 720, y: 376 },
      distorted_image: { x: 719, y: 377 },
      visible: true,
      inside_image: true,
      inside_image_undistorted: true
    }
  ],
  edges: [{ start_id: "p0", end_id: "p1" }],
  faces: [],
  center: {
    point_id: "object_center",
    world: { x: 0, y: 12, z: 0.75 },
    camera: { x: 0, y: 0.1, z: 12 },
    undistorted_image: { x: 640, y: 368 },
    distorted_image: { x: 640, y: 369 },
    visible: true,
    inside_image: true,
    inside_image_undistorted: true
  },
  bbox: {
    min_x: 561,
    max_x: 719,
    min_y: 377,
    max_y: 377,
    width: 158,
    height: 0,
    inside_image: true,
    intersects_image: true
  },
  undistorted_bbox: {
    min_x: 560,
    max_x: 720,
    min_y: 376,
    max_y: 376,
    width: 160,
    height: 0,
    inside_image: true,
    intersects_image: true
  },
  principal_point: { x: 640, y: 360 },
  analysis: {
    pixel_width: 158,
    pixel_height: 0,
    coverage_ratio: 0,
    distortion_mean_offset_px: 1,
    distortion_max_offset_px: 1,
    visible_point_count: 2,
    hidden_point_count: 0,
    center_inside_image: true,
    bbox_intersects_image: true,
    bbox_inside_image: true
  }
};

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
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/schema")) {
        return {
          ok: true,
          json: async () => schemaPayload
        } as Response;
      }
      if (url.endsWith("/api/projection/evaluate")) {
        return {
          ok: true,
          json: async () => evaluationPayload
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

  it("renders a grounded image-plane backdrop in the image projection view", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: /image projection view/i });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(document.querySelector(".ground-plane")).not.toBeNull()
    );
    expect(document.querySelector(".image-sensor-bg")).not.toBeNull();

    const gradientStops = document.querySelectorAll("#imageGroundGradient stop");
    expect(gradientStops).toHaveLength(2);
    expect(gradientStops[0]).toHaveAttribute("stop-color", "#d9e0e6");
    expect(gradientStops[1]).toHaveAttribute("stop-color", "#bcc7cf");
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
    expect(skyStops[0]).toHaveAttribute("stop-color", "#9ed0f6");
    expect(skyStops[1]).toHaveAttribute("stop-color", "#dff0ff");
    expect(skyStops[2]).toHaveAttribute("stop-color", "#f8fbff");
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
