import { z } from "zod";

const point2DSchema = z.object({
  x: z.number(),
  y: z.number()
});

const vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

const edgeSchema = z.object({
  start_id: z.string(),
  end_id: z.string()
});

const faceSchema = z.object({
  point_ids: z.array(z.string()),
  label: z.string().nullable().optional()
});

const meshFaceSchema = z.object({
  vertex_indices: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  label: z.string().nullable().optional()
});

const pose3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  yaw: z.number(),
  pitch: z.number(),
  roll: z.number()
});

const cameraIntrinsicsSchema = z.object({
  fx: z.number(),
  fy: z.number(),
  cx: z.number(),
  cy: z.number(),
  image_width: z.number().int().positive(),
  image_height: z.number().int().positive()
});

const distortionModelSchema = z.object({
  model: z.enum(["radtan", "fisheye"]),
  k1: z.number(),
  k2: z.number(),
  p1: z.number(),
  p2: z.number(),
  k3: z.number(),
  k4: z.number(),
  k5: z.number(),
  k6: z.number()
});

const displayOptionsSchema = z.object({
  show_frustum: z.boolean(),
  show_bbox: z.boolean(),
  show_labels: z.boolean(),
  show_axes: z.boolean()
});

const sedanSpecSchema = z.object({
  type: z.literal("sedan"),
  length: z.number(),
  width: z.number(),
  height: z.number(),
  wheelbase: z.number(),
  roof_height: z.number(),
  hood_length: z.number(),
  trunk_length: z.number(),
  pose: pose3DSchema
});

const truckSpecSchema = z.object({
  type: z.literal("truck"),
  cab_length: z.number(),
  cargo_length: z.number(),
  cargo_width: z.number(),
  cargo_height: z.number(),
  cab_height: z.number(),
  wheelbase: z.number(),
  pose: pose3DSchema
});

const bicycleSpecSchema = z.object({
  type: z.literal("bicycle"),
  wheel_diameter: z.number(),
  wheelbase: z.number(),
  frame_height: z.number(),
  handlebar_width: z.number(),
  saddle_height: z.number(),
  pose: pose3DSchema
});

const pedestrianSpecSchema = z.object({
  type: z.literal("pedestrian"),
  body_height: z.number(),
  shoulder_width: z.number(),
  torso_depth: z.number(),
  hip_width: z.number(),
  head_scale: z.number(),
  pose: pose3DSchema
});

const trafficConeSpecSchema = z.object({
  type: z.literal("traffic_cone"),
  base_diameter: z.number(),
  top_diameter: z.number(),
  cone_height: z.number(),
  pose: pose3DSchema
});

const customPointSchema = vector3Schema.extend({
  id: z.string()
});

const customPointSpecSchema = z.object({
  type: z.literal("custom_points"),
  pose: pose3DSchema,
  points: z.array(customPointSchema),
  edges: z.array(edgeSchema),
  faces: z.array(faceSchema)
});

const objectSpecSchema = z.discriminatedUnion("type", [
  sedanSpecSchema,
  truckSpecSchema,
  bicycleSpecSchema,
  pedestrianSpecSchema,
  trafficConeSpecSchema,
  customPointSpecSchema
]);

const pointDiagnosticSchema = z.object({
  point_id: z.string(),
  world: vector3Schema,
  camera: vector3Schema,
  undistorted_image: point2DSchema.nullable(),
  distorted_image: point2DSchema.nullable(),
  visible: z.boolean(),
  inside_image: z.boolean(),
  inside_image_undistorted: z.boolean()
});

const boundingBoxSchema = z.object({
  min_x: z.number(),
  max_x: z.number(),
  min_y: z.number(),
  max_y: z.number(),
  width: z.number(),
  height: z.number(),
  inside_image: z.boolean(),
  intersects_image: z.boolean()
});

const projectionAnalysisSchema = z.object({
  pixel_width: z.number(),
  pixel_height: z.number(),
  coverage_ratio: z.number(),
  distortion_mean_offset_px: z.number(),
  distortion_max_offset_px: z.number(),
  visible_point_count: z.number().int(),
  hidden_point_count: z.number().int(),
  center_inside_image: z.boolean(),
  bbox_intersects_image: z.boolean(),
  bbox_inside_image: z.boolean()
});

const contour2DSchema = z.object({
  points: z.array(point2DSchema)
});

const silhouetteSetSchema = z.object({
  distorted: z.array(contour2DSchema),
  undistorted: z.array(contour2DSchema)
});

const displayMeshSchema = z.object({
  vertices: z.array(vector3Schema),
  faces: z.array(meshFaceSchema)
});

const objectParameterDefinitionSchema = z.object({
  name: z.string(),
  label: z.string(),
  group: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number()
});

const objectTypeDefinitionSchema = z.object({
  type: z.string(),
  label: z.string(),
  parameters: z.array(objectParameterDefinitionSchema),
  defaults: objectSpecSchema
});

export const projectionRequestSchema = z.object({
  camera_intrinsics: cameraIntrinsicsSchema,
  distortion: distortionModelSchema,
  camera_pose: pose3DSchema,
  object_spec: objectSpecSchema,
  display_options: displayOptionsSchema
});

export const projectionResultSchema = z.object({
  object_type: z.string(),
  projected_points: z.array(pointDiagnosticSchema),
  edges: z.array(edgeSchema),
  faces: z.array(faceSchema),
  center: pointDiagnosticSchema,
  bbox: boundingBoxSchema,
  undistorted_bbox: boundingBoxSchema,
  principal_point: point2DSchema,
  analysis: projectionAnalysisSchema,
  display_mesh: displayMeshSchema,
  silhouette: silhouetteSetSchema
});

export const projectionSchemaSchema = z.object({
  object_types: z.array(objectTypeDefinitionSchema),
  distortion_models: z.array(z.string()),
  defaults: projectionRequestSchema
});

export const customDefinitionSchema = z.object({
  points: z.array(customPointSchema),
  edges: z.array(edgeSchema).default([]),
  faces: z.array(faceSchema).default([])
});

export type Point2D = z.infer<typeof point2DSchema>;
export type Vector3 = z.infer<typeof vector3Schema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Face = z.infer<typeof faceSchema>;
export type MeshFace = z.infer<typeof meshFaceSchema>;
export type Pose3D = z.infer<typeof pose3DSchema>;
export type CameraIntrinsics = z.infer<typeof cameraIntrinsicsSchema>;
export type DistortionModel = z.infer<typeof distortionModelSchema>;
export type DisplayOptions = z.infer<typeof displayOptionsSchema>;
export type SedanSpec = z.infer<typeof sedanSpecSchema>;
export type TruckSpec = z.infer<typeof truckSpecSchema>;
export type BicycleSpec = z.infer<typeof bicycleSpecSchema>;
export type PedestrianSpec = z.infer<typeof pedestrianSpecSchema>;
export type TrafficConeSpec = z.infer<typeof trafficConeSpecSchema>;
export type CustomPointSpec = z.infer<typeof customPointSpecSchema>;
export type ObjectSpec = z.infer<typeof objectSpecSchema>;
export type PointDiagnostic = z.infer<typeof pointDiagnosticSchema>;
export type BoundingBox = z.infer<typeof boundingBoxSchema>;
export type ProjectionAnalysis = z.infer<typeof projectionAnalysisSchema>;
export type Contour2D = z.infer<typeof contour2DSchema>;
export type SilhouetteSet = z.infer<typeof silhouetteSetSchema>;
export type DisplayMesh = z.infer<typeof displayMeshSchema>;
export type ObjectParameterDefinition = z.infer<typeof objectParameterDefinitionSchema>;
export type ObjectTypeDefinition = z.infer<typeof objectTypeDefinitionSchema>;
export type ProjectionRequest = z.infer<typeof projectionRequestSchema>;
export type ProjectionResult = z.infer<typeof projectionResultSchema>;
export type ProjectionSchema = z.infer<typeof projectionSchemaSchema>;
export type CustomObjectDefinition = z.infer<typeof customDefinitionSchema>;
export type ParameterizedObjectSpec = Exclude<ObjectSpec, CustomPointSpec>;
