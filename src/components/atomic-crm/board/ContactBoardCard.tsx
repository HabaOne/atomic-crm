import { Draggable } from "@hello-pangea/dnd";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, GripVertical } from "lucide-react";
import { useTranslate } from "ra-core";
import { Link } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { Avatar } from "../contacts/Avatar";
import { useDateLocale } from "../misc/useDateLocale";
import type { Contact } from "../types";
import type { ContactStage } from "./contactStages";

export const ContactBoardCard = ({
  contact,
  index,
  stage,
  onSubstatusChange,
}: {
  contact: Contact;
  index: number;
  stage?: ContactStage;
  onSubstatusChange: (contact: Contact, substatus: string | null) => void;
}) => (
  <Draggable draggableId={String(contact.id)} index={index}>
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        className="mb-2 outline-none"
      >
        <ContactBoardCardContent
          contact={contact}
          stage={stage}
          isDragging={snapshot.isDragging}
          onSubstatusChange={onSubstatusChange}
        />
      </div>
    )}
  </Draggable>
);

const ContactBoardCardContent = ({
  contact,
  stage,
  isDragging,
  onSubstatusChange,
}: {
  contact: Contact;
  stage?: ContactStage;
  isDragging: boolean;
  onSubstatusChange: (contact: Contact, substatus: string | null) => void;
}) => {
  const translate = useTranslate();
  const locale = useDateLocale();
  const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

  return (
    <div
      className={cn(
        "flex cursor-grab flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm transition-shadow",
        isDragging && "rotate-[-2deg] shadow-lg",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar record={contact} width={25} height={25} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/contacts/${contact.id}/show`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {name || translate("crm.board.unnamed")}
          </Link>
          {(contact.company_name || contact.title) && (
            <div className="truncate text-xs text-muted-foreground">
              {contact.company_name ?? contact.title}
            </div>
          )}
        </div>
        <GripVertical
          className="size-4 shrink-0 text-muted-foreground/60"
          aria-hidden
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {stage && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold hover:bg-accent"
              aria-label={translate("crm.board.change_substatus", { name })}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {contact.lifecycle_substatus ||
                translate("crm.board.set_substatus")}
              <ChevronDown className="size-3" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {stage.substatuses.map((substatus) => (
                <DropdownMenuItem
                  key={substatus}
                  onClick={() => onSubstatusChange(contact, substatus)}
                >
                  {substatus}
                </DropdownMenuItem>
              ))}
              {stage.substatuses.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => onSubstatusChange(contact, null)}
              >
                {translate("crm.board.clear_substatus")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="text-xs text-muted-foreground">
          {contact.is_contacted && contact.last_contacted_at
            ? translate("crm.board.last_contact", {
                time: formatDistanceToNow(new Date(contact.last_contacted_at), {
                  locale,
                  addSuffix: true,
                }),
              })
            : translate("crm.board.not_contacted")}
        </span>
      </div>
      {contact.company_stages && contact.company_stages.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {contact.company_stages.map((value) => (
            <span
              key={value}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {translate(`crm.company_stages.${value}`, { _: value })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
