export const DIAGRAM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
