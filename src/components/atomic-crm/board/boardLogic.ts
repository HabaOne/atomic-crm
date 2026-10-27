import type { Identifier } from "ra-core";

import type { Contact } from "../types";
import { NO_STAGE } from "./contactStages";

export type ContactsByColumn = Record<string, Contact[]>;

/** Company stage values written by the investor import. */
export const COMPANY_STAGE_VALUES = [
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "growth",
  "late",
] as const;

export interface BoardFilterValues {
  q?: string;
  onlyMine?: boolean;
  salesId?: Identifier;
  contactType?: string;
  tagId?: Identifier;
  companyStage?: string;
}

/** Filter for the contacts list behind the board (contacts_summary view). */
export const buildBoardFilter = ({
  q,
  onlyMine,
  salesId,
  contactType,
  tagId,
  companyStage,
}: BoardFilterValues): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};
  if (q && q.trim()) filter.q = q.trim();
  if (onlyMine && salesId != null) filter.sales_id = salesId;
  if (contactType) filter.contact_type = contactType;
  if (tagId != null && tagId !== "") filter["tags@cs"] = `{${tagId}}`;
  if (companyStage) filter["company_stages@cs"] = `{${companyStage}}`;
  return filter;
};

/** Filter that selects one board column. */
export const buildColumnFilter = (
  stageValue: string,
): Record<string, unknown> =>
  stageValue === NO_STAGE
    ? { "lifecycle_stage@is": null }
    : { lifecycle_stage: stageValue };

export interface StageChange {
  data: Pick<
    Contact,
    "lifecycle_stage" | "lifecycle_substatus" | "lifecycle_updated_at"
  >;
  noteText: string;
}

/**
 * The contact update and the note text for moving a contact to another
 * column. The substatus is reset because it belongs to the old stage.
 */
export const buildStageChange = ({
  toStage,
  fromLabel,
  toLabel,
  now = new Date(),
}: {
  toStage: string;
  fromLabel: string;
  toLabel: string;
  now?: Date;
}): StageChange => ({
  data: {
    lifecycle_stage: toStage === NO_STAGE ? null : toStage,
    lifecycle_substatus: null,
    lifecycle_updated_at: now.toISOString(),
  },
  noteText: `Stage: ${fromLabel} -> ${toLabel}`,
});

export interface PendingMove {
  contact: Contact;
  from: string;
  to: string;
  index: number;
}

/**
 * The cards of one column with the moves that are still being saved:
 * moved cards leave their old column and appear at the drop index of the
 * new one, so the board updates before the server answers.
 */
export const applyPendingMoves = (
  column: string,
  contacts: Contact[],
  moves: PendingMove[],
): Contact[] => {
  const movedIds = new Set(moves.map((move) => move.contact.id));
  const result = contacts.filter((contact) => !movedIds.has(contact.id));
  for (const move of moves) {
    if (move.to !== column) continue;
    result.splice(Math.min(move.index, result.length), 0, {
      ...move.contact,
      lifecycle_stage: column === NO_STAGE ? null : column,
      lifecycle_substatus:
        move.from === move.to ? move.contact.lifecycle_substatus : null,
    });
  }
  return result;
};
