import { describe, expect, it } from "vitest";

import {
  buildNotContactedFilter,
  distinctValues,
  startOfWeek,
} from "./notContactedFilter";

// Tuesday, 27 October 2026
const now = new Date(2026, 9, 27, 11, 12);

describe("buildNotContactedFilter", () => {
  it("always filters on contacts without activity", () => {
    expect(buildNotContactedFilter({ scope: "everyone", now })).toEqual({
      is_contacted: false,
    });
  });

  it("limits to the current user's contacts for 'mine'", () => {
    expect(buildNotContactedFilter({ scope: "mine", salesId: 4, now })).toEqual(
      {
        is_contacted: false,
        sales_id: 4,
      },
    );
    // no user yet: no owner filter rather than an empty result
    expect(buildNotContactedFilter({ scope: "mine", now })).toEqual({
      is_contacted: false,
    });
  });

  it("adds the contact type and the week start", () => {
    expect(
      buildNotContactedFilter({
        scope: "everyone",
        contactType: "investor",
        addedThisWeek: true,
        now,
      }),
    ).toEqual({
      is_contacted: false,
      contact_type: "investor",
      "first_seen@gte": new Date(2026, 9, 26).toISOString(),
    });
  });
});

describe("startOfWeek", () => {
  it("starts the week on Monday", () => {
    expect(startOfWeek(now)).toEqual(new Date(2026, 9, 26));
    // Sunday belongs to the week that started on the Monday before
    expect(startOfWeek(new Date(2026, 10, 1, 9))).toEqual(
      new Date(2026, 9, 26),
    );
  });
});

describe("distinctValues", () => {
  it("returns sorted unique non-empty values", () => {
    expect(
      distinctValues(
        [
          { t: "investor" },
          { t: null },
          { t: "hotel" },
          { t: "investor" },
          { t: " " },
        ],
        (row) => row.t,
      ),
    ).toEqual(["hotel", "investor"]);
    expect(distinctValues(undefined, () => "x")).toEqual([]);
  });
});
