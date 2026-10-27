import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { distinctValues } from "../dashboard/notContactedFilter";
import type { Company, Contact, Tag } from "../types";
import { ContactBoardColumn } from "./ContactBoardColumn";
import {
  COMPANY_STAGE_VALUES,
  buildBoardFilter,
  type PendingMove,
} from "./boardLogic";
import { NO_STAGE } from "./contactStages";
import { useChangeContactStage } from "./useChangeContactStage";
import { useContactStages } from "./useContactStages";

/**
 * Contacts grouped by lifecycle stage. Dragging a card to another column
 * changes the stage and writes a system note on the contact.
 */
export const ContactBoard = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const { stages, isPending: stagesPending } = useContactStages();
  const { changeStage, stageLabel } = useChangeContactStage(stages);

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [contactType, setContactType] = useState("");
  const [tagId, setTagId] = useState("");
  const [companyStage, setCompanyStage] = useState("");
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const contactsById = useRef(new Map<Identifier, Contact>());

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: tags } = useGetList<Tag>("tags", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
  });
  const { data: typeRows } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "id", order: "ASC" },
    filter: { "contact_type@not.is": null },
    meta: { columns: ["id", "contact_type"] },
  });
  const contactTypes = distinctValues(typeRows, (row) => row.contact_type);
  // The stage focus filter only makes sense once companies carry stages
  const { total: stagedCompanies } = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
    filter: { "stages@not.is": null },
    meta: { columns: ["id"] },
  });

  const filter = useMemo(
    () =>
      buildBoardFilter({
        q,
        onlyMine,
        salesId: identity?.id,
        contactType,
        tagId: tagId || undefined,
        companyStage,
      }),
    [q, onlyMine, identity?.id, contactType, tagId, companyStage],
  );

  const handleContactsLoaded = useCallback((contacts: Contact[]) => {
    for (const contact of contacts)
      contactsById.current.set(contact.id, contact);
  }, []);

  const invalidateContacts = () =>
    queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const onDragEnd: OnDragEndResponder = async ({
    draggableId,
    source,
    destination,
  }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    const contact = contactsById.current.get(
      Array.from(contactsById.current.keys()).find(
        (id) => String(id) === draggableId,
      ) as Identifier,
    );
    if (!contact) return;

    const move: PendingMove = {
      contact,
      from: source.droppableId,
      to: destination.droppableId,
      index: destination.index,
    };
    setPendingMoves((moves) => [
      ...moves.filter((item) => item.contact.id !== contact.id),
      move,
    ]);
    try {
      await changeStage(contact, move.to);
      notify("crm.board.moved", {
        type: "info",
        messageArgs: {
          name: contact.first_name ?? "",
          stage: stageLabel(move.to),
        },
      });
    } catch (error) {
      console.error("Failed to move the contact", error);
      notify("crm.board.move_error", { type: "error" });
    } finally {
      setPendingMoves((moves) => moves.filter((item) => item !== move));
    }
  };

  const handleSubstatusChange = async (
    contact: Contact,
    substatus: string | null,
  ) => {
    try {
      await dataProvider.update("contacts", {
        id: contact.id,
        data: { lifecycle_substatus: substatus },
        previousData: contact,
      });
      await invalidateContacts();
    } catch (error) {
      console.error("Failed to update the substatus", error);
      notify("crm.board.move_error", { type: "error" });
    }
  };

  if (stagesPending) return null;

  const selectClass =
    "h-9 rounded-md border bg-background px-2 text-sm text-foreground";

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-semibold">
          {translate("crm.board.title")}
        </h1>
        <div className="relative w-full max-w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={translate("crm.board.search")}
            aria-label={translate("crm.board.search")}
            className="pl-8"
          />
        </div>
        <div className="flex h-9 items-center gap-2 rounded-md border px-3">
          <Switch
            id="board-only-mine"
            checked={onlyMine}
            onCheckedChange={setOnlyMine}
          />
          <Label htmlFor="board-only-mine" className="text-sm font-normal">
            {translate("crm.board.only_mine")}
          </Label>
        </div>
        {contactTypes.length > 0 && (
          <select
            aria-label={translate("crm.board.contact_type")}
            className={selectClass}
            value={contactType}
            onChange={(event) => setContactType(event.target.value)}
          >
            <option value="">{translate("crm.board.all_types")}</option>
            {contactTypes.map((type) => (
              <option key={type} value={type}>
                {translate(`crm.contact_types.${type}`, {
                  _: type.charAt(0).toUpperCase() + type.slice(1),
                })}
              </option>
            ))}
          </select>
        )}
        {tags && tags.length > 0 && (
          <select
            aria-label={translate("crm.board.tag")}
            className={selectClass}
            value={tagId}
            onChange={(event) => setTagId(event.target.value)}
          >
            <option value="">{translate("crm.board.any_tag")}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={String(tag.id)}>
                {tag.name}
              </option>
            ))}
          </select>
        )}
        {!!stagedCompanies && (
          <select
            aria-label={translate("crm.board.stage_focus")}
            className={selectClass}
            value={companyStage}
            onChange={(event) => setCompanyStage(event.target.value)}
          >
            <option value="">{translate("crm.board.any_stage_focus")}</option>
            {COMPANY_STAGE_VALUES.map((value) => (
              <option key={value} value={value}>
                {translate(`crm.company_stages.${value}`)}
              </option>
            ))}
          </select>
        )}
        <p className="basis-full text-xs text-muted-foreground lg:ml-auto lg:basis-auto">
          {translate("crm.board.drag_hint")}
        </p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          <ContactBoardColumn
            columnId={NO_STAGE}
            label={translate("crm.board.no_stage")}
            filter={filter}
            pendingMoves={pendingMoves}
            onContactsLoaded={handleContactsLoaded}
            onSubstatusChange={handleSubstatusChange}
          />
          {stages.map((stage) => (
            <ContactBoardColumn
              key={stage.value}
              columnId={stage.value}
              stage={stage}
              label={stage.label}
              color={stage.color}
              filter={filter}
              pendingMoves={pendingMoves}
              onContactsLoaded={handleContactsLoaded}
              onSubstatusChange={handleSubstatusChange}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

ContactBoard.path = "/board";
