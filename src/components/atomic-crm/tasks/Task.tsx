import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import {
  useDeleteWithUndoController,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useEffect, useState } from "react";
import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { formatTime, postponedDueDate } from "../appointments/slots";
import type { Contact, Task as TData } from "../types";
import { TaskEdit } from "./TaskEdit";

export const Task = ({
  task,
  showContact,
}: {
  task: TData;
  showContact?: boolean;
}) => {
  const notify = useNotify();
  const translate = useTranslate();
  const queryClient = useQueryClient();

  const [openEdit, setOpenEdit] = useState(false);

  const handleCloseEdit = () => {
    setOpenEdit(false);
  };

  const [update, { isPending: isUpdatePending, isSuccess, variables }] =
    useUpdate();
  const { handleDelete } = useDeleteWithUndoController({
    record: task,
    redirect: false,
    mutationOptions: {
      onSuccess() {
        notify("crm.tasks.deleted", { undoable: true });
      },
    },
  });

  const handleEdit = () => {
    setOpenEdit(true);
  };

  const handleCheck = () => () => {
    update("tasks", {
      id: task.id,
      data: {
        done_date: task.done_date ? null : new Date().toISOString(),
      },
      previousData: task,
    });
  };

  useEffect(() => {
    // We do not want to invalidate the query when a tack is checked or unchecked
    if (
      isUpdatePending ||
      !isSuccess ||
      variables?.data?.done_date != undefined
    ) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tasks", "getList"] });
  }, [queryClient, isUpdatePending, isSuccess, variables]);

  const labelId = `checkbox-list-label-${task.id}`;

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 flex-1">
          <Checkbox
            id={labelId}
            checked={!!task.done_date}
            onCheckedChange={handleCheck()}
            disabled={isUpdatePending}
            className="mt-1"
          />
          <div className={`flex-grow ${task.done_date ? "line-through" : ""}`}>
            <div className="text-sm">
              {task.type && task.type !== "None" && (
                <>
                  <span className="font-semibold text-sm">{task.type}</span>
                  &nbsp;
                </>
              )}
              {task.text}
            </div>
            <div className="text-sm text-muted-foreground">
              {translate("crm.tasks.due")}&nbsp;
              <DateField source="due_date" record={task} />
              {task.has_time && (
                <>
                  {" "}
                  {formatTime(new Date(task.due_date))}
                  {task.duration_minutes
                    ? ` · ${translate("crm.schedule.minutes", {
                        smart_count: task.duration_minutes,
                      })}`
                    : null}
                </>
              )}
              {showContact && (
                <ReferenceField<TData, Contact>
                  source="contact_id"
                  reference="contacts"
                  record={task}
                  link="show"
                  className="inline text-sm text-muted-foreground"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <>
                        {" "}
                        (Re:&nbsp;
                        {referenceRecord?.first_name}{" "}
                        {referenceRecord?.last_name})
                      </>
                    );
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 pr-0! size-8 cursor-pointer"
              aria-label="task actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: postponedDueDate(task, 1),
                  },
                  previousData: task,
                });
              }}
            >
              {translate("crm.tasks.postpone_tomorrow")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: postponedDueDate(task, 7),
                  },
                  previousData: task,
                });
              }}
            >
              {translate("crm.tasks.postpone_next_week")}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={handleEdit}>
              {translate("ra.action.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={handleDelete}>
              {translate("ra.action.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* This part is for editing the Task directly via a Dialog */}
      {openEdit && (
        <TaskEdit taskId={task.id} open={openEdit} close={handleCloseEdit} />
      )}
    </>
  );
};
