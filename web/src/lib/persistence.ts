import {
  projectionRequestSchema,
  type ObjectSpec,
  type Pose3D,
  type ProjectionRequest,
  type ProjectionSchema
} from "../types";

const REQUEST_STORAGE_KEY = "camviz:request:v1";
const LAYOUT_STORAGE_KEY = "camviz:layout:v1";
const OVERLAY_POINTER_STORAGE_KEY = "camviz:overlay-pointer:v1";
const OVERLAY_POINTER_VALUE = "active";
const DB_NAME = "camviz-persistence";
const DB_VERSION = 1;
const OVERLAY_STORE_NAME = "overlay";
const OVERLAY_RECORD_KEY = "current";

export interface PersistedLayoutState {
  panelWidth: number;
  sceneHeight: number;
  imageWidth: number;
}

interface RawPersistedInputState {
  request: unknown | null;
  overlayUrl: string | null;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mergePose(defaultPose: Pose3D, rawPose: unknown): Pose3D {
  if (!isRecord(rawPose)) {
    return defaultPose;
  }

  return {
    x: typeof rawPose.x === "number" ? rawPose.x : defaultPose.x,
    y: typeof rawPose.y === "number" ? rawPose.y : defaultPose.y,
    z: typeof rawPose.z === "number" ? rawPose.z : defaultPose.z,
    yaw: typeof rawPose.yaw === "number" ? rawPose.yaw : defaultPose.yaw,
    pitch: typeof rawPose.pitch === "number" ? rawPose.pitch : defaultPose.pitch,
    roll: typeof rawPose.roll === "number" ? rawPose.roll : defaultPose.roll
  };
}

function mergeObjectSpec(
  schema: ProjectionSchema,
  rawObjectSpec: unknown,
  fallback: ObjectSpec
): ObjectSpec {
  if (!isRecord(rawObjectSpec) || typeof rawObjectSpec.type !== "string") {
    return cloneValue(fallback);
  }

  const definition = schema.object_types.find((item) => item.type === rawObjectSpec.type);
  if (!definition) {
    return cloneValue(fallback);
  }

  if (definition.type === "custom_points") {
    const parsed = projectionRequestSchema.shape.object_spec.safeParse(rawObjectSpec);
    return parsed.success ? parsed.data : cloneValue(definition.defaults);
  }

  const defaults = cloneValue(definition.defaults);
  if (!isRecord(defaults) || !isRecord(rawObjectSpec)) {
    return cloneValue(fallback);
  }

  const merged = {
    ...defaults,
    pose: mergePose(defaults.pose, rawObjectSpec.pose)
  } as Record<string, unknown>;

  definition.parameters.forEach((parameter) => {
    const nextValue = rawObjectSpec[parameter.name];
    if (typeof nextValue === "number" && Number.isFinite(nextValue)) {
      merged[parameter.name] = nextValue;
    }
  });

  return merged as ObjectSpec;
}

function openOverlayDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OVERLAY_STORE_NAME)) {
        database.createObjectStore(OVERLAY_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readOverlayFromIndexedDb(): Promise<string | null> {
  const database = await openOverlayDatabase();
  if (!database) {
    return null;
  }

  return new Promise((resolve) => {
    const transaction = database.transaction(OVERLAY_STORE_NAME, "readonly");
    const store = transaction.objectStore(OVERLAY_STORE_NAME);
    const request = store.get(OVERLAY_RECORD_KEY);

    request.onsuccess = () => {
      database.close();
      resolve(typeof request.result === "string" ? request.result : null);
    };
    request.onerror = () => {
      database.close();
      resolve(null);
    };
  });
}

async function writeOverlayToIndexedDb(value: string | null): Promise<void> {
  const database = await openOverlayDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(OVERLAY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(OVERLAY_STORE_NAME);
    if (value) {
      store.put(value, OVERLAY_RECORD_KEY);
    } else {
      store.delete(OVERLAY_RECORD_KEY);
    }
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      resolve();
    };
  });
}

export function loadPersistedLayout(): PersistedLayoutState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = parseJson<Record<string, unknown>>(window.localStorage.getItem(LAYOUT_STORAGE_KEY));
  if (!value) {
    return null;
  }

  if (
    typeof value.panelWidth !== "number" ||
    typeof value.sceneHeight !== "number" ||
    typeof value.imageWidth !== "number"
  ) {
    return null;
  }

  return {
    panelWidth: value.panelWidth,
    sceneHeight: value.sceneHeight,
    imageWidth: value.imageWidth
  };
}

export function savePersistedLayout(layout: PersistedLayoutState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

export async function loadPersistedInputState(): Promise<RawPersistedInputState> {
  if (typeof window === "undefined") {
    return {
      request: null,
      overlayUrl: null
    };
  }

  const request = parseJson<unknown>(window.localStorage.getItem(REQUEST_STORAGE_KEY));
  const overlayPointer = window.localStorage.getItem(OVERLAY_POINTER_STORAGE_KEY);
  const overlayUrl =
    overlayPointer === OVERLAY_POINTER_VALUE ? await readOverlayFromIndexedDb() : null;

  return {
    request,
    overlayUrl
  };
}

export function resolvePersistedRequest(
  schema: ProjectionSchema,
  rawRequest: unknown
): ProjectionRequest | null {
  if (!isRecord(rawRequest)) {
    return null;
  }

  const defaults = cloneValue(schema.defaults);
  const candidate: ProjectionRequest = {
    ...defaults,
    camera_intrinsics: {
      ...defaults.camera_intrinsics
    },
    distortion: {
      ...defaults.distortion
    },
    camera_pose: {
      ...defaults.camera_pose
    },
    object_spec: cloneValue(defaults.object_spec),
    display_options: {
      ...defaults.display_options
    }
  };

  if (isRecord(rawRequest.camera_intrinsics)) {
    const cameraIntrinsics = rawRequest.camera_intrinsics;
    candidate.camera_intrinsics = {
      fx:
        typeof cameraIntrinsics.fx === "number"
          ? cameraIntrinsics.fx
          : defaults.camera_intrinsics.fx,
      fy:
        typeof cameraIntrinsics.fy === "number"
          ? cameraIntrinsics.fy
          : defaults.camera_intrinsics.fy,
      cx:
        typeof cameraIntrinsics.cx === "number"
          ? cameraIntrinsics.cx
          : defaults.camera_intrinsics.cx,
      cy:
        typeof cameraIntrinsics.cy === "number"
          ? cameraIntrinsics.cy
          : defaults.camera_intrinsics.cy,
      image_width:
        typeof cameraIntrinsics.image_width === "number"
          ? cameraIntrinsics.image_width
          : defaults.camera_intrinsics.image_width,
      image_height:
        typeof cameraIntrinsics.image_height === "number"
          ? cameraIntrinsics.image_height
          : defaults.camera_intrinsics.image_height
    };
  }

  if (isRecord(rawRequest.distortion)) {
    const distortion = rawRequest.distortion;
    candidate.distortion = {
      model:
        distortion.model === "opencv" || distortion.model === "fisheye"
          ? distortion.model
          : defaults.distortion.model,
      k1: typeof distortion.k1 === "number" ? distortion.k1 : defaults.distortion.k1,
      k2: typeof distortion.k2 === "number" ? distortion.k2 : defaults.distortion.k2,
      p1: typeof distortion.p1 === "number" ? distortion.p1 : defaults.distortion.p1,
      p2: typeof distortion.p2 === "number" ? distortion.p2 : defaults.distortion.p2,
      k3: typeof distortion.k3 === "number" ? distortion.k3 : defaults.distortion.k3,
      k4: typeof distortion.k4 === "number" ? distortion.k4 : defaults.distortion.k4,
      k5: typeof distortion.k5 === "number" ? distortion.k5 : defaults.distortion.k5,
      k6: typeof distortion.k6 === "number" ? distortion.k6 : defaults.distortion.k6
    };
  }

  candidate.camera_pose = mergePose(
    defaults.camera_pose,
    rawRequest.camera_pose
  );

  if (isRecord(rawRequest.display_options)) {
    const displayOptions = rawRequest.display_options;
    candidate.display_options = {
      show_frustum:
        typeof displayOptions.show_frustum === "boolean"
          ? displayOptions.show_frustum
          : defaults.display_options.show_frustum,
      show_bbox:
        typeof displayOptions.show_bbox === "boolean"
          ? displayOptions.show_bbox
          : defaults.display_options.show_bbox,
      show_distorted:
        typeof displayOptions.show_distorted === "boolean"
          ? displayOptions.show_distorted
          : defaults.display_options.show_distorted,
      show_undistorted:
        typeof displayOptions.show_undistorted === "boolean"
          ? displayOptions.show_undistorted
          : defaults.display_options.show_undistorted,
      show_labels:
        typeof displayOptions.show_labels === "boolean"
          ? displayOptions.show_labels
          : defaults.display_options.show_labels,
      show_axes:
        typeof displayOptions.show_axes === "boolean"
          ? displayOptions.show_axes
          : defaults.display_options.show_axes
    };
  }

  candidate.object_spec = mergeObjectSpec(schema, rawRequest.object_spec, defaults.object_spec);

  const parsed = projectionRequestSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function savePersistedRequest(request: ProjectionRequest | null): void {
  if (typeof window === "undefined" || !request) {
    return;
  }

  window.localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(request));
}

export async function savePersistedOverlayUrl(overlayUrl: string | null): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (!overlayUrl) {
    window.localStorage.removeItem(OVERLAY_POINTER_STORAGE_KEY);
    await writeOverlayToIndexedDb(null);
    return;
  }

  window.localStorage.setItem(OVERLAY_POINTER_STORAGE_KEY, OVERLAY_POINTER_VALUE);
  await writeOverlayToIndexedDb(overlayUrl);
}
