import { useNotify, useRecordContext, useTranslate } from "ra-core";
import { useState } from "react";
import { Link } from "react-router";

import type { Contact } from "../types";
import { NO_STAGE, findStage } from "./contactStages";
import { useChangeContactStage } from "./useChangeContactStage";
import { useContactStages } from "./useContactStages";

/** Board stage of the current contact, changeable without the board. */
export const ContactStageSelect = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const contact = useRecordContext<Contact>();
  const { stages } = useContactStages();
  const { changeStage } = useChangeContactStage(stages);
  const [isSaving, setIsSaving] = useState(false);
  if (!contact) return null;

  const stage = findStage(stages, contact.lifecycle_stage);

  const handleChange = async (value: string) => {
    setIsSaving(true);
    try {
      await changeStage(contact, value);
    } catch (error) {
      console.error("Failed to change the stage", error);
      notify("crm.board.move_error", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full border"
          style={{
            backgroundColor: stage?.color ?? "transparent",
            borderColor: stage?.color ?? "var(--border)",
          }}
          aria-hidden
        />
        <select
          aria-label={translate("crm.board.stage")}
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
          value={stage?.value ?? NO_STAGE}
          disabled={isSaving}
          onChange={(event) => handleChange(event.target.value)}
        >
          <option value={NO_STAGE}>{translate("crm.board.no_stage")}</option>
          {stages.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {contact.lifecycle_substatus && (
        <span className="text-xs text-muted-foreground">
          {contact.lifecycle_substatus}
        </span>
      )}
      <Link to="/board" className="text-xs font-medium hover:underline">
        {translate("crm.dashboard.open_board")}
      </Link>
    </div>
  );
};
