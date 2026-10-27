import { addDays, format, isWeekend } from "date-fns";
import {
  Form,
  required,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useMemo, useState } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { contactOptionText } from "../misc/ContactOption";
import { useDateLocale, useLongDayFormat } from "../misc/useDateLocale";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Task } from "../types";
import { parseQuickEntry } from "./quickEntry";
import {
  DEFAULT_DURATION_MINUTES,
  DURATION_OPTIONS,
  buildSlots,
  busyRangesFromTasks,
  endTime,
  isSameDay,
  toDateValue,
  toLocalDay,
  toTaskDueDate,
} from "./slots";

interface ScheduleValues {
  contact_id?: Identifier;
  type: string;
  day: string;
  time: string | null;
  duration_minutes: number;
  text: string;
}

const PREFERRED_TYPES = ["Call", "Meeting", "Demo", "Follow-up", "Email"];

/** Up to six task types for the type buttons, appointment-like ones first. */
const visibleTaskTypes = (taskTypes: string[], current?: string) => {
  const usable = taskTypes.filter((type) => type !== "None");
  const ordered = [
    ...PREFERRED_TYPES.filter((type) => usable.includes(type)),
    ...usable.filter((type) => !PREFERRED_TYPES.includes(type)),
  ].slice(0, 6);
  return current && usable.includes(current) && !ordered.includes(current)
    ? [...ordered.slice(0, 5), current]
    : ordered;
};

const preferredType = (taskTypes: string[]) =>
  ["Call", "Meeting"].find((type) => taskTypes.includes(type)) ??
  taskTypes.find((type) => type !== "None") ??
  taskTypes[0] ??
  "";

/**
 * Dialog to put an appointment in the calendar: a task with a time of day
 * and a duration. Busy slots come from the current user's timed tasks.
 */
export const ScheduleDialog = ({
  open,
  onClose,
  contactId,
}: {
  open: boolean;
  onClose: () => void;
  contactId?: Identifier;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const { taskTypes } = useConfigurationContext();
  const [isSaving, setIsSaving] = useState(false);

  const defaultValues = useMemo<ScheduleValues>(
    () => ({
      contact_id: contactId,
      type: preferredType(taskTypes),
      day: toDateValue(new Date()),
      time: null,
      duration_minutes: DEFAULT_DURATION_MINUTES,
      text: "",
    }),
    // a fresh form each time the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contactId, taskTypes, open],
  );

  if (!identity) return null;

  const handleSubmit = async (values: Record<string, any>) => {
    const { contact_id, type, day, time, duration_minutes, text } =
      values as ScheduleValues;
    if (!contact_id || !time) return;
    setIsSaving(true);
    try {
      await dataProvider.create("tasks", {
        data: {
          contact_id,
          type,
          text: text?.trim() || null,
          ...toTaskDueDate(day, time),
          duration_minutes,
          sales_id: identity.id,
        },
      });
      const { data: contact } = await dataProvider.getOne("contacts", {
        id: contact_id,
      });
      if (contact) {
        await dataProvider.update("contacts", {
          id: contact.id,
          data: { last_seen: new Date().toISOString() },
          previousData: contact,
        });
      }
      notify("crm.schedule.saved", { type: "success" });
      refresh();
      onClose();
    } catch (error) {
      console.error("Failed to save the appointment", error);
      notify("crm.schedule.save_error", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl overflow-y-auto max-h-[92vh] top-[4vh] translate-y-0">
        <Form
          key={String(open)}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
        >
          <DialogHeader>
            <DialogTitle>{translate("crm.schedule.title")}</DialogTitle>
            <DialogDescription>
              {translate("crm.schedule.description")}
            </DialogDescription>
          </DialogHeader>
          <ScheduleFields salesId={identity.id} />
          <ScheduleFooter onClose={onClose} isSaving={isSaving} />
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const ScheduleFields = ({ salesId }: { salesId: Identifier }) => {
  const translate = useTranslate();
  const { taskTypes } = useConfigurationContext();
  const { setValue } = useFormContext();
  const currentType = useWatch({ name: "type" }) as string;
  const [quickEntry, setQuickEntry] = useState("");

  const handleQuickEntry = (value: string) => {
    setQuickEntry(value);
    const parsed = parseQuickEntry(value, new Date(), taskTypes);
    if (parsed.day)
      setValue("day", toDateValue(parsed.day), { shouldDirty: true });
    if (parsed.time) setValue("time", parsed.time, { shouldDirty: true });
    if (parsed.durationMinutes) {
      setValue("duration_minutes", parsed.durationMinutes, {
        shouldDirty: true,
      });
    }
    if (parsed.type) setValue("type", parsed.type, { shouldDirty: true });
    setValue("text", parsed.text, { shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="schedule-quick-entry">
          {translate("crm.schedule.quick_entry")}
        </Label>
        <Input
          id="schedule-quick-entry"
          value={quickEntry}
          onChange={(event) => handleQuickEntry(event.target.value)}
          placeholder={translate("crm.schedule.quick_entry_placeholder")}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          {translate("crm.schedule.quick_entry_help")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReferenceInput source="contact_id" reference="contacts_summary">
          <AutocompleteInput
            label={translate("crm.schedule.contact")}
            optionText={contactOptionText}
            helperText={false}
            validate={required()}
          />
        </ReferenceInput>
        <SegmentedInput
          name="type"
          label={translate("crm.schedule.type")}
          options={visibleTaskTypes(taskTypes, currentType).map((type) => ({
            value: type,
            label: type,
          }))}
        />
      </div>

      <DayInput />
      <TimeSlotsInput salesId={salesId} />

      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <SegmentedInput
          name="duration_minutes"
          label={translate("crm.schedule.duration")}
          options={DURATION_OPTIONS.map((minutes) => ({
            value: minutes,
            label: translate("crm.schedule.minutes", { smart_count: minutes }),
          }))}
        />
        <NoteInput />
      </div>
    </div>
  );
};

const SegmentedInput = <T extends string | number>({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: { value: T; label: string }[];
}) => {
  const { field } = useController({ name });
  return (
    <fieldset className="flex flex-col gap-2 min-w-0">
      <legend className="text-sm font-medium mb-2">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {options.map((option) => {
          const selected = field.value === option.value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => field.onChange(option.value)}
              className={cn(
                "flex-1 min-w-16 h-8 px-3 rounded-md text-sm font-medium transition-colors",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};

const DayInput = () => {
  const translate = useTranslate();
  const locale = useDateLocale();
  const { field } = useController({ name: "day", rules: { required: true } });
  const [showPicker, setShowPicker] = useState(false);

  const today = toLocalDay(new Date());
  const chips: { day: Date; top: string }[] = [
    { day: today, top: translate("crm.common.today") },
    { day: addDays(today, 1), top: translate("crm.common.tomorrow") },
  ];
  // the next working days after tomorrow
  for (
    let next = addDays(today, 2);
    chips.length < 5;
    next = addDays(next, 1)
  ) {
    if (!isWeekend(next)) {
      chips.push({ day: next, top: format(next, "EEEE", { locale }) });
    }
  }
  const selected = field.value ? toLocalDay(field.value) : undefined;
  const isChipDay = chips.some(
    (chip) => selected && isSameDay(chip.day, selected),
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium mb-2">
        {translate("crm.schedule.day")}
      </legend>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const isSelected = !!selected && isSameDay(chip.day, selected);
          return (
            <button
              key={chip.day.toISOString()}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                field.onChange(toDateValue(chip.day));
                setShowPicker(false);
              }}
              className={cn(
                "min-w-20 rounded-lg border px-3 py-1.5 text-left text-sm transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-accent",
              )}
            >
              <span className="block text-xs opacity-75">{chip.top}</span>
              <span className="block font-semibold">
                {format(chip.day, "EEE d", { locale })}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={showPicker || (!!selected && !isChipDay)}
          onClick={() => setShowPicker((value) => !value)}
          className={cn(
            "min-w-20 rounded-lg border px-3 py-1.5 text-left text-sm transition-colors",
            showPicker || (!!selected && !isChipDay)
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:bg-accent",
          )}
        >
          <span className="block text-xs opacity-75">
            {translate("crm.schedule.other_day")}
          </span>
          <span className="block font-semibold">
            {selected && !isChipDay
              ? format(selected, "EEE d MMM", { locale })
              : translate("crm.schedule.pick_date")}
          </span>
        </button>
      </div>
      {showPicker && (
        <Input
          type="date"
          aria-label={translate("crm.schedule.pick_date")}
          className="w-48"
          min={toDateValue(today)}
          value={field.value ?? ""}
          onChange={(event) =>
            event.target.value && field.onChange(event.target.value)
          }
        />
      )}
    </fieldset>
  );
};

const TimeSlotsInput = ({ salesId }: { salesId: Identifier }) => {
  const translate = useTranslate();
  const { field } = useController({ name: "time", rules: { required: true } });
  const dayValue = useWatch({ name: "day" }) as string;
  const day = toLocalDay(dayValue || new Date());
  const now = new Date();

  const { data: tasks } = useGetList<Task>("tasks", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "due_date", order: "ASC" },
    filter: {
      sales_id: salesId,
      has_time: true,
      "due_date@gte": day.toISOString(),
      "due_date@lt": addDays(day, 1).toISOString(),
    },
  });
  const slots = buildSlots({
    day,
    busy: busyRangesFromTasks(tasks ?? []),
    now,
  });
  const isToday = isSameDay(day, now);

  return (
    <fieldset className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <legend className="text-sm font-medium">
          {translate("crm.schedule.time")}
        </legend>
        <span className="text-xs text-muted-foreground">
          {translate(
            isToday
              ? "crm.schedule.slots_hint_today"
              : "crm.schedule.slots_hint",
          )}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {slots.map((slot) => {
          const unavailable = slot.taken || slot.past;
          const isSelected = field.value === slot.time;
          return (
            <button
              key={slot.time}
              type="button"
              disabled={unavailable}
              aria-pressed={isSelected}
              aria-label={`${slot.time} ${translate(
                slot.taken
                  ? "crm.schedule.slot_taken"
                  : slot.past
                    ? "crm.schedule.slot_past"
                    : "crm.schedule.slot_free",
              )}`}
              onClick={() => field.onChange(slot.time)}
              className={cn(
                "h-9 rounded-md border text-sm tabular-nums transition-colors",
                isSelected
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : unavailable
                    ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground/60"
                    : "border-border bg-background hover:bg-accent",
                slot.taken && "line-through",
              )}
            >
              {slot.time}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Label
          htmlFor="schedule-custom-time"
          className="text-xs text-muted-foreground"
        >
          {translate("crm.schedule.custom_time")}
        </Label>
        <Input
          id="schedule-custom-time"
          type="time"
          step={300}
          className="w-32"
          value={field.value ?? ""}
          onChange={(event) => field.onChange(event.target.value || null)}
        />
      </div>
    </fieldset>
  );
};

const NoteInput = () => {
  const translate = useTranslate();
  const { field } = useController({ name: "text" });
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="schedule-note">{translate("crm.schedule.note")}</Label>
      <Textarea
        id="schedule-note"
        rows={1}
        className="min-h-9"
        placeholder={translate("crm.schedule.note_placeholder")}
        {...field}
        value={field.value ?? ""}
      />
    </div>
  );
};

const ScheduleFooter = ({
  onClose,
  isSaving,
}: {
  onClose: () => void;
  isSaving: boolean;
}) => {
  const translate = useTranslate();
  const locale = useDateLocale();
  const longDay = useLongDayFormat();
  const [contactId, type, day, time, duration] = useWatch({
    name: ["contact_id", "type", "day", "time", "duration_minutes"],
  });
  const ready = !!contactId && !!time && !!day;

  return (
    <DialogFooter className="flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
      <div className="mr-auto text-sm" aria-live="polite">
        {time && day ? (
          <>
            <div className="font-semibold">
              {format(toLocalDay(day), longDay, { locale })},{" "}
              {translate("crm.schedule.time_range", {
                start: time,
                end: endTime(time, duration || DEFAULT_DURATION_MINUTES),
              })}
            </div>
            <div className="text-muted-foreground">
              {type} ·{" "}
              {translate("crm.schedule.minutes", { smart_count: duration })}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">
            {translate(
              !time ? "crm.schedule.pick_time" : "crm.schedule.pick_contact",
            )}
          </span>
        )}
        {time && !contactId && (
          <div className="text-muted-foreground">
            {translate("crm.schedule.pick_contact")}
          </div>
        )}
      </div>
      <Button type="button" variant="outline" onClick={onClose}>
        {translate("ra.action.cancel")}
      </Button>
      <Button type="submit" disabled={!ready || isSaving}>
        {translate(isSaving ? "crm.schedule.saving" : "crm.schedule.save")}
      </Button>
    </DialogFooter>
  );
};
