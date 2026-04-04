import { useMemo, type JSX } from "react";

import { useAppStore } from "../store/useAppStore";
import { type Contour2D, type Point2D, type ProjectionRequest, type ProjectionResult } from "../types";
import { buildGroundProjectionSegments, buildGroundProjectionSurface } from "../lib/projectionMath";

interface ImageProjectionViewProps {
  request: ProjectionRequest;
  projection: ProjectionResult | null;
}

const SILHOUETTE_CLASS_BY_TYPE: Record<string, string> = {
  sedan: "object-silhouette-sedan",
  truck: "object-silhouette-truck",
  bicycle: "object-silhouette-bicycle",
  pedestrian: "object-silhouette-pedestrian",
  traffic_cone: "object-silhouette-traffic-cone",
  custom_points: "object-silhouette-custom"
};

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

function contourPoints(contour: Contour2D): string | null {
  if (contour.points.length < 3) {
    return null;
  }
  return contour.points.map((point) => `${point.x},${point.y}`).join(" ");
}

function renderPoint(
  point: Point2D | null,
  pointId: string,
  className: string,
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
  const silhouetteClass = projection
    ? SILHOUETTE_CLASS_BY_TYPE[projection.object_type] ?? SILHOUETTE_CLASS_BY_TYPE.custom_points
    : SILHOUETTE_CLASS_BY_TYPE.custom_points;
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
  const distortedContours = projection?.silhouette.distorted ?? [];
  const undistortedContours = projection?.silhouette.undistorted ?? [];
  const centerPoint = projection ? imagePointForDisplay(projection.center, request) : null;
  const shouldRenderDebugEdges =
    projection?.object_type === "custom_points" ||
    (distortedContours.length === 0 && undistortedContours.length === 0);

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
              <stop offset="0%" stopColor="#8fc6f5" />
              <stop offset="55%" stopColor="#d8edff" />
              <stop offset="100%" stopColor="#f7fbff" />
            </linearGradient>
            <radialGradient id="imageSkyGlow" cx="22%" cy="10%" r="68%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.74)" />
              <stop offset="54%" stopColor="rgba(255, 255, 255, 0.2)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            </radialGradient>
            <linearGradient id="imageGroundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e8ecef" />
              <stop offset="100%" stopColor="#cfd7de" />
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
          {request.display_options.show_undistorted &&
            undistortedContours.map((contour, index) => {
              const points = contourPoints(contour);
              return points ? (
                <polygon
                  key={`undistorted-silhouette-${index}`}
                  points={points}
                  className={`object-silhouette object-silhouette-undistorted ${silhouetteClass}`}
                />
              ) : null;
            })}
          {request.display_options.show_distorted &&
            distortedContours.map((contour, index) => {
              const points = contourPoints(contour);
              return points ? (
                <polygon
                  key={`distorted-silhouette-${index}`}
                  points={points}
                  className={`object-silhouette object-silhouette-distorted ${silhouetteClass}`}
                />
              ) : null;
            })}
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
          {shouldRenderDebugEdges &&
            projection?.edges.map((edge) => {
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
                  setHoveredPointId,
                  setSelectedPointId
                )}
              {request.display_options.show_distorted &&
                renderPoint(
                  point.distorted_image,
                  point.point_id,
                  point.point_id === activeId ? "image-point point-active" : "image-point point-distorted",
                  setHoveredPointId,
                  setSelectedPointId
                )}
            </g>
          ))}
          {centerPoint && (
            <circle
              cx={centerPoint.x}
              cy={centerPoint.y}
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
