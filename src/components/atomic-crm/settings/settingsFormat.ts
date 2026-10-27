/**
 * Text input helpers for the organization settings that are stored as arrays
 * but edited as text: lists as comma-separated text, objects as JSON.
 */
export const formatList = (value: unknown) =>
  Array.isArray(value) ? value.join(", ") : (value ?? "");

export const parseList = (value: string) =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export const formatJson = (value: unknown) =>
  typeof value === "string"
    ? value
    : value
      ? JSON.stringify(value, null, 2)
      : "";

/** Keeps the raw text while it is not valid JSON, so typing is not lost. */
export const parseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
