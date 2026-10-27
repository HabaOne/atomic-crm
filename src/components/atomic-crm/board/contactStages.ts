/**
 * Contact lifecycle stages shown as columns on the contact board.
 *
 * Each organization can define its own stages in
 * `organizations.settings.contactStages`; organizations without that setting
 * get the defaults below. Stage labels are user data and are not translated.
 */
export interface ContactStage {
  value: string;
  label: string;
  color: string;
  substatuses: string[];
}

/** Column id for contacts that have no lifecycle stage yet. */
export const NO_STAGE = "__no_stage__";

export const DEFAULT_STAGE_COLOR = "#737373";

export const defaultContactStages: ContactStage[] = [
  {
    value: "lead",
    label: "Lead",
    color: "#2563eb",
    substatuses: ["New", "Contacted", "Qualified"],
  },
  {
    value: "prospect",
    label: "Prospect",
    color: "#d97706",
    substatuses: ["Meeting set", "Proposal sent", "Negotiation"],
  },
  {
    value: "customer",
    label: "Customer",
    color: "#15803d",
    substatuses: ["Onboarding", "Active"],
  },
  {
    value: "lost",
    label: "Lost",
    color: "#a3a3a3",
    substatuses: ["Timing", "Budget", "Competitor"],
  },
];

/** Turns a label into a stable stage value: lower case, a-z, 0-9, `_`, `-`. */
export const toStageValue = (label: string): string =>
  label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

const toSubstatuses = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

/**
 * Reads the stages stored in the organization settings and falls back to the
 * defaults when the setting is missing or holds nothing usable. Accepts an
 * array or its JSON string form, drops invalid entries and duplicate values.
 */
export const resolveContactStages = (raw: unknown): ContactStage[] => {
  let candidate = raw;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return defaultContactStages;
    }
  }
  if (!Array.isArray(candidate)) return defaultContactStages;

  const seen = new Set<string>();
  const stages: ContactStage[] = [];
  for (const entry of candidate) {
    if (!entry || typeof entry !== "object") continue;
    const { label, value, color, substatuses } = entry as Record<
      string,
      unknown
    >;
    if (typeof label !== "string" || !label.trim()) continue;
    const stageValue = toStageValue(
      typeof value === "string" && value.trim() ? value : label,
    );
    if (!stageValue || stageValue === NO_STAGE || seen.has(stageValue)) {
      continue;
    }
    seen.add(stageValue);
    stages.push({
      value: stageValue,
      label: label.trim(),
      color:
        typeof color === "string" && HEX_COLOR.test(color)
          ? color
          : DEFAULT_STAGE_COLOR,
      substatuses: toSubstatuses(substatuses),
    });
  }
  return stages.length > 0 ? stages : defaultContactStages;
};

export const findStage = (
  stages: ContactStage[],
  value: string | null | undefined,
): ContactStage | undefined =>
  value ? stages.find((stage) => stage.value === value) : undefined;
