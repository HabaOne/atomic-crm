import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslate } from "ra-core";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { DEFAULT_STAGE_COLOR } from "../board/contactStages";

const FIELD = "settings.contactStages";

/** Editor for the organization's contact board columns. */
export const ContactStagesInput = () => {
  const translate = useTranslate();
  const { register } = useFormContext();
  const { fields, append, remove, move } = useFieldArray({ name: FIELD });

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden grid-cols-[3rem_1fr_2fr_auto] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
        <span>{translate("crm.settings.stage_color")}</span>
        <span>{translate("crm.settings.stage_label")}</span>
        <span>{translate("crm.settings.stage_substatuses")}</span>
        <span className="w-28" />
      </div>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-[3rem_1fr] items-center gap-2 sm:grid-cols-[3rem_1fr_2fr_auto]"
        >
          <Input
            type="color"
            aria-label={translate("crm.settings.stage_color")}
            className="h-9 w-12 p-1"
            {...register(`${FIELD}.${index}.color`)}
          />
          <Input
            aria-label={translate("crm.settings.stage_label")}
            placeholder={translate("crm.settings.stage_label")}
            {...register(`${FIELD}.${index}.label`, { required: true })}
          />
          <Input
            aria-label={translate("crm.settings.stage_substatuses")}
            placeholder={translate(
              "crm.settings.stage_substatuses_placeholder",
            )}
            className="col-span-2 sm:col-span-1"
            {...register(`${FIELD}.${index}.substatuses`)}
          />
          <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={translate("ra.action.move_up")}
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={translate("ra.action.move_down")}
              disabled={index === fields.length - 1}
              onClick={() => move(index, index + 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={translate("ra.action.remove")}
              disabled={fields.length <= 1}
              onClick={() => remove(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              value: "",
              label: "",
              color: DEFAULT_STAGE_COLOR,
              substatuses: "",
            })
          }
        >
          <Plus className="size-4" />
          {translate("crm.settings.add_stage")}
        </Button>
        <Label className="text-xs font-normal text-muted-foreground">
          {translate("crm.settings.stages_help")}
        </Label>
      </div>
    </div>
  );
};
