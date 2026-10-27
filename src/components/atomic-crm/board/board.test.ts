import { describe, expect, it } from "vitest";

import type { Contact } from "../types";
import {
  buildBoardFilter,
  buildColumnFilter,
  buildStageChange,
  applyPendingMoves,
} from "./boardLogic";
import {
  NO_STAGE,
  defaultContactStages,
  resolveContactStages,
  toStageValue,
} from "./contactStages";

const contact = (id: number, stage: string | null = null) =>
  ({ id, lifecycle_stage: stage, lifecycle_substatus: "New" }) as Contact;

describe("resolveContactStages", () => {
  it("falls back to the defaults when nothing usable is stored", () => {
    expect(resolveContactStages(undefined)).toBe(defaultContactStages);
    expect(resolveContactStages([])).toBe(defaultContactStages);
    expect(resolveContactStages("not json")).toBe(defaultContactStages);
    expect(resolveContactStages([{ value: "x" }])).toBe(defaultContactStages);
  });

  it("reads organization stages from an array or a JSON string", () => {
    const stored = [
      {
        label: "Pre-seed fit",
        color: "#123456",
        substatuses: "Researched, Intro sent",
      },
      { value: "term_sheet", label: "Term sheet", color: "red" },
    ];
    const expected = [
      {
        value: "pre-seed-fit",
        label: "Pre-seed fit",
        color: "#123456",
        substatuses: ["Researched", "Intro sent"],
      },
      {
        value: "term_sheet",
        label: "Term sheet",
        color: "#737373",
        substatuses: [],
      },
    ];
    expect(resolveContactStages(stored)).toEqual(expected);
    expect(resolveContactStages(JSON.stringify(stored))).toEqual(expected);
  });

  it("drops duplicate values and the reserved no-stage id", () => {
    const stages = resolveContactStages([
      { label: "Lead" },
      { label: "lead" },
      { value: NO_STAGE, label: "Hidden" },
    ]);
    expect(stages.map((s) => s.value)).toEqual(["lead"]);
  });

  it("builds stage values from labels", () => {
    expect(toStageValue("  Due Diligence ")).toBe("due-diligence");
    expect(toStageValue("Geprüft")).toBe("gepruft");
  });
});

describe("buildBoardFilter", () => {
  it("only adds the filters that are set", () => {
    expect(buildBoardFilter({})).toEqual({});
    expect(
      buildBoardFilter({
        q: " anna ",
        onlyMine: true,
        salesId: 4,
        contactType: "investor",
        tagId: 9,
        companyStage: "pre_seed",
      }),
    ).toEqual({
      q: "anna",
      sales_id: 4,
      contact_type: "investor",
      "tags@cs": "{9}",
      "company_stages@cs": "{pre_seed}",
    });
  });

  it("ignores only-mine without a user", () => {
    expect(buildBoardFilter({ onlyMine: true })).toEqual({});
  });
});

describe("buildColumnFilter", () => {
  it("selects contacts without a stage for the no-stage column", () => {
    expect(buildColumnFilter(NO_STAGE)).toEqual({ "lifecycle_stage@is": null });
    expect(buildColumnFilter("lead")).toEqual({ lifecycle_stage: "lead" });
  });
});

describe("buildStageChange", () => {
  it("resets the substatus and writes a note", () => {
    const now = new Date("2026-10-27T10:00:00.000Z");
    expect(
      buildStageChange({
        toStage: "prospect",
        fromLabel: "Lead",
        toLabel: "Prospect",
        now,
      }),
    ).toEqual({
      data: {
        lifecycle_stage: "prospect",
        lifecycle_substatus: null,
        lifecycle_updated_at: "2026-10-27T10:00:00.000Z",
      },
      noteText: "Stage: Lead -> Prospect",
    });
  });

  it("clears the stage when moved back to the no-stage column", () => {
    expect(
      buildStageChange({
        toStage: NO_STAGE,
        fromLabel: "Lead",
        toLabel: "No stage",
      }).data.lifecycle_stage,
    ).toBeNull();
  });
});

describe("applyPendingMoves", () => {
  const unassigned = [contact(1), contact(2)];
  const leads = [contact(3, "lead")];
  const move = { contact: contact(2), from: NO_STAGE, to: "lead", index: 0 };

  it("removes a moved card from its old column", () => {
    expect(
      applyPendingMoves(NO_STAGE, unassigned, [move]).map((c) => c.id),
    ).toEqual([1]);
  });

  it("inserts the card at the drop index with the new stage", () => {
    const next = applyPendingMoves("lead", leads, [move]);
    expect(next.map((c) => c.id)).toEqual([2, 3]);
    expect(next[0].lifecycle_stage).toBe("lead");
    expect(next[0].lifecycle_substatus).toBeNull();
    // the input stays untouched
    expect(leads).toHaveLength(1);
  });

  it("keeps the substatus when reordering within a column", () => {
    const next = applyPendingMoves(NO_STAGE, unassigned, [
      { contact: contact(1), from: NO_STAGE, to: NO_STAGE, index: 1 },
    ]);
    expect(next.map((c) => c.id)).toEqual([2, 1]);
    expect(next[1].lifecycle_stage).toBeNull();
    expect(next[1].lifecycle_substatus).toBe("New");
  });

  it("drops the card at the end when the index is past the list", () => {
    expect(
      applyPendingMoves("lead", leads, [{ ...move, index: 9 }]).map(
        (c) => c.id,
      ),
    ).toEqual([3, 2]);
  });
});
