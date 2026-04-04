import {
  projectionResultSchema,
  projectionSchemaSchema,
  type ProjectionRequest,
  type ProjectionResult,
  type ProjectionSchema
} from "../types";

async function fetchJson<T>(input: RequestInfo, init: RequestInit | undefined, parser: {
  parse: (payload: unknown) => T;
}): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return parser.parse(await response.json());
}

export function fetchSchema(): Promise<ProjectionSchema> {
  return fetchJson("/api/schema", undefined, projectionSchemaSchema);
}

export function evaluateProjection(request: ProjectionRequest): Promise<ProjectionResult> {
  return fetchJson(
    "/api/projection/evaluate",
    {
      method: "POST",
      body: JSON.stringify(request)
    },
    projectionResultSchema
  );
}
