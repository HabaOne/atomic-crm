import { Droppable } from "@hello-pangea/dnd";
import { useGetList, useTranslate } from "ra-core";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Contact } from "../types";
import { ContactBoardCard } from "./ContactBoardCard";
import {
  applyPendingMoves,
  buildColumnFilter,
  type PendingMove,
} from "./boardLogic";
import { NO_STAGE, type ContactStage } from "./contactStages";

const PAGE_SIZE = 25;

export const ContactBoardColumn = ({
  columnId,
  stage,
  label,
  color,
  filter,
  pendingMoves,
  onContactsLoaded,
  onSubstatusChange,
}: {
  columnId: string;
  stage?: ContactStage;
  label: string;
  color?: string;
  filter: Record<string, unknown>;
  pendingMoves: PendingMove[];
  onContactsLoaded: (contacts: Contact[]) => void;
  onSubstatusChange: (contact: Contact, substatus: string | null) => void;
}) => {
  const translate = useTranslate();
  const [perPage, setPerPage] = useState(PAGE_SIZE);
  const filterKey = JSON.stringify(filter);
  useEffect(() => setPerPage(PAGE_SIZE), [filterKey]);

  const { data, total, isPending } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage },
      sort:
        columnId === NO_STAGE
          ? { field: "first_seen", order: "DESC" }
          : { field: "lifecycle_updated_at", order: "DESC" },
      filter: { ...filter, ...buildColumnFilter(columnId) },
    },
    { placeholderData: (previous) => previous },
  );

  useEffect(() => {
    if (data) onContactsLoaded(data);
  }, [data, onContactsLoaded]);

  const contacts = applyPendingMoves(columnId, data ?? [], pendingMoves);
  const incoming = pendingMoves.filter(
    (move) => move.to === columnId && move.from !== columnId,
  ).length;
  const outgoing = pendingMoves.filter(
    (move) => move.from === columnId && move.to !== columnId,
  ).length;
  const count = total != null ? total + incoming - outgoing : undefined;
  const hasMore = (data?.length ?? 0) < (total ?? 0);

  return (
    <section
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl p-3",
        columnId === NO_STAGE ? "bg-muted/60" : "bg-muted",
      )}
      aria-label={label}
    >
      <div className="flex items-center gap-2 px-1 pb-1">
        {color && (
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        )}
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {count ?? ""}
        </span>
      </div>
      <p className="min-h-4 px-1 pb-2 text-xs text-muted-foreground">
        {columnId === NO_STAGE
          ? translate("crm.board.no_stage_hint")
          : stage?.substatuses.join(", ")}
      </p>
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-24 flex-1 flex-col rounded-xl transition-colors",
              snapshot.isDraggingOver &&
                "bg-background/70 outline-2 outline-dashed outline-border",
            )}
          >
            {contacts.map((contact, index) => (
              <ContactBoardCard
                key={contact.id}
                contact={contact}
                index={index}
                stage={stage}
                onSubstatusChange={onSubstatusChange}
              />
            ))}
            {provided.placeholder}
            {!isPending &&
              contacts.length === 0 &&
              !snapshot.isDraggingOver && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  {translate("crm.board.empty_column")}
                </p>
              )}
          </div>
        )}
      </Droppable>
      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1"
          onClick={() => setPerPage((value) => value + PAGE_SIZE)}
        >
          {translate("crm.board.show_more", {
            smart_count: Math.min(
              PAGE_SIZE,
              (total ?? 0) - (data?.length ?? 0),
            ),
          })}
        </Button>
      )}
    </section>
  );
};
