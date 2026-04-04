import { useMemo, type JSX } from "react";

import { useAppStore } from "../store/useAppStore";
import { type Point2D, type ProjectionRequest, type ProjectionResult } from "../types";
import { buildGroundProjectionSegments, buildGroundProjectionSurface } from "../lib/projectionMath";

interface ImageProjectionViewProps {
  request: ProjectionRequest;
  projection: ProjectionResult | null;
}

function imagePointForDisplay(point: {
  distorted_image: Point2D | null;
  undistorted_image: Point2D | null;
}, request: ProjectionRequest): Point2D | null {
  if (request.display_options.show_distorted) {
    return point.distorted_image;
  }
  if (request.display_options.show_undistorted) {
    return point.undistorted_image;
  }
  return point.distorted_image ?? point.undistorted_image;
}

function renderPoint(
  point: Point2D | null,
  pointId: string,
  className: string,
  request: ProjectionRequest,
  showLabels: boolean,
  onHover: (pointId: string | null) => void,
  onSelect: (pointId: string | null) => void
): JSX.Element | null {
  if (!point) {
    return null;
  }
  return (
    <g key={`${className}-${pointId}`}>
      <circle
        cx={point.x}
        cy={point.y}
        r={6}
        className={className}
        onMouseEnter={() => onHover(pointId)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onSelect(pointId)}
      />
      {showLabels && (
        <text x={point.x + 10} y={point.y - 10} className="point-label">
          {pointId}
        </text>
      )}
    </g>
  );
}

export function ImageProjectionView({
  request,
  projection
}: ImageProjectionViewProps): JSX.Element {
  const hoveredPointId = useAppStore((state) => state.hoveredPointId);
  const selectedPointId = useAppStore((state) => state.selectedPointId);
  const overlayUrl = useAppStore((state) => state.overlayUrl);
  const setHoveredPointId = useAppStore((state) => state.setHoveredPointId);
  const setSelectedPointId = useAppStore((state) => state.setSelectedPointId);
  const activeId = hoveredPointId ?? selectedPointId;
  const groundProjectionSurface = useMemo(
    () => buildGroundProjectionSurface(request, projection),
    [projection, request]
  );
  const groundProjectionSegments = useMemo(
    () => buildGroundProjectionSegments(request, projection),
    [projection, request]
  );
  const groundPlanePoints = useMemo(() => {
    const points = groundProjectionSurface
      .map((corner) => imagePointForDisplay(corner, request))
      .filter((point): point is Point2D => point !== null);
    return points.length === 4 ? points.map((point) => `${point.x},${point.y}`).join(" ") : null;
  }, [groundProjectionSurface, request]);
  const farGroundEdge = useMemo(() => {
    const farLeft = groundProjectionSurface[0];
    const farRight = groundProjectionSurface[1];
    if (!farLeft || !farRight) {
      return null;
    }
    const start = imagePointForDisplay(farLeft, request);
    const end = imagePointForDisplay(farRight, request);
    return start && end ? { start, end } : null;
  }, [groundProjectionSurface, request]);

  return (
    <section className="view-card image-view-card">
      <header className="view-header">
        <h2>Image Projection View</h2>
      </header>
      <div className="image-viewport-shell" style={{ backgroundColor: "#fff" }}>
        <svg
          className="image-viewport"
          viewBox={`0 0 ${request.camera_intrinsics.image_width} ${request.camera_intrinsics.image_height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Image projection view"
        >
          <defs>
            <linearGradient id="imageSkyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#9ed0f6" />
              <stop offset="58%" stopColor="#dff0ff" />
              <stop offset="100%" stopColor="#f8fbff" />
            </linearGradient>
            <radialGradient id="imageSkyGlow" cx="22%" cy="10%" r="68%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.72)" />
              <stop offset="54%" stopColor="rgba(255, 255, 255, 0.18)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            </radialGradient>
            <linearGradient id="imageGroundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d9e0e6" />
              <stop offset="100%" stopColor="#bcc7cf" />
            </linearGradient>
            <radialGradient id="imageVignette" cx="50%" cy="42%" r="75%">
              <stop offset="60%" stopColor="rgba(0, 0, 0, 0)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0.16)" />
            </radialGradient>
          </defs>
          <rect
            x={0}
            y={0}
            width={request.camera_intrinsics.image_width}
            height={request.camera_intrinsics.image_height}
            className="image-sensor-bg"
          />
          <rect
            x={0}
            y={0}
            width={request.camera_intrinsics.image_width}
            height={request.camera_intrinsics.image_height}
            className="image-sky-glow"
            fill="url(#imageSkyGlow)"
          />
          {groundPlanePoints && (
            <polygon
              points={groundPlanePoints}
              className="ground-plane"
              fill="url(#imageGroundGradient)"
            />
          )}
          {farGroundEdge && (
            <line
              x1={farGroundEdge.start.x}
              y1={farGroundEdge.start.y}
              x2={farGroundEdge.end.x}
              y2={farGroundEdge.end.y}
              className="ground-plane-edge"
            />
          )}
          {overlayUrl && (
            <image
              href={overlayUrl}
              x={0}
              y={0}
              width={request.camera_intrinsics.image_width}
              height={request.camera_intrinsics.image_height}
              preserveAspectRatio="xMidYMid meet"
              opacity={0.5}
            />
          )}
          {groundProjectionSegments.map((segment) => (
            <g key={`ground-edge-${segment.start_id}-${segment.end_id}`}>
              {request.display_options.show_undistorted &&
                segment.start.undistorted_image &&
                segment.end.undistorted_image && (
                  <line
                    x1={segment.start.undistorted_image.x}
                    y1={segment.start.undistorted_image.y}
                    x2={segment.end.undistorted_image.x}
                    y2={segment.end.undistorted_image.y}
                    className="ground-edge-line ground-edge-line-undistorted"
                  />
                )}
              {request.display_options.show_distorted &&
                segment.start.distorted_image &&
                segment.end.distorted_image && (
                  <line
                    x1={segment.start.distorted_image.x}
                    y1={segment.start.distorted_image.y}
                    x2={segment.end.distorted_image.x}
                    y2={segment.end.distorted_image.y}
                    className="ground-edge-line ground-edge-line-distorted"
                  />
                )}
            </g>
          ))}
          {request.display_options.show_bbox && projection && (
            <rect
              x={projection.bbox.min_x}
              y={projection.bbox.min_y}
              width={projection.bbox.width}
              height={projection.bbox.height}
              className="bbox-rect"
            />
          )}
          <circle
            cx={projection?.principal_point.x ?? request.camera_intrinsics.cx}
            cy={projection?.principal_point.y ?? request.camera_intrinsics.cy}
            r={5}
            className="principal-point"
          />
          {projection?.edges.map((edge) => {
            const start = projection.projected_points.find((point) => point.point_id === edge.start_id);
            const end = projection.projected_points.find((point) => point.point_id === edge.end_id);
            const startImage = request.display_options.show_distorted
              ? start?.distorted_image
              : start?.undistorted_image;
            const endImage = request.display_options.show_distorted
              ? end?.distorted_image
              : end?.undistorted_image;
            if (!startImage || !endImage) {
              return null;
            }
            return (
              <line
                key={`image-edge-${edge.start_id}-${edge.end_id}`}
                x1={startImage.x}
                y1={startImage.y}
                x2={endImage.x}
                y2={endImage.y}
                className="edge-line"
              />
            );
          })}
          {projection?.projected_points.map((point) => (
            <g key={point.point_id}>
              {request.display_options.show_undistorted &&
                renderPoint(
                  point.undistorted_image,
                  point.point_id,
                  point.point_id === activeId ? "image-point point-active-undistorted" : "image-point point-undistorted",
                  request,
                  request.display_options.show_labels,
                  setHoveredPointId,
                  setSelectedPointId
                )}
              {request.display_options.show_distorted &&
                renderPoint(
                  point.distorted_image,
                  point.point_id,
                  point.point_id === activeId ? "image-point point-active" : "image-point point-distorted",
                  request,
                  request.display_options.show_labels,
                  setHoveredPointId,
                  setSelectedPointId
                )}
            </g>
          ))}
          {projection?.center.distorted_image && (
            <circle
              cx={projection.center.distorted_image.x}
              cy={projection.center.distorted_image.y}
              r={7}
              className="center-point"
            />
          )}
          <rect
            x={1.5}
            y={1.5}
            width={request.camera_intrinsics.image_width - 3}
            height={request.camera_intrinsics.image_height - 3}
            className="image-frame"
          />
          <rect
            x={0}
            y={0}
            width={request.camera_intrinsics.image_width}
            height={request.camera_intrinsics.image_height}
            fill="url(#imageVignette)"
            className="image-vignette"
          />
        </svg>
      </div>
    </section>
  );
}
