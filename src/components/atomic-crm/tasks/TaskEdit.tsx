import {
  EditBase,
  Form,
  required,
  useNotify,
  useRecordContext,
  useTranslate,
  type Identifier,
} from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { TextInput } from "@/components/admin/text-input";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { SaveButton } from "@/components/admin/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { TimeInput } from "../appointments/TimeInput";
import {
  DEFAULT_DURATION_MINUTES,
  formatTime,
  toTaskDueDate,
} from "../appointments/slots";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Task } from "../types";

export const TaskEdit = ({
  open,
  close,
  taskId,
}: {
  taskId: Identifier;
  open: boolean;
  close: () => void;
}) => {
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const translate = useTranslate();
  return (
    <Dialog open={open} onOpenChange={close}>
      {taskId && (
        <EditBase
          id={taskId}
          resource="tasks"
          className="mt-0"
          mutationOptions={{
            onSuccess: () => {
              close();
              notify("crm.tasks.updated", {
                type: "info",
                undoable: true,
              });
            },
          }}
          redirect={false}
          transform={({ time, ...data }: Task & { time?: string | null }) => ({
            ...data,
            ...toTaskDueDate(data.due_date, time),
            duration_minutes: time
              ? data.duration_minutes || DEFAULT_DURATION_MINUTES
              : null,
          })}
        >
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{translate("crm.tasks.edit")}</DialogTitle>
              </DialogHeader>
              <TextInput
                autoFocus
                source="text"
                label="crm.tasks.description"
                validate={required()}
                multiline
                helperText={false}
              />
              <div className="grid grid-cols-3 gap-4">
                <DateInput
                  source="due_date"
                  helperText={false}
                  validate={required()}
                />
                <TaskTimeInput />
                <SelectInput
                  source="type"
                  choices={taskTypes.map((type) => ({
                    id: type,
                    name: type,
                  }))}
                  helperText={false}
                  validate={required()}
                />
              </div>
              <DialogFooter className="w-full sm:justify-between gap-4">
                <DeleteButton
                  mutationOptions={{
                    onSuccess: () => {
                      close();
                      notify("crm.tasks.deleted", {
                        type: "info",
                        undoable: true,
                      });
                    },
                  }}
                  redirect={false}
                />
                <SaveButton label="ra.action.save" />
              </DialogFooter>
            </Form>
          </DialogContent>
        </EditBase>
      )}
    </Dialog>
  );
};

/** Time of a timed task, empty for a date-only task. */
const TaskTimeInput = () => {
  const translate = useTranslate();
  const record = useRecordContext<Task>();
  return (
    <TimeInput
      source="time"
      label={translate("crm.tasks.time_optional")}
      helperText={false}
      defaultValue={
        record?.has_time && record.due_date
          ? formatTime(new Date(record.due_date))
          : null
      }
    />
  );
};
