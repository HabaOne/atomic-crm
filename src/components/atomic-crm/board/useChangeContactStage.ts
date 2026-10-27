import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, useTranslate } from "ra-core";
import { useCallback } from "react";

import type { Contact } from "../types";
import { buildStageChange } from "./boardLogic";
import { NO_STAGE, findStage, type ContactStage } from "./contactStages";

/**
 * Moves a contact to another lifecycle stage and records the move as a
 * system note (system notes do not count as having contacted the person).
 */
export const useChangeContactStage = (stages: ContactStage[]) => {
  const dataProvider = useDataProvider();
  const queryClient = useQueryClient();
  const translate = useTranslate();
  const { identity } = useGetIdentity();

  const stageLabel = useCallback(
    (value: string | null | undefined) =>
      !value || value === NO_STAGE
        ? translate("crm.board.no_stage")
        : (findStage(stages, value)?.label ?? value),
    [stages, translate],
  );

  const changeStage = useCallback(
    async (contact: Contact, toStage: string) => {
      if (!identity) throw new Error("No current user");
      const change = buildStageChange({
        toStage,
        fromLabel: stageLabel(contact.lifecycle_stage),
        toLabel: stageLabel(toStage),
      });
      await dataProvider.update("contacts", {
        id: contact.id,
        data: change.data,
        previousData: contact,
      });
      await dataProvider.create("contact_notes", {
        data: {
          contact_id: contact.id,
          text: change.noteText,
          date: new Date().toISOString(),
          sales_id: identity.id,
          status: contact.status ?? null,
          is_system: true,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contacts"] }),
        queryClient.invalidateQueries({ queryKey: ["contact_notes"] }),
      ]);
    },
    [dataProvider, identity, queryClient, stageLabel],
  );

  return { changeStage, stageLabel };
};
