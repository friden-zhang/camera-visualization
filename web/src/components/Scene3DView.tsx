import { useEffect, useMemo, useRef, type ElementRef, type JSX } from "react";

import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
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
import { cameraModelQuaternion } from "../lib/cameraModel";

interface Scene3DViewProps {
  request: ProjectionRequest;
  projection: ProjectionResult | null;
}

const OBJECT_COLORS: Record<string, { fill: string; wire: string }> = {
  sedan: { fill: "#3f7d84", wire: "#113c40" },
  truck: { fill: "#4e7e68", wire: "#19392f" },
  bicycle: { fill: "#8b5e3c", wire: "#4e3019" },
  pedestrian: { fill: "#8f6a87", wire: "#55394f" },
  traffic_cone: { fill: "#d67438", wire: "#73371a" },
  custom_points: { fill: "#57a89e", wire: "#214846" }
};

function buildDisplayMeshGeometry(projection: ProjectionResult | null): BufferGeometry | null {
  if (!projection || projection.display_mesh.faces.length === 0) {
    return null;
  }

  const vertices: number[] = [];

  projection.display_mesh.faces.forEach((face) => {
    const triangle = face.vertex_indices
      .map((index) => projection.display_mesh.vertices[index])
      .filter((vertex): vertex is Vector3 => vertex !== undefined);

    if (triangle.length !== 3) {
      return;
    }

    if (triangle.every((vertex) => vertex.z < 0)) {
      return;
    }

    triangle.forEach((vertex) => vertices.push(...worldToScene(clampWorldToGround(vertex))));
  });

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

function CameraRigModel({
  position,
  quaternion
}: {
  position: SceneVector;
  quaternion: ReturnType<typeof cameraModelQuaternion>;
}): JSX.Element {
  return (
    <group position={position} quaternion={quaternion}>
      <mesh position={[0, 0.12, -0.38]} castShadow>
        <boxGeometry args={[0.92, 0.54, 0.62]} />
        <meshStandardMaterial color="#22292b" roughness={0.5} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0.17, -0.36]} castShadow>
        <boxGeometry args={[0.58, 0.3, 0.7]} />
        <meshStandardMaterial color="#2d3438" roughness={0.48} metalness={0.22} />
      </mesh>
      <mesh position={[0, 0.12, -0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.2, 0.38, 28]} />
        <meshStandardMaterial color="#191f21" roughness={0.46} metalness={0.34} />
      </mesh>
      <mesh position={[0, 0.12, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.15, 0.08, 28]} />
        <meshStandardMaterial color="#70b4cb" emissive="#0f2732" roughness={0.18} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.46, -0.36]} castShadow>
        <boxGeometry args={[0.34, 0.12, 0.24]} />
        <meshStandardMaterial color="#30383c" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0, -0.1, -0.28]} castShadow>
        <boxGeometry args={[0.22, 0.12, 0.22]} />
        <meshStandardMaterial color="#2a3033" roughness={0.5} metalness={0.24} />
      </mesh>
    </group>
  );
}

function SceneContent({
  request,
  projection
}: Scene3DViewProps): JSX.Element {
  const { camera } = useThree();
  const hoveredPointId = useAppStore((state) => state.hoveredPointId);
  const selectedPointId = useAppStore((state) => state.selectedPointId);
  const setHoveredPointId = useAppStore((state) => state.setHoveredPointId);
  const setSelectedPointId = useAppStore((state) => state.setSelectedPointId);
  const controlsRef = useRef<ElementRef<typeof OrbitControls> | null>(null);
  const activeId = hoveredPointId ?? selectedPointId;
  const frame = useMemo(() => sceneFrame(request, projection), [projection, request]);
  const meshGeometry = useMemo(() => buildDisplayMeshGeometry(projection), [projection]);
  const colorSet = OBJECT_COLORS[projection?.object_type ?? request.object_spec.type] ?? OBJECT_COLORS.custom_points;
  const cameraWorld = useMemo(
    () => ({
      x: request.camera_pose.x,
      y: request.camera_pose.y,
      z: request.camera_pose.z
    }),
    [request.camera_pose]
  );
  const cameraPosition = useMemo(() => worldToScene(clampWorldToGround(cameraWorld)), [cameraWorld]);
  const cameraQuaternion = useMemo(
    () => cameraModelQuaternion(request.camera_pose),
    [request.camera_pose]
  );
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
    };
  }, [cameraWorld, frustumDepth, request]);
  const frustumSegments = useMemo(
    () =>
      frustumLines.cameraToCorners.map((segment) =>
        segment.map((point) => worldToScene(point as Vector3)) as SceneVector[]
      ),
    [frustumLines.cameraToCorners]
  );
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
  const debugEdges = useMemo(
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
    () => [frame.target[0], Math.max(frame.target[1], 0.3), frame.target[2]],
    [frame.target]
  );

  useEffect(() => {
    camera.position.set(...frame.orbitPosition);
    camera.lookAt(...orbitTarget);
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.set(...orbitTarget);
      controlsRef.current.update();
    }
  }, [camera, frame.orbitPosition, orbitTarget]);

  return (
    <>
      <color attach="background" args={["#f3f8f5"]} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[14, 18, 10]} intensity={1.2} />
      <directionalLight position={[-10, 8, -8]} intensity={0.45} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[frame.groundCenter[0], -0.01, frame.groundCenter[2]]}
        receiveShadow
      >
        <planeGeometry args={[frame.groundSize, frame.groundSize]} />
        <meshStandardMaterial color="#edf4ef" />
      </mesh>
      <gridHelper
        args={[frame.groundSize, Math.max(10, Math.round(frame.groundSize / 2)), "#94afa4", "#dbe7e0"]}
        position={[frame.groundCenter[0], 0.02, frame.groundCenter[2]]}
      />
      {request.display_options.show_axes && <axesHelper args={[3]} />}
      {cameraToObjectLine && <Line points={cameraToObjectLine} color="#ffb347" lineWidth={1.6} />}
      {request.display_options.show_frustum && (
        <>
          {viewDirection && <Line points={viewDirection} color="#d64545" lineWidth={2.4} />}
          {frustumSegments.map((segment, index) => (
            <Line key={`camera-ray-${index}`} points={segment} color="#d64545" lineWidth={1.1} />
          ))}
          <Line points={[...frustumLines.corners, frustumLines.corners[0]]} color="#d64545" lineWidth={1.4} />
        </>
      )}
      {meshGeometry && (
        <>
          <mesh geometry={meshGeometry}>
            <meshStandardMaterial color={colorSet.fill} roughness={0.52} metalness={0.06} />
          </mesh>
          <mesh geometry={meshGeometry}>
            <meshBasicMaterial color={colorSet.wire} wireframe transparent opacity={0.18} />
          </mesh>
        </>
      )}
      {debugEdges.map((segment, index) => (
        <Line key={`scene-link-${index}`} points={segment} color="#2d5f5d" lineWidth={2} />
      ))}
      {visiblePoints.map((point) => (
        <mesh
          key={point.point_id}
          position={worldToScene(clampWorldToGround(point.world))}
          onPointerEnter={() => setHoveredPointId(point.point_id)}
          onPointerLeave={() => setHoveredPointId(null)}
          onClick={() => setSelectedPointId(point.point_id)}
        >
          <sphereGeometry args={[activeId === point.point_id ? 0.16 : 0.1, 16, 16]} />
          <meshStandardMaterial color={activeId === point.point_id ? "#d64545" : "#1f8f88"} />
        </mesh>
      ))}
      <CameraRigModel position={cameraPosition} quaternion={cameraQuaternion} />
      <mesh position={objectCenter}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffb347" />
      </mesh>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={orbitTarget}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
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
        <Canvas camera={{ position: [10, 6, -10], fov: 40 }}>
          <SceneContent request={request} projection={projection} />
        </Canvas>
      </div>
    </section>
  );
}
