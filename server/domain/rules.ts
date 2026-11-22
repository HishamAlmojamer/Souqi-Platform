import { ApiError } from "../http";

interface SchemaField {
  type?: string;
}

interface SchemaLike {
  required?: unknown;
  properties?: Record<string, SchemaField>;
  sections?: unknown;
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    default:
      return true;
  }
}

function validateShape(
  schema: SchemaLike,
  payload: Record<string, unknown>,
  path: string,
): void {
  if (Array.isArray(schema.required)) {
    for (const key of schema.required) {
      if (typeof key !== "string") continue;
      if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
        throw new ApiError(
          400,
          `الحقل ${path ? `${path}.` : ""}${key} مطلوب`,
          "REQUIREMENTS_INVALID",
        );
      }
    }
  }

  if (schema.properties && typeof schema.properties === "object") {
    for (const [key, field] of Object.entries(schema.properties)) {
      const value = payload[key];
      if (value !== undefined && field?.type && !matchesType(value, field.type)) {
        throw new ApiError(
          400,
          `نوع الحقل ${path ? `${path}.` : ""}${key} غير صالح`,
          "REQUIREMENTS_INVALID",
        );
      }
    }
  }
}

export function validateRequirements(
  schemaJson: unknown,
  requirements: unknown,
): void {
  if (
    typeof requirements !== "object" ||
    requirements === null ||
    Array.isArray(requirements)
  ) {
    throw new ApiError(400, "المتطلبات يجب أن تكون كائنًا", "REQUIREMENTS_INVALID");
  }

  const payload = requirements as Record<string, unknown>;
  const schema = (schemaJson ?? {}) as SchemaLike;
  validateShape(schema, payload, "");

  if (Array.isArray(schema.sections)) {
    for (const section of schema.sections) {
      if (typeof section !== "object" || section === null) continue;
      const candidate = section as Record<string, unknown>;
      const key = typeof candidate.key === "string" ? candidate.key : "";
      const value = key ? payload[key] : payload;
      if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
      ) {
        continue;
      }
      validateShape(candidate as SchemaLike, value as Record<string, unknown>, key);
    }
  }
}
