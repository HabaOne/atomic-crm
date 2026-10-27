import { formatDistanceToNow } from "date-fns";
import { UserPlus } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ScheduleButton } from "../appointments/ScheduleButton";
import { findStage } from "../board/contactStages";
import { useContactStages } from "../board/useContactStages";
import { Avatar } from "../contacts/Avatar";
import { useDateLocale } from "../misc/useDateLocale";
import { LogContactButton } from "../notes/LogContactButton";
import type { Contact } from "../types";
import {
  buildNotContactedFilter,
  distinctValues,
  type NotContactedScope,
} from "./notContactedFilter";

const PER_PAGE = 8;

/** Contacts without a note or a done task yet. */
export const NotContacted = () => {
  const translate = useTranslate();
  const locale = useDateLocale();
  const { identity } = useGetIdentity();
  const { stages } = useContactStages();
  const [scope, setScope] = useState<NotContactedScope>("mine");
  const [contactType, setContactType] = useState<string>();
  const [addedThisWeek, setAddedThisWeek] = useState(false);
  const [order, setOrder] = useState<"ASC" | "DESC">("ASC");
  const [page, setPage] = useState(1);

  const { data: typeRows } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "id", order: "ASC" },
    filter: { "contact_type@not.is": null },
    meta: { columns: ["id", "contact_type"] },
  });
  const contactTypes = distinctValues(typeRows, (row) => row.contact_type);

  const {
    data: contacts,
    total,
    isPending,
  } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page, perPage: PER_PAGE },
      sort: { field: "first_seen", order },
      filter: buildNotContactedFilter({
        scope,
        salesId: identity?.id,
        contactType,
        addedThisWeek,
      }),
    },
    { enabled: !!identity, placeholderData: (previous) => previous },
  );
  const pages = Math.max(1, Math.ceil((total ?? 0) / PER_PAGE));

  const chip = (selected: boolean) =>
    cn(
      "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
      selected
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background hover:bg-accent",
    );

  const resetPage = () => setPage(1);

  return (
    <section
      className="flex flex-col gap-2"
      aria-labelledby="not-contacted-title"
    >
      <div className="flex items-center min-h-9">
        <UserPlus className="mr-3 size-6 text-muted-foreground" aria-hidden />
        <h2
          id="not-contacted-title"
          className="flex-1 text-xl font-semibold text-muted-foreground"
        >
          {translate("crm.dashboard.not_contacted")}
        </h2>
        {total != null && (
          <span className="text-sm text-muted-foreground">
            {translate("crm.dashboard.contacts_count", { smart_count: total })}
          </span>
        )}
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-3">
          <button
            type="button"
            aria-pressed={scope === "mine"}
            className={chip(scope === "mine")}
            onClick={() => {
              setScope("mine");
              resetPage();
            }}
          >
            {translate("crm.common.mine")}
          </button>
          <button
            type="button"
            aria-pressed={scope === "everyone"}
            className={chip(scope === "everyone")}
            onClick={() => {
              setScope("everyone");
              resetPage();
            }}
          >
            {translate("crm.common.everyone")}
          </button>
          {contactTypes.length > 0 && (
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          )}
          {contactTypes.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={contactType === type}
              className={chip(contactType === type)}
              onClick={() => {
                setContactType((value) => (value === type ? undefined : type));
                resetPage();
              }}
            >
              {translate(`crm.contact_types.${type}`, {
                _: type.charAt(0).toUpperCase() + type.slice(1),
              })}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={addedThisWeek}
            className={chip(addedThisWeek)}
            onClick={() => {
              setAddedThisWeek((value) => !value);
              resetPage();
            }}
          >
            {translate("crm.dashboard.added_this_week")}
          </button>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            {translate("crm.common.sort")}
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
              value={order}
              onChange={(event) => {
                setOrder(event.target.value as "ASC" | "DESC");
                resetPage();
              }}
            >
              <option value="ASC">
                {translate("crm.dashboard.oldest_first")}
              </option>
              <option value="DESC">
                {translate("crm.dashboard.newest_first")}
              </option>
            </select>
          </label>
        </div>

        <ul className="divide-y">
          {!isPending && contacts?.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              {translate("crm.dashboard.everyone_contacted")}
            </li>
          )}
          {contacts?.map((contact) => {
            const stage = findStage(stages, contact.lifecycle_stage);
            const details = [
              contact.title && contact.company_name
                ? translate("crm.common.title_at_company", {
                    title: contact.title,
                    company: contact.company_name,
                  })
                : (contact.company_name ?? contact.title),
              contact.first_seen
                ? translate("crm.dashboard.added_ago", {
                    time: formatDistanceToNow(new Date(contact.first_seen), {
                      locale,
                      addSuffix: true,
                    }),
                  })
                : undefined,
            ].filter(Boolean);
            return (
              <li
                key={contact.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Avatar record={contact} />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/contacts/${contact.id}/show`}
                    className="font-medium hover:underline"
                  >
                    {contact.first_name} {contact.last_name}
                  </Link>
                  <div className="truncate text-sm text-muted-foreground">
                    {details.join(" · ")}
                  </div>
                </div>
                {stage && (
                  <span className="hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium sm:inline-flex">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: stage.color }}
                      aria-hidden
                    />
                    {stage.label}
                  </span>
                )}
                <LogContactButton contact={contact} />
                <ScheduleButton contactId={contact.id} display="icon" />
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground">
          <span>{translate("crm.dashboard.contacted_rule")}</span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                {translate("crm.common.previous")}
              </Button>
              <span className="tabular-nums">
                {page} / {pages}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((value) => value + 1)}
              >
                {translate("crm.common.next")}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
};
