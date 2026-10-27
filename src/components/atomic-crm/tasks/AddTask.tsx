import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  RecordRepresentation,
  required,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { SaveButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { TimeInput } from "../appointments/TimeInput";
import { DEFAULT_DURATION_MINUTES, toTaskDueDate } from "../appointments/slots";
import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const AddTask = ({
  selectContact,
  display = "chip",
}: {
  selectContact?: boolean;
  display?: "chip" | "icon";
}) => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const [update] = useUpdate();
  const notify = useNotify();
  const { taskTypes } = useConfigurationContext();
  const translate = useTranslate();
  const contact = useRecordContext();
  const [open, setOpen] = useState(false);
  const handleOpen = () => {
    setOpen(true);
  };

  const handleSuccess = async (data: any) => {
    setOpen(false);
    const contact = await dataProvider.getOne("contacts", {
      id: data.contact_id,
    });
    if (!contact.data) return;

    await update("contacts", {
      id: contact.data.id,
      data: { last_seen: new Date().toISOString() },
      previousData: contact.data,
    });

    notify("crm.tasks.added");
  };

  if (!identity) return null;

  return (
    <>
      {display === "icon" ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="p-2 cursor-pointer"
                onClick={handleOpen}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{translate("crm.tasks.create")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="my-2">
          <Button
            variant="outline"
            className="h-6 cursor-pointer"
            onClick={handleOpen}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            {translate("crm.tasks.add")}
          </Button>
        </div>
      )}

      <CreateBase
        resource="tasks"
        record={{
          type: "None",
          contact_id: contact?.id,
          due_date: new Date().toISOString().slice(0, 10),
          sales_id: identity.id,
        }}
        transform={({ time, ...data }) => ({
          ...data,
          ...toTaskDueDate(data.due_date, time),
          duration_minutes: time ? DEFAULT_DURATION_MINUTES : null,
        })}
        mutationOptions={{ onSuccess: handleSuccess }}
      >
        <Dialog open={open} onOpenChange={() => setOpen(false)}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {!selectContact
                    ? `${translate("crm.tasks.new_for")} `
                    : translate("crm.tasks.new")}
                  {!selectContact && (
                    <RecordRepresentation
                      record={contact}
                      resource="contacts"
                    />
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <TextInput
                  autoFocus
                  source="text"
                  label="crm.tasks.description"
                  validate={required()}
                  multiline
                  className="m-0"
                  helperText={false}
                />
                {selectContact && (
                  <ReferenceInput
                    source="contact_id"
                    reference="contacts_summary"
                  >
                    <AutocompleteInput
                      label="crm.schedule.contact"
                      optionText={contactOptionText}
                      helperText={false}
                      validate={required()}
                    />
                  </ReferenceInput>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <DateInput
                    source="due_date"
                    helperText={false}
                    validate={required()}
                  />
                  <TimeInput
                    source="time"
                    label={translate("crm.tasks.time_optional")}
                    helperText={false}
                  />
                  <SelectInput
                    source="type"
                    validate={required()}
                    choices={taskTypes.map((type) => ({
                      id: type,
                      name: type,
                    }))}
                    helperText={false}
                  />
                </div>
              </div>
              <DialogFooter className="w-full justify-end">
                <SaveButton />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </CreateBase>
    </>
  );
};
