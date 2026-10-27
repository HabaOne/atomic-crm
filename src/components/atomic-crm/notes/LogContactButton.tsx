import { MessageSquarePlus } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Contact } from "../types";

/**
 * Quick way to record that someone was contacted: writes a contact note,
 * which takes the contact off the "Not contacted yet" list.
 */
export const LogContactButton = ({ contact }: { contact: Contact }) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
  const label = translate("crm.log_contact.button", { name });

  const handleSave = async () => {
    if (!identity || !text.trim()) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      await dataProvider.create("contact_notes", {
        data: {
          contact_id: contact.id,
          text: text.trim(),
          date: now,
          sales_id: identity.id,
          status: contact.status || "warm",
        },
      });
      await dataProvider.update("contacts", {
        id: contact.id,
        data: { last_seen: now },
        previousData: contact,
      });
      notify("crm.log_contact.saved", { type: "success" });
      setOpen(false);
      setText("");
      refresh();
    } catch (error) {
      console.error("Failed to log the contact", error);
      notify("crm.log_contact.save_error", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              aria-label={label}
              onClick={() => setOpen(true)}
            >
              <MessageSquarePlus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {translate("crm.log_contact.tooltip")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {translate("crm.log_contact.title", { name })}
            </DialogTitle>
            <DialogDescription>
              {translate("crm.log_contact.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`log-contact-${contact.id}`}>
              {translate("crm.log_contact.note")}
            </Label>
            <Textarea
              id={`log-contact-${contact.id}`}
              autoFocus
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={translate("crm.log_contact.placeholder")}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {translate("ra.action.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!text.trim() || isSaving}
              onClick={handleSave}
            >
              {translate("crm.log_contact.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
