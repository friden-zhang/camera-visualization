import type { JSX } from "react";

import { useAppStore } from "../store/useAppStore";
import { type ProjectionResult } from "../types";

interface DebugPanelProps {
  projection: ProjectionResult | null;
}

export function DebugPanel({ projection }: DebugPanelProps): JSX.Element {
  const selectedPointId = useAppStore((state) => state.selectedPointId);
  const setSelectedPointId = useAppStore((state) => state.setSelectedPointId);
  const selectedPoint =
    projection?.projected_points.find((point) => point.point_id === selectedPointId) ?? projection?.center ?? null;

  return (
    <section className="debug-panel">
      <header className="view-header">
        <h2>Debug Info</h2>
      </header>
      {projection ? (
        <div className="debug-grid">
          <div>
            <h3>Object</h3>
            <dl className="metric-list">
              <div><dt>Type</dt><dd>{projection.object_type}</dd></div>
              <div><dt>Mesh vertices</dt><dd>{projection.display_mesh.vertices.length}</dd></div>
              <div><dt>Mesh faces</dt><dd>{projection.display_mesh.faces.length}</dd></div>
              <div><dt>Silhouette contours</dt><dd>{projection.silhouette.distorted.length}</dd></div>
            </dl>
          </div>
          <div>
            <h3>Selected Point</h3>
            {selectedPoint ? (
              <dl className="metric-list">
                <div><dt>ID</dt><dd>{selectedPoint.point_id}</dd></div>
                <div><dt>World</dt><dd>{selectedPoint.world.x.toFixed(2)}, {selectedPoint.world.y.toFixed(2)}, {selectedPoint.world.z.toFixed(2)}</dd></div>
                <div><dt>Camera</dt><dd>{selectedPoint.camera.x.toFixed(2)}, {selectedPoint.camera.y.toFixed(2)}, {selectedPoint.camera.z.toFixed(2)}</dd></div>
                <div><dt>Image</dt><dd>{selectedPoint.distorted_image ? `${selectedPoint.distorted_image.x.toFixed(2)}, ${selectedPoint.distorted_image.y.toFixed(2)}` : selectedPoint.undistorted_image ? `${selectedPoint.undistorted_image.x.toFixed(2)}, ${selectedPoint.undistorted_image.y.toFixed(2)}` : "n/a"}</dd></div>
              </dl>
            ) : (
              <p>No point selected.</p>
            )}
          </div>
          <div>
            <h3>Analysis</h3>
            <dl className="metric-list">
              <div><dt>Pixel width</dt><dd>{projection.analysis.pixel_width.toFixed(2)}</dd></div>
              <div><dt>Pixel height</dt><dd>{projection.analysis.pixel_height.toFixed(2)}</dd></div>
              <div><dt>Coverage</dt><dd>{(projection.analysis.coverage_ratio * 100).toFixed(2)}%</dd></div>
              <div><dt>Visible points</dt><dd>{projection.analysis.visible_point_count}</dd></div>
              <div><dt>Distortion mean</dt><dd>{projection.analysis.distortion_mean_offset_px.toFixed(2)} px</dd></div>
            </dl>
          </div>
          <div>
            <h3>Points</h3>
            <ul className="point-list">
              {projection.projected_points.map((point) => (
                <li key={point.point_id}>
                  <button type="button" className="point-button" onClick={() => setSelectedPointId(point.point_id)}>
                    {point.point_id}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p>No projection result yet.</p>
      )}
    </section>
  );
}
