import type { Task } from "../types";

export const DEFAULT_DURATION_MINUTES = 30;
export const DURATION_OPTIONS = [15, 30, 45, 60];

export interface BusyRange {
  start: Date;
  end: Date;
}

export interface TimeSlot {
  /** "HH:MM" */
  time: string;
  taken: boolean;
  past: boolean;
}

const pad = (value: number) => String(value).padStart(2, "0");

export const formatTime = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Local datetime for a day plus an "HH:MM" time. */
export const combineDayAndTime = (day: Date, time: string): Date => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hours,
    minutes,
  );
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Busy ranges from timed tasks. Date-only tasks block no slot. */
export const busyRangesFromTasks = (
  tasks: Pick<Task, "due_date" | "has_time" | "duration_minutes" | "id">[],
  excludeTaskId?: Task["id"],
): BusyRange[] =>
  tasks
    .filter((task) => task.has_time && task.id !== excludeTaskId)
    .map((task) => {
      const start = new Date(task.due_date);
      const minutes = task.duration_minutes || DEFAULT_DURATION_MINUTES;
      return { start, end: new Date(start.getTime() + minutes * 60_000) };
    });

/**
 * 30-minute slots from 08:00 to 18:00 for one day. A slot is taken when it
 * overlaps a busy range, and past when it starts before `now`.
 */
export const buildSlots = ({
  day,
  busy,
  now,
  startHour = 8,
  endHour = 18,
  stepMinutes = 30,
}: {
  day: Date;
  busy: BusyRange[];
  now: Date;
  startHour?: number;
  endHour?: number;
  stepMinutes?: number;
}): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (
    let minutes = startHour * 60;
    minutes <= endHour * 60;
    minutes += stepMinutes
  ) {
    const time = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
    const start = combineDayAndTime(day, time);
    const end = new Date(start.getTime() + stepMinutes * 60_000);
    slots.push({
      time,
      taken: busy.some((range) => range.start < end && range.end > start),
      past: start < now,
    });
  }
  return slots;
};

/** "10:30" plus 45 minutes is "11:15". */
export const endTime = (time: string, durationMinutes: number) => {
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + durationMinutes;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};

/** Local midnight of a "yyyy-mm-dd" form value or of an ISO datetime. */
export const toLocalDay = (value: string | Date): Date => {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

/** "yyyy-mm-dd" of a local date, the value format of date inputs. */
export const toDateValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * The stored due date of a task: the local datetime when a time is set,
 * otherwise local midnight of the day (the way date-only tasks are stored).
 */
export const toTaskDueDate = (
  day: string | Date,
  time: string | null | undefined,
): { due_date: string; has_time: boolean } => {
  const localDay = toLocalDay(day);
  return time
    ? {
        due_date: combineDayAndTime(localDay, time).toISOString(),
        has_time: true,
      }
    : { due_date: localDay.toISOString(), has_time: false };
};

/**
 * Due date of a task postponed by some days from today. A timed task keeps
 * its time of day; a date-only task stays at local midnight.
 */
export const postponedDueDate = (
  task: Pick<Task, "due_date" | "has_time">,
  days: number,
  now: Date = new Date(),
): string => {
  const today = toLocalDay(now);
  const day = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + days,
  );
  return toTaskDueDate(
    day,
    task.has_time ? formatTime(new Date(task.due_date)) : null,
  ).due_date;
};
