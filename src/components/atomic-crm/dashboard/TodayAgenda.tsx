import { addDays, format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useGetIdentity,
  useGetList,
  useGetMany,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ScheduleButton } from "../appointments/ScheduleButton";
import {
  DEFAULT_DURATION_MINUTES,
  formatTime,
  isSameDay,
  toLocalDay,
} from "../appointments/slots";
import { useDateLocale, useLongDayFormat } from "../misc/useDateLocale";
import { LogContactButton } from "../notes/LogContactButton";
import type { Contact, Task } from "../types";

const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
};

const useDayTasks = (day: Date, salesId?: Identifier) =>
  useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "due_date", order: "ASC" },
      filter: {
        sales_id: salesId,
        "due_date@gte": day.toISOString(),
        "due_date@lt": addDays(day, 1).toISOString(),
      },
    },
    { enabled: salesId != null },
  );

const contactName = (contact?: Contact) =>
  contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : "";

/** The current user's appointments and tasks for one day. */
export const TodayAgenda = () => {
  const translate = useTranslate();
  const locale = useDateLocale();
  const longDay = useLongDayFormat();
  const { identity } = useGetIdentity();
  const now = useNow();
  const today = toLocalDay(now);
  const [day, setDay] = useState(today);
  const isToday = isSameDay(day, today);

  const { data: tasks = [], isPending } = useDayTasks(day, identity?.id);
  const { data: tomorrowTasks = [] } = useDayTasks(
    addDays(today, 1),
    identity?.id,
  );
  const preview = isToday ? tomorrowTasks : [];
  const contactIds = Array.from(
    new Set([...tasks, ...preview].map((task) => task.contact_id)),
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );
  const contactsById = new Map(
    contacts.map((contact) => [contact.id, contact]),
  );

  const timed = tasks.filter((task) => task.has_time);
  const allDay = tasks.filter((task) => !task.has_time);
  const appointments = timed.length;
  const open = tasks.filter((task) => !task.done_date).length;
  // the now-line goes before the first appointment that has not started yet
  const nowIndex = isToday
    ? timed.findIndex((task) => new Date(task.due_date) > now)
    : -1;

  return (
    <section
      className="flex flex-col gap-2"
      aria-labelledby="today-agenda-title"
    >
      <div className="flex items-center min-h-9">
        <CalendarDays
          className="mr-3 size-6 text-muted-foreground"
          aria-hidden
        />
        <h2
          id="today-agenda-title"
          className="flex-1 text-xl font-semibold text-muted-foreground"
        >
          {translate(isToday ? "crm.common.today" : "crm.dashboard.agenda")}
        </h2>
        <ScheduleButton
          variant="default"
          label={translate("crm.dashboard.appointment")}
        />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={translate("crm.dashboard.previous_day")}
            onClick={() => setDay((value) => addDays(value, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-center">
            <div className="font-semibold">
              {format(day, longDay, { locale })}
            </div>
            <div className="text-xs text-muted-foreground">
              {translate("crm.dashboard.day_summary", {
                appointments,
                open,
              })}
            </div>
            {!isToday && (
              <button
                type="button"
                className="text-xs font-medium underline underline-offset-2"
                onClick={() => setDay(today)}
              >
                {translate("crm.dashboard.back_to_today")}
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={translate("crm.dashboard.next_day")}
            onClick={() => setDay((value) => addDays(value, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="py-2">
          {!isPending && tasks.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {translate("crm.dashboard.nothing_planned")}
            </p>
          )}
          {timed.map((task, index) => (
            <div key={task.id}>
              {index === nowIndex && <NowLine now={now} />}
              <AgendaItem
                task={task}
                contact={contactsById.get(task.contact_id)}
                highlight={index === nowIndex}
                now={now}
              />
            </div>
          ))}
          {isToday && timed.length > 0 && nowIndex === -1 && (
            <NowLine now={now} />
          )}
          {allDay.length > 0 && (
            <div className="mt-1 border-t pt-2">
              <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {translate("crm.dashboard.all_day")}
              </p>
              {allDay.map((task) => (
                <AgendaItem
                  key={task.id}
                  task={task}
                  contact={contactsById.get(task.contact_id)}
                  now={now}
                />
              ))}
            </div>
          )}
        </div>

        {preview.length > 0 && (
          <div className="flex flex-col gap-2 border-t px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {translate("crm.common.tomorrow")}
            </p>
            {preview.slice(0, 4).map((task) => (
              <div key={task.id} className="flex gap-3 text-sm">
                <span className="w-12 shrink-0 font-semibold tabular-nums">
                  {task.has_time
                    ? formatTime(new Date(task.due_date))
                    : translate("crm.dashboard.all_day_short")}
                </span>
                <span className="min-w-0 truncate">
                  {task.type && task.type !== "None" ? `${task.type} · ` : ""}
                  {contactName(contactsById.get(task.contact_id))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
};

const NowLine = ({ now }: { now: Date }) => (
  <div className="flex items-center gap-2 px-4" aria-hidden>
    <span className="w-12 text-[11px] font-semibold text-destructive tabular-nums">
      {formatTime(now)}
    </span>
    <span className="h-0.5 flex-1 rounded bg-destructive" />
  </div>
);

const AgendaItem = ({
  task,
  contact,
  highlight,
  now,
}: {
  task: Task;
  contact?: Contact;
  highlight?: boolean;
  now: Date;
}) => {
  const translate = useTranslate();
  const start = new Date(task.due_date);
  const minutesUntil = Math.round((start.getTime() - now.getTime()) / 60_000);
  const done = !!task.done_date;
  const details = [
    contact?.title && contact?.company_name
      ? translate("crm.common.title_at_company", {
          title: contact.title,
          company: contact.company_name,
        })
      : (contact?.company_name ?? contact?.title),
    task.has_time
      ? translate("crm.schedule.minutes", {
          smart_count: task.duration_minutes || DEFAULT_DURATION_MINUTES,
        })
      : undefined,
    task.text,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        "mx-2 flex gap-3 rounded-lg px-2 py-2.5",
        highlight && "bg-muted",
        done && "opacity-55",
      )}
    >
      <div className="flex w-12 shrink-0 flex-col">
        <span className="text-sm font-semibold tabular-nums">
          {task.has_time ? formatTime(start) : "·"}
        </span>
        {highlight && minutesUntil > 0 && minutesUntil <= 120 && (
          <span className="text-[11px] text-muted-foreground">
            {translate("crm.dashboard.in_minutes", {
              smart_count: minutesUntil,
            })}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {task.type && task.type !== "None" && (
            <span className="rounded-md border bg-background px-1.5 text-xs font-semibold">
              {task.type}
            </span>
          )}
          {contact ? (
            <Link
              to={`/contacts/${contact.id}/show`}
              className={cn(
                "font-medium hover:underline",
                done && "line-through",
              )}
            >
              {contactName(contact)}
            </Link>
          ) : (
            <span className={cn("font-medium", done && "line-through")}>
              {task.text}
            </span>
          )}
          {done && (
            <span className="text-xs text-muted-foreground">
              {translate("crm.dashboard.done")}
            </span>
          )}
        </div>
        {details.length > 0 && (
          <div className="truncate text-sm text-muted-foreground">
            {details.join(" · ")}
          </div>
        )}
        {highlight && contact && (
          <div className="mt-1 flex gap-1.5">
            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
              <Link to={`/contacts/${contact.id}/show`}>
                {translate("crm.dashboard.open_contact")}
              </Link>
            </Button>
            <LogContactButton contact={contact} />
          </div>
        )}
      </div>
    </div>
  );
};
