import { useMemo, type JSX } from "react";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import { BufferGeometry, Float32BufferAttribute } from "three";

import { useAppStore } from "../store/useAppStore";
import { type ProjectionRequest, type ProjectionResult, type Vector3 } from "../types";
import {
  cameraBasis,
  clampWorldToGround,
  clipWorldSegmentToGround,
  frustumWorldPoints,
  projectedWorldDistance,
  type SceneVector,
  sceneFrame,
  worldToScene
} from "../lib/sceneMath";

interface Scene3DViewProps {
  request: ProjectionRequest;
  projection: ProjectionResult | null;
}

function buildSurfaceGeometry(projection: ProjectionResult | null): BufferGeometry | null {
  if (!projection) {
    return null;
  }

  const byId = new Map(projection.projected_points.map((point) => [point.point_id, point]));
  const vertices: number[] = [];

  for (const face of projection.faces) {
    if (face.point_ids.length < 3) {
      continue;
    }
    const anchor = byId.get(face.point_ids[0]);
    if (!anchor) {
      continue;
    }
    if (
      face.point_ids.every((pointId) => {
        const point = byId.get(pointId);
        return point ? point.world.z < 0 : true;
      })
    ) {
      continue;
    }
    for (let index = 1; index < face.point_ids.length - 1; index += 1) {
      const second = byId.get(face.point_ids[index]);
      const third = byId.get(face.point_ids[index + 1]);
      if (!second || !third) {
        continue;
      }
      vertices.push(
        ...worldToScene(clampWorldToGround(anchor.world)),
        ...worldToScene(clampWorldToGround(second.world)),
        ...worldToScene(clampWorldToGround(third.world))
      );
    }
  }

  if (vertices.length === 0) {
    return null;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function isSceneSegment(value: SceneVector[] | null): value is SceneVector[] {
  return value !== null;
}

function isWorldSegment(value: [Vector3, Vector3] | null): value is [Vector3, Vector3] {
  return value !== null;
}

function SceneContent({
  request,
  projection
}: Scene3DViewProps): JSX.Element {
  const hoveredPointId = useAppStore((state) => state.hoveredPointId);
  const selectedPointId = useAppStore((state) => state.selectedPointId);
  const setHoveredPointId = useAppStore((state) => state.setHoveredPointId);
  const setSelectedPointId = useAppStore((state) => state.setSelectedPointId);
  const activeId = hoveredPointId ?? selectedPointId;
  const frame = useMemo(() => sceneFrame(request, projection), [projection, request]);
  const cameraWorld = useMemo(
    () => ({
      x: request.camera_pose.x,
      y: request.camera_pose.y,
      z: request.camera_pose.z
    }),
    [request.camera_pose]
  );
  const cameraPosition = useMemo(() => worldToScene(clampWorldToGround(cameraWorld)), [cameraWorld]);
  const objectCenter = useMemo(
    () => {
      const worldCenter = projection?.center
        ? projection.center.world
        : {
            x: request.object_spec.pose.x,
            y: request.object_spec.pose.y,
            z: request.object_spec.pose.z
          };
      return worldToScene(clampWorldToGround(worldCenter));
    },
    [projection, request.object_spec.pose]
  );
  const frustumDepth = useMemo(
    () => projectedWorldDistance(request, projection),
    [projection, request]
  );
  const frustumLines = useMemo(() => {
    const cornerWorldPoints = frustumWorldPoints(request, frustumDepth).map(([x, y, z]) => ({ x, y, z }));
    const corners = cornerWorldPoints.map((corner) => worldToScene(clampWorldToGround(corner)));
    return {
      corners,
      cameraToCorners: cornerWorldPoints
        .map((corner) => clipWorldSegmentToGround(cameraWorld, corner))
        .filter(isWorldSegment)
        .map(([start, end]) => [worldToScene(start), worldToScene(end)] as SceneVector[])
    };
  }, [cameraWorld, frustumDepth, request]);
  const viewDirection = useMemo(() => {
    const basis = cameraBasis(request.camera_pose);
    const end = {
      x: request.camera_pose.x + basis.forward[0] * frustumDepth * 1.35,
      y: request.camera_pose.y + basis.forward[1] * frustumDepth * 1.35,
      z: request.camera_pose.z + basis.forward[2] * frustumDepth * 1.35
    };
    const segment = clipWorldSegmentToGround(cameraWorld, end);
    return segment
      ? ([worldToScene(segment[0]), worldToScene(segment[1])] as SceneVector[])
      : null;
  }, [cameraWorld, frustumDepth, request.camera_pose]);
  const surfaceGeometry = useMemo(() => buildSurfaceGeometry(projection), [projection]);
  const objectShadow = useMemo(() => {
    if (!projection) {
      return [] as SceneVector[][];
    }
    return projection.edges
      .map((edge) => {
        const start = projection.projected_points.find((point) => point.point_id === edge.start_id);
        const end = projection.projected_points.find((point) => point.point_id === edge.end_id);
        if (!start || !end) {
          return null;
        }
        return [
          worldToScene({ x: start.world.x, y: start.world.y, z: 0 }),
          worldToScene({ x: end.world.x, y: end.world.y, z: 0 })
        ];
      })
      .filter(isSceneSegment);
  }, [projection]);
  const objectLinks = useMemo(
    () =>
      projection?.edges
        .map((edge) => {
          const start = projection.projected_points.find((point) => point.point_id === edge.start_id);
          const end = projection.projected_points.find((point) => point.point_id === edge.end_id);
          if (!start || !end) {
            return null;
          }
          const segment = clipWorldSegmentToGround(start.world, end.world);
          return segment ? [worldToScene(segment[0]), worldToScene(segment[1])] : null;
        })
        .filter(isSceneSegment) ?? [],
    [projection]
  );
  const cameraToObjectLine = useMemo(() => {
    const worldCenter = projection?.center?.world ?? {
      x: request.object_spec.pose.x,
      y: request.object_spec.pose.y,
      z: request.object_spec.pose.z
    };
    const segment = clipWorldSegmentToGround(cameraWorld, worldCenter);
    return segment ? ([worldToScene(segment[0]), worldToScene(segment[1])] as SceneVector[]) : null;
  }, [cameraWorld, projection, request.object_spec.pose]);
  const visiblePoints = useMemo(
    () => projection?.projected_points.filter((point) => point.world.z >= 0) ?? [],
    [projection]
  );
  const orbitTarget = useMemo<SceneVector>(
    () => [frame.target[0], Math.max(frame.target[1], 0.35), frame.target[2]],
    [frame.target]
  );

  return (
    <>
      <color attach="background" args={["#f3f8f5"]} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[14, 18, 10]} intensity={1.35} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[frame.groundSize, frame.groundSize]} />
        <meshStandardMaterial color="#edf4ef" />
      </mesh>
      <gridHelper
        args={[frame.groundSize, Math.max(10, Math.round(frame.groundSize / 2)), "#93afa3", "#dbe7e0"]}
        position={[0, 0.02, 0]}
      />
      {request.display_options.show_axes && <axesHelper args={[3]} />}
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#102224" />
      </mesh>
      {cameraToObjectLine && <Line points={cameraToObjectLine} color="#ffb347" lineWidth={1.5} />}
      {request.display_options.show_frustum && (
        <>
          {viewDirection && <Line points={viewDirection} color="#d64545" lineWidth={2.5} />}
          {frustumLines.cameraToCorners.map((segment, index) => (
            <Line key={`camera-ray-${index}`} points={segment} color="#d64545" lineWidth={1.1} />
          ))}
          <Line points={[...frustumLines.corners, frustumLines.corners[0]]} color="#d64545" lineWidth={1.4} />
        </>
      )}
      {surfaceGeometry && (
        <mesh geometry={surfaceGeometry}>
          <meshStandardMaterial
            color="#57a89e"
            transparent
            opacity={0.18}
            depthWrite={false}
            side={2}
          />
        </mesh>
      )}
      {objectShadow.map((segment, index) => (
        <Line key={`shadow-${index}`} points={segment} color="#b7c7bf" lineWidth={1.2} />
      ))}
      {objectLinks.map((segment, index) => (
        <Line key={`scene-link-${index}`} points={segment} color="#2d5f5d" lineWidth={2.2} />
      ))}
      {visiblePoints.map((point) => (
        <mesh
          key={point.point_id}
          position={worldToScene(clampWorldToGround(point.world))}
          onPointerEnter={() => setHoveredPointId(point.point_id)}
          onPointerLeave={() => setHoveredPointId(null)}
          onClick={() => setSelectedPointId(point.point_id)}
        >
          <sphereGeometry args={[activeId === point.point_id ? 0.18 : 0.12, 16, 16]} />
          <meshStandardMaterial color={activeId === point.point_id ? "#d64545" : "#1f8f88"} />
        </mesh>
      ))}
      <mesh position={cameraPosition}>
        <sphereGeometry args={[0.23, 16, 16]} />
        <meshStandardMaterial color="#111c1c" />
      </mesh>
      <mesh position={objectCenter}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#ffb347" />
      </mesh>
      <mesh position={orbitTarget}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#6b7f7a" />
      </mesh>
      <OrbitControls makeDefault target={orbitTarget} maxPolarAngle={Math.PI / 2 - 0.08} />
    </>
  );
}

export function Scene3DView({ request, projection }: Scene3DViewProps): JSX.Element {
  if (import.meta.env.MODE === "test") {
    return (
      <section className="view-card">
        <header className="view-header">
          <h2>3D Scene View</h2>
        </header>
        <div className="scene-fallback">3D rendering is disabled in the test environment.</div>
      </section>
    );
  }

  return (
    <section className="view-card scene-view-card">
      <header className="view-header">
        <h2>3D Scene View</h2>
      </header>
      <div className="canvas-shell">
        <Canvas camera={{ position: sceneFrame(request, projection).orbitPosition, fov: 36 }}>
          <SceneContent request={request} projection={projection} />
        </Canvas>
      </div>
    </section>
  );
}
