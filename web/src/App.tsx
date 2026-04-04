import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from "react";

import { DebugPanel } from "./components/DebugPanel";
import { ImageProjectionView } from "./components/ImageProjectionView";
import { ParameterPanel } from "./components/ParameterPanel";
import { Scene3DView } from "./components/Scene3DView";
import { evaluateProjection, fetchSchema } from "./lib/api";
import {
  loadPersistedInputState,
  loadPersistedLayout,
  resolvePersistedRequest,
  savePersistedLayout,
  savePersistedOverlayUrl,
  savePersistedRequest,
  type PersistedLayoutState
} from "./lib/persistence";
import { useAppStore } from "./store/useAppStore";

const DESKTOP_BREAKPOINT = 1100;
const SPLITTER_SIZE = 12;
const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 520;
const MAIN_MIN_WIDTH = 720;
const SCENE_MIN_HEIGHT = 320;
const SCENE_MAX_HEIGHT = 720;
const LOWER_MIN_HEIGHT = 280;
const IMAGE_MIN_WIDTH = 420;
const DEBUG_MIN_WIDTH = 300;

const mainContentLayoutStyle = {
  gridTemplateRows: "auto minmax(0, 1fr)",
  alignContent: "start"
} satisfies CSSProperties;

const workspaceStackBaseStyle = {
  alignContent: "start"
} satisfies CSSProperties;

type DragTarget = "panel" | "scene" | "image";

interface LayoutState {
  panelWidth: number;
  sceneHeight: number;
  imageWidth: number;
}

const DEFAULT_LAYOUT: PersistedLayoutState = {
  panelWidth: 360,
  sceneHeight: 440,
  imageWidth: 940
};

interface ResizeHandleProps {
  label: string;
  orientation: "horizontal" | "vertical";
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function maxPanelWidth(shellWidth: number): number {
  return Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, shellWidth - MAIN_MIN_WIDTH - SPLITTER_SIZE));
}

function maxSceneHeight(stackHeight: number): number {
  return Math.max(
    SCENE_MIN_HEIGHT,
    Math.min(SCENE_MAX_HEIGHT, stackHeight - LOWER_MIN_HEIGHT - SPLITTER_SIZE)
  );
}

function maxImageWidth(secondaryWidth: number): number {
  return Math.max(IMAGE_MIN_WIDTH, secondaryWidth - DEBUG_MIN_WIDTH - SPLITTER_SIZE);
}

function ResizeHandle({
  label,
  orientation,
  onPointerDown
}: ResizeHandleProps): JSX.Element {
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      className={`resize-handle resize-handle-${orientation}`}
      onPointerDown={onPointerDown}
    />
  );
}

function useSchemaBootstrap(): void {
  const initializeFromSchema = useAppStore((state) => state.initializeFromSchema);
  const setError = useAppStore((state) => state.setError);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [schema, persistedInput] = await Promise.all([
          fetchSchema(),
          loadPersistedInputState()
        ]);
        if (!active) {
          return;
        }
        const restoredRequest = resolvePersistedRequest(schema, persistedInput.request);
        startTransition(() =>
          initializeFromSchema(schema, {
            request: restoredRequest,
            overlayUrl: persistedInput.overlayUrl
          })
        );
      } catch (error: unknown) {
        if (!active) {
          return;
        }
        setError(error instanceof Error ? error.message : "Failed to load schema");
      }
    })();

    return () => {
      active = false;
    };
  }, [initializeFromSchema, setError]);
}

function useProjectionRefresh(): void {
  const geometryRevision = useAppStore((state) => state.geometryRevision);
  const setLoading = useAppStore((state) => state.setLoading);
  const setProjection = useAppStore((state) => state.setProjection);
  const setError = useAppStore((state) => state.setError);

  useEffect(() => {
    if (geometryRevision === 0) {
      return;
    }
    const request = useAppStore.getState().request;
    if (!request) {
      return;
    }
    setLoading(true);
    setError(null);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void evaluateProjection(useAppStore.getState().request ?? request)
        .then((projection) => {
          if (cancelled) {
            return;
          }
          startTransition(() => setProjection(projection));
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          setError(error instanceof Error ? error.message : "Projection request failed");
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [geometryRevision, setError, setLoading, setProjection]);
}

export default function App(): JSX.Element {
  useSchemaBootstrap();
  useProjectionRefresh();

  const shellRef = useRef<HTMLDivElement>(null);
  const workspaceStackRef = useRef<HTMLElement>(null);
  const workspaceSecondaryRef = useRef<HTMLDivElement>(null);
  const dragTargetRef = useRef<DragTarget | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [layout, setLayout] = useState<LayoutState>(() => loadPersistedLayout() ?? DEFAULT_LAYOUT);
  const request = useAppStore((state) => state.request);
  const projection = useDeferredValue(useAppStore((state) => state.projection));
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const overlayUrl = useAppStore((state) => state.overlayUrl);
  const isDesktopLayout = viewportWidth > DESKTOP_BREAKPOINT;

  const stopDragging = useEffectEvent(() => {
    dragTargetRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  const clampLayoutToViewport = useEffectEvent(() => {
    if (!isDesktopLayout) {
      return;
    }

    const shellWidth = shellRef.current?.getBoundingClientRect().width ?? 0;
    const stackHeight = workspaceStackRef.current?.getBoundingClientRect().height ?? 0;
    const secondaryWidth = workspaceSecondaryRef.current?.getBoundingClientRect().width ?? 0;

    setLayout((current) => {
      const nextPanelWidth =
        shellWidth > 0
          ? Math.round(clamp(current.panelWidth, PANEL_MIN_WIDTH, maxPanelWidth(shellWidth)))
          : current.panelWidth;
      const nextSceneHeight =
        stackHeight > 0
          ? Math.round(clamp(current.sceneHeight, SCENE_MIN_HEIGHT, maxSceneHeight(stackHeight)))
          : current.sceneHeight;
      const nextImageWidth =
        secondaryWidth > 0
          ? Math.round(clamp(current.imageWidth, IMAGE_MIN_WIDTH, maxImageWidth(secondaryWidth)))
          : current.imageWidth;

      if (
        nextPanelWidth === current.panelWidth &&
        nextSceneHeight === current.sceneHeight &&
        nextImageWidth === current.imageWidth
      ) {
        return current;
      }

      return {
        panelWidth: nextPanelWidth,
        sceneHeight: nextSceneHeight,
        imageWidth: nextImageWidth
      };
    });
  });

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    if (!isDesktopLayout) {
      return;
    }

    const dragTarget = dragTargetRef.current;
    if (!dragTarget) {
      return;
    }

    if (dragTarget === "panel") {
      const shellRect = shellRef.current?.getBoundingClientRect();
      if (!shellRect) {
        return;
      }
      const nextWidth = Math.round(
        clamp(event.clientX - shellRect.left, PANEL_MIN_WIDTH, maxPanelWidth(shellRect.width))
      );
      setLayout((current) =>
        current.panelWidth === nextWidth ? current : { ...current, panelWidth: nextWidth }
      );
      return;
    }

    if (dragTarget === "scene") {
      const stackRect = workspaceStackRef.current?.getBoundingClientRect();
      if (!stackRect) {
        return;
      }
      const nextHeight = Math.round(
        clamp(event.clientY - stackRect.top, SCENE_MIN_HEIGHT, maxSceneHeight(stackRect.height))
      );
      setLayout((current) =>
        current.sceneHeight === nextHeight ? current : { ...current, sceneHeight: nextHeight }
      );
      return;
    }

    const secondaryRect = workspaceSecondaryRef.current?.getBoundingClientRect();
    if (!secondaryRect) {
      return;
    }
    const nextWidth = Math.round(
      clamp(event.clientX - secondaryRect.left, IMAGE_MIN_WIDTH, maxImageWidth(secondaryRect.width))
    );
    setLayout((current) =>
      current.imageWidth === nextWidth ? current : { ...current, imageWidth: nextWidth }
    );
  });

  useEffect(() => {
    const handleResize = (): void => {
      setViewportWidth(window.innerWidth);
      if (window.innerWidth <= DESKTOP_BREAKPOINT) {
        stopDragging();
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [stopDragging]);

  useEffect(() => {
    if (!isDesktopLayout) {
      return;
    }
    const frame = window.requestAnimationFrame(() => clampLayoutToViewport());
    return () => window.cancelAnimationFrame(frame);
  }, [clampLayoutToViewport, isDesktopLayout]);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
      stopDragging();
    };
  }, [handlePointerMove, stopDragging]);

  useEffect(() => {
    if (!request) {
      return;
    }
    savePersistedRequest(request);
  }, [request]);

  useEffect(() => {
    savePersistedLayout(layout);
  }, [layout]);

  useEffect(() => {
    void savePersistedOverlayUrl(overlayUrl);
  }, [overlayUrl]);

  const startDragging = (dragTarget: DragTarget, cursor: "col-resize" | "row-resize") =>
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (!isDesktopLayout || event.button !== 0) {
        return;
      }
      event.preventDefault();
      dragTargetRef.current = dragTarget;
      document.body.style.cursor = cursor;
      document.body.style.userSelect = "none";
    };

  if (!request) {
    return <div className="loading-screen">Loading configuration…</div>;
  }

  const shellLayoutStyle = isDesktopLayout
    ? ({
        gridTemplateColumns: `${layout.panelWidth}px ${SPLITTER_SIZE}px minmax(0, 1fr)`,
        height: "100vh",
        overflow: "hidden"
      } satisfies CSSProperties)
    : undefined;
  const panelLayoutStyle = isDesktopLayout
    ? ({
        height: "100vh",
        minHeight: 0,
        overflowY: "auto"
      } satisfies CSSProperties)
    : undefined;
  const mainContentStyle = isDesktopLayout
    ? ({
        ...mainContentLayoutStyle,
        height: "100vh",
        minHeight: 0,
        overflow: "hidden"
      } satisfies CSSProperties)
    : mainContentLayoutStyle;
  const workspaceStackLayoutStyle = isDesktopLayout
    ? ({
        ...workspaceStackBaseStyle,
        minHeight: 0,
        gridTemplateRows: `${layout.sceneHeight}px ${SPLITTER_SIZE}px minmax(0, 1fr)`,
        gap: 0
      } satisfies CSSProperties)
    : workspaceStackBaseStyle;
  const workspaceSecondaryLayoutStyle = isDesktopLayout
    ? ({
        gridTemplateColumns: `${layout.imageWidth}px ${SPLITTER_SIZE}px minmax(${DEBUG_MIN_WIDTH}px, 1fr)`,
        gap: 0
      } satisfies CSSProperties)
    : undefined;

  return (
    <div className="app-shell" ref={shellRef} style={shellLayoutStyle}>
      <ParameterPanel style={panelLayoutStyle} />
      {isDesktopLayout ? (
        <ResizeHandle
          label="Resize parameter panel"
          orientation="vertical"
          onPointerDown={startDragging("panel", "col-resize")}
        />
      ) : null}
      <main className="main-content" style={mainContentStyle}>
        <header className="workspace-toolbar">
          <p className="toolbar-title">Spatial camera-object inspection</p>
          <div className="status-block" aria-label="workspace status">
            {loading ? (
              <span className="status-pill">Computing…</span>
            ) : (
              <span className="status-pill status-pill-ready">Ready</span>
            )}
            {error ? <span className="error-text">{error}</span> : null}
          </div>
        </header>
        <section
          className="workspace-stack"
          aria-label="spatial workspace"
          ref={workspaceStackRef}
          style={workspaceStackLayoutStyle}
        >
          <div
            className={isDesktopLayout ? "workspace-primary workspace-primary-resizable" : "workspace-primary"}
          >
            <Scene3DView request={request} projection={projection} />
          </div>
          {isDesktopLayout ? (
            <ResizeHandle
              label="Resize scene and analysis panels"
              orientation="horizontal"
              onPointerDown={startDragging("scene", "row-resize")}
            />
          ) : null}
          <div
            className={
              isDesktopLayout
                ? "workspace-secondary workspace-secondary-resizable"
                : "workspace-secondary"
            }
            ref={workspaceSecondaryRef}
            style={workspaceSecondaryLayoutStyle}
          >
            <ImageProjectionView request={request} projection={projection} />
            {isDesktopLayout ? (
              <ResizeHandle
                label="Resize image and debug panels"
                orientation="vertical"
                onPointerDown={startDragging("image", "col-resize")}
              />
            ) : null}
            <DebugPanel projection={projection} />
          </div>
        </section>
      </main>
    </div>
  );
}
