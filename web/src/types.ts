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
  model: z.enum(["opencv", "fisheye"]),
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
  show_distorted: z.boolean(),
  show_undistorted: z.boolean(),
  show_labels: z.boolean(),
  show_axes: z.boolean()
});

const boxSpecSchema = z.object({
  type: z.literal("box"),
  width: z.number(),
  length: z.number(),
  height: z.number(),
  pose: pose3DSchema
});

const rectangleSpecSchema = z.object({
  type: z.literal("rectangle"),
  width: z.number(),
  length: z.number(),
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
  boxSpecSchema,
  rectangleSpecSchema,
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

export const projectionRequestSchema = z.object({
  camera_intrinsics: cameraIntrinsicsSchema,
  distortion: distortionModelSchema,
  camera_pose: pose3DSchema,
  object_spec: objectSpecSchema,
  display_options: displayOptionsSchema
});

export const projectionResultSchema = z.object({
  projected_points: z.array(pointDiagnosticSchema),
  edges: z.array(edgeSchema),
  faces: z.array(faceSchema),
  center: pointDiagnosticSchema,
  bbox: boundingBoxSchema,
  undistorted_bbox: boundingBoxSchema,
  principal_point: point2DSchema,
  analysis: projectionAnalysisSchema
});

export const projectionSchemaSchema = z.object({
  object_types: z.array(z.string()),
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
export type Pose3D = z.infer<typeof pose3DSchema>;
export type CameraIntrinsics = z.infer<typeof cameraIntrinsicsSchema>;
export type DistortionModel = z.infer<typeof distortionModelSchema>;
export type DisplayOptions = z.infer<typeof displayOptionsSchema>;
export type BoxSpec = z.infer<typeof boxSpecSchema>;
export type RectangleSpec = z.infer<typeof rectangleSpecSchema>;
export type CustomPointSpec = z.infer<typeof customPointSpecSchema>;
export type ObjectSpec = z.infer<typeof objectSpecSchema>;
export type PointDiagnostic = z.infer<typeof pointDiagnosticSchema>;
export type BoundingBox = z.infer<typeof boundingBoxSchema>;
export type ProjectionAnalysis = z.infer<typeof projectionAnalysisSchema>;
export type ProjectionRequest = z.infer<typeof projectionRequestSchema>;
export type ProjectionResult = z.infer<typeof projectionResultSchema>;
export type ProjectionSchema = z.infer<typeof projectionSchemaSchema>;
export type CustomObjectDefinition = z.infer<typeof customDefinitionSchema>;
