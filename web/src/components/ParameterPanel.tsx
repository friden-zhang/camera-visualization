import { useEffect, useMemo, useState, type CSSProperties, type JSX } from "react";

import { NumericField } from "./NumericField";
import { useAppStore } from "../store/useAppStore";
import {
  type CustomObjectDefinition,
  type ObjectParameterDefinition,
  type ObjectSpec,
  type ObjectTypeDefinition
} from "../types";

function CustomPointsEditor(): JSX.Element | null {
  const objectSpec = useAppStore((state) => state.request?.object_spec);
  const setCustomObjectDefinition = useAppStore((state) => state.setCustomObjectDefinition);
  const setError = useAppStore((state) => state.setError);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (objectSpec?.type === "custom_points") {
      setDraft(
        JSON.stringify(
          {
            points: objectSpec.points,
            edges: objectSpec.edges,
            faces: objectSpec.faces
          },
          null,
          2
        )
      );
    }
  }, [objectSpec]);

  if (!objectSpec || objectSpec.type !== "custom_points") {
    return null;
  }

  return (
    <label className="field field-textarea">
      <span>Custom geometry JSON</span>
      <textarea
        aria-label="Custom geometry JSON"
        rows={12}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          try {
            setCustomObjectDefinition(JSON.parse(draft) as CustomObjectDefinition);
            setError(null);
          } catch (error) {
            setError(error instanceof Error ? error.message : "Invalid custom geometry JSON");
          }
        }}
      />
    </label>
  );
}

function OverlayInput(): JSX.Element {
  const setOverlayUrl = useAppStore((state) => state.setOverlayUrl);

  return (
    <label className="field">
      <span>Overlay image</span>
      <input
        aria-label="Overlay image"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            setOverlayUrl(null);
            return;
          }
          const reader = new FileReader();
          reader.onload = () => setOverlayUrl(typeof reader.result === "string" ? reader.result : null);
          reader.readAsDataURL(file);
        }}
      />
    </label>
  );
}

function getObjectDefinition(
  definitions: ObjectTypeDefinition[],
  type: ObjectSpec["type"]
): ObjectTypeDefinition | null {
  return definitions.find((definition) => definition.type === type) ?? null;
}

function groupParameters(parameters: ObjectParameterDefinition[]): Array<[string, ObjectParameterDefinition[]]> {
  const grouped = new Map<string, ObjectParameterDefinition[]>();
  parameters.forEach((parameter) => {
    const existing = grouped.get(parameter.group);
    if (existing) {
      existing.push(parameter);
      return;
    }
    grouped.set(parameter.group, [parameter]);
  });
  return Array.from(grouped.entries());
}

function isParameterizedObject(
  objectSpec: ObjectSpec
): objectSpec is Exclude<ObjectSpec, { type: "custom_points" }> {
  return objectSpec.type !== "custom_points";
}

interface ParameterPanelProps {
  style?: CSSProperties;
}

export function ParameterPanel({ style }: ParameterPanelProps): JSX.Element | null {
  const request = useAppStore((state) => state.request);
  const schema = useAppStore((state) => state.schema);
  const setCameraIntrinsic = useAppStore((state) => state.setCameraIntrinsic);
  const setDistortionValue = useAppStore((state) => state.setDistortionValue);
  const setDistortionModel = useAppStore((state) => state.setDistortionModel);
  const setCameraPoseValue = useAppStore((state) => state.setCameraPoseValue);
  const setObjectPoseValue = useAppStore((state) => state.setObjectPoseValue);
  const setObjectParameter = useAppStore((state) => state.setObjectParameter);
  const setObjectType = useAppStore((state) => state.setObjectType);
  const setDisplayOption = useAppStore((state) => state.setDisplayOption);

  const activeObjectDefinition = useMemo(
    () =>
      request && schema ? getObjectDefinition(schema.object_types, request.object_spec.type) : null,
    [request, schema]
  );
  const groupedObjectParameters = useMemo(
    () => groupParameters(activeObjectDefinition?.parameters ?? []),
    [activeObjectDefinition]
  );

  if (!request || !schema) {
    return null;
  }

  return (
    <aside className="panel" style={style}>
      <details open className="panel-group">
        <summary><h2>Camera Intrinsics</h2></summary>
        <div className="field-grid">
          <NumericField label="fx" value={request.camera_intrinsics.fx} onCommit={(value) => setCameraIntrinsic("fx", value)} />
          <NumericField label="fy" value={request.camera_intrinsics.fy} onCommit={(value) => setCameraIntrinsic("fy", value)} />
          <NumericField label="cx" value={request.camera_intrinsics.cx} onCommit={(value) => setCameraIntrinsic("cx", value)} />
          <NumericField label="cy" value={request.camera_intrinsics.cy} onCommit={(value) => setCameraIntrinsic("cy", value)} />
          <NumericField
            label="image width"
            value={request.camera_intrinsics.image_width}
            onCommit={(value) => setCameraIntrinsic("image_width", value)}
            step={1}
            min={1}
          />
          <NumericField
            label="image height"
            value={request.camera_intrinsics.image_height}
            onCommit={(value) => setCameraIntrinsic("image_height", value)}
            step={1}
            min={1}
          />
        </div>
      </details>

      <details open className="panel-group">
        <summary><h2>Distortion</h2></summary>
        <div className="field-grid">
          <label className="field">
            <span>Model</span>
            <select
              aria-label="Model"
              value={request.distortion.model}
              onChange={(event) => setDistortionModel(event.target.value as "opencv" | "fisheye")}
            >
              {schema.distortion_models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          {(["k1", "k2", "p1", "p2", "k3", "k4", "k5", "k6"] as const).map((key) => (
            <NumericField
              key={key}
              label={key}
              value={request.distortion[key]}
              onCommit={(value) => setDistortionValue(key, value)}
              step={0.001}
            />
          ))}
        </div>
      </details>

      <details open className="panel-group">
        <summary><h2>Camera Pose</h2></summary>
        <div className="field-grid">
          {(["x", "y", "z", "yaw", "pitch", "roll"] as const).map((key) => (
            <NumericField
              key={key}
              label={key}
              value={request.camera_pose[key]}
              onCommit={(value) => setCameraPoseValue(key, value)}
            />
          ))}
        </div>
      </details>

      <details open className="panel-group">
        <summary><h2>Object</h2></summary>
        <div className="field-grid object-type-row">
          <label className="field">
            <span>Type</span>
            <select
              aria-label="Type"
              value={request.object_spec.type}
              onChange={(event) => setObjectType(event.target.value as ObjectSpec["type"])}
            >
              {schema.object_types.map((objectType) => (
                <option key={objectType.type} value={objectType.type}>
                  {objectType.label}
                </option>
              ))}
            </select>
          </label>
          {activeObjectDefinition ? (
            <div className="object-type-chip" aria-label="Object definition">
              {activeObjectDefinition.label}
            </div>
          ) : null}
        </div>
        {isParameterizedObject(request.object_spec) &&
          groupedObjectParameters.map(([groupName, parameters]) => (
            <section key={groupName} className="parameter-subsection">
              <p className="parameter-subsection-title">{groupName}</p>
              <div className="field-grid">
                {parameters.map((parameter) => {
                  const parameterValue = (request.object_spec as Record<string, unknown>)[parameter.name];
                  if (typeof parameterValue !== "number") {
                    return null;
                  }
                  return (
                    <NumericField
                      key={parameter.name}
                      label={parameter.label}
                      value={parameterValue}
                      onCommit={(value) => setObjectParameter(parameter.name, value)}
                      step={parameter.step}
                      min={parameter.min}
                      max={parameter.max}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        <section className="parameter-subsection">
          <p className="parameter-subsection-title">Pose</p>
          <div className="field-grid">
            {(["x", "y", "z", "yaw", "pitch", "roll"] as const).map((key) => (
              <NumericField
                key={key}
                label={`object ${key}`}
                value={request.object_spec.pose[key]}
                onCommit={(value) => setObjectPoseValue(key, value)}
              />
            ))}
          </div>
        </section>
        <CustomPointsEditor />
      </details>

      <details open className="panel-group">
        <summary><h2>Display Options</h2></summary>
        <div className="checkbox-grid">
          {(Object.entries(request.display_options) as [keyof typeof request.display_options, boolean][]).map(
            ([key, enabled]) => (
              <label key={key} className="checkbox-field">
                <input
                  aria-label={key.replaceAll("_", " ")}
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setDisplayOption(key, event.target.checked)}
                />
                <span>{key.replaceAll("_", " ")}</span>
              </label>
            )
          )}
        </div>
        <OverlayInput />
      </details>
    </aside>
  );
}
