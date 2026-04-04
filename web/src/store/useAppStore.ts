import { create } from "zustand";

import {
  customDefinitionSchema,
  type CameraIntrinsics,
  type CustomObjectDefinition,
  type CustomPointSpec,
  type DisplayOptions,
  type DistortionModel,
  type ObjectSpec,
  type ObjectTypeDefinition,
  type Pose3D,
  type ProjectionRequest,
  type ProjectionResult,
  type ProjectionSchema
} from "../types";

type ObjectType = ObjectSpec["type"];

interface AppState {
  schema: ProjectionSchema | null;
  request: ProjectionRequest | null;
  projection: ProjectionResult | null;
  loading: boolean;
  error: string | null;
  geometryRevision: number;
  hoveredPointId: string | null;
  selectedPointId: string | null;
  overlayUrl: string | null;
  initializeFromSchema: (schema: ProjectionSchema) => void;
  setProjection: (projection: ProjectionResult) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCameraIntrinsic: (key: keyof CameraIntrinsics, value: number) => void;
  setDistortionValue: (key: keyof DistortionModel, value: number) => void;
  setDistortionModel: (model: DistortionModel["model"]) => void;
  setCameraPoseValue: (key: keyof Pose3D, value: number) => void;
  setObjectPoseValue: (key: keyof Pose3D, value: number) => void;
  setObjectParameter: (key: string, value: number) => void;
  setObjectType: (type: ObjectType) => void;
  setCustomObjectDefinition: (definition: CustomObjectDefinition) => void;
  setDisplayOption: (key: keyof DisplayOptions, value: boolean) => void;
  setHoveredPointId: (pointId: string | null) => void;
  setSelectedPointId: (pointId: string | null) => void;
  setOverlayUrl: (url: string | null) => void;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getObjectDefinition(
  schema: ProjectionSchema | null,
  type: ObjectType
): ObjectTypeDefinition | null {
  return schema?.object_types.find((definition) => definition.type === type) ?? null;
}

function buildObjectSpecFromSchema(
  schema: ProjectionSchema | null,
  type: ObjectType,
  pose?: Pose3D
): ObjectSpec | null {
  const definition = getObjectDefinition(schema, type);
  if (!definition) {
    return null;
  }
  const defaults = cloneValue(definition.defaults);
  return {
    ...defaults,
    pose: pose ?? defaults.pose
  } as ObjectSpec;
}

function updateRequest(
  request: ProjectionRequest | null,
  updater: (request: ProjectionRequest) => ProjectionRequest
): ProjectionRequest | null {
  return request ? updater(request) : request;
}

export const useAppStore = create<AppState>((set) => ({
  schema: null,
  request: null,
  projection: null,
  loading: false,
  error: null,
  geometryRevision: 0,
  hoveredPointId: null,
  selectedPointId: null,
  overlayUrl: null,
  initializeFromSchema: (schema) =>
    set({
      schema,
      request: cloneValue(schema.defaults),
      projection: null,
      error: null,
      geometryRevision: 1,
      hoveredPointId: null,
      selectedPointId: null
    }),
  setProjection: (projection) => set({ projection, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setCameraIntrinsic: (key, value) =>
    set((state) => ({
      request: updateRequest(state.request, (request) => ({
        ...request,
        camera_intrinsics: {
          ...request.camera_intrinsics,
          [key]: value
        }
      })),
      geometryRevision: state.geometryRevision + 1
    })),
  setDistortionValue: (key, value) =>
    set((state) => ({
      request: updateRequest(state.request, (request) => ({
        ...request,
        distortion: {
          ...request.distortion,
          [key]: value
        }
      })),
      geometryRevision: state.geometryRevision + 1
    })),
  setDistortionModel: (model) =>
    set((state) => ({
      request: updateRequest(state.request, (request) => ({
        ...request,
        distortion: {
          ...request.distortion,
          model
        }
      })),
      geometryRevision: state.geometryRevision + 1
    })),
  setCameraPoseValue: (key, value) =>
    set((state) => ({
      request: updateRequest(state.request, (request) => ({
        ...request,
        camera_pose: {
          ...request.camera_pose,
          [key]: value
        }
      })),
      geometryRevision: state.geometryRevision + 1
    })),
  setObjectPoseValue: (key, value) =>
    set((state) => ({
      request: updateRequest(state.request, (request) => ({
        ...request,
        object_spec: {
          ...request.object_spec,
          pose: {
            ...request.object_spec.pose,
            [key]: value
          }
        }
      })),
      geometryRevision: state.geometryRevision + 1
    })),
  setObjectParameter: (key, value) =>
    set((state) => ({
      request: updateRequest(state.request, (request) => {
        if (request.object_spec.type === "custom_points") {
          return request;
        }
        return {
          ...request,
          object_spec: {
            ...request.object_spec,
            [key]: value
          } as ObjectSpec
        };
      }),
      geometryRevision: state.geometryRevision + 1
    })),
  setObjectType: (type) =>
    set((state) => {
      const pose = state.request?.object_spec.pose;
      const nextSpec =
        buildObjectSpecFromSchema(state.schema, type, pose) ?? state.request?.object_spec ?? null;
      return {
        request: updateRequest(state.request, (request) => ({
          ...request,
          object_spec: nextSpec ?? request.object_spec
        })),
        geometryRevision: state.geometryRevision + 1,
        selectedPointId: null,
        hoveredPointId: null
      };
    }),
  setCustomObjectDefinition: (definition) =>
    set((state) => ({
      request: updateRequest(state.request, (request) => {
        if (request.object_spec.type !== "custom_points") {
          return request;
        }
        const parsed = customDefinitionSchema.parse(definition);
        const customSpec: CustomPointSpec = {
          ...request.object_spec,
          points: parsed.points,
          edges: parsed.edges,
          faces: parsed.faces
        };
        return {
          ...request,
          object_spec: customSpec
        };
      }),
      geometryRevision: state.geometryRevision + 1
    })),
  setDisplayOption: (key, value) =>
    set((state) => ({
      request: updateRequest(state.request, (request) => ({
        ...request,
        display_options: {
          ...request.display_options,
          [key]: value
        }
      }))
    })),
  setHoveredPointId: (hoveredPointId) => set({ hoveredPointId }),
  setSelectedPointId: (selectedPointId) => set({ selectedPointId }),
  setOverlayUrl: (overlayUrl) => set({ overlayUrl })
}));
