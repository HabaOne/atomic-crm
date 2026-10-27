import {
  resolveContactStages,
  type ContactStage,
} from "../board/contactStages";

/** A stage as edited in the form: substatuses as one comma-separated text. */
export interface ContactStageFormValue {
  value: string;
  label: string;
  color: string;
  substatuses: string;
}

export const toContactStageFormValues = (
  raw: unknown,
): ContactStageFormValue[] =>
  resolveContactStages(raw).map((stage) => ({
    ...stage,
    substatuses: stage.substatuses.join(", "),
  }));

export const fromContactStageFormValues = (raw: unknown): ContactStage[] =>
  resolveContactStages(raw);
