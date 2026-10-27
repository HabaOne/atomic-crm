import type { Identifier } from "ra-core";

export type NotContactedScope = "mine" | "everyone";

export interface NotContactedFilterValues {
  scope: NotContactedScope;
  salesId?: Identifier;
  contactType?: string;
  addedThisWeek?: boolean;
  now?: Date;
}

/** Monday 00:00 of the week that contains `now`, local time. */
export const startOfWeek = (now: Date): Date => {
  const offset = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
};

/** Filter for contacts_summary rows nobody has contacted yet. */
export const buildNotContactedFilter = ({
  scope,
  salesId,
  contactType,
  addedThisWeek,
  now = new Date(),
}: NotContactedFilterValues): Record<string, unknown> => {
  const filter: Record<string, unknown> = { is_contacted: false };
  if (scope === "mine" && salesId != null) filter.sales_id = salesId;
  if (contactType) filter.contact_type = contactType;
  if (addedThisWeek) {
    filter["first_seen@gte"] = startOfWeek(now).toISOString();
  }
  return filter;
};

/** Distinct, sorted, non-empty values of one field. */
export const distinctValues = <T>(
  rows: T[] | undefined,
  pick: (row: T) => string | null | undefined,
): string[] =>
  Array.from(
    new Set(
      (rows ?? [])
        .map(pick)
        .filter((value): value is string => !!value && !!value.trim()),
    ),
  ).sort((a, b) => a.localeCompare(b));
