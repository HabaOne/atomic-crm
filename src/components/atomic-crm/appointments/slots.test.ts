import { describe, expect, it } from "vitest";

import {
  buildSlots,
  busyRangesFromTasks,
  combineDayAndTime,
  endTime,
  postponedDueDate,
  toDateValue,
  toLocalDay,
  toTaskDueDate,
} from "./slots";

const day = new Date(2026, 9, 27);

describe("busyRangesFromTasks", () => {
  it("uses timed tasks only and defaults the duration to 30 minutes", () => {
    const ranges = busyRangesFromTasks([
      {
        id: 1,
        due_date: combineDayAndTime(day, "09:00").toISOString(),
        has_time: true,
        duration_minutes: 45,
      },
      {
        id: 2,
        due_date: combineDayAndTime(day, "14:00").toISOString(),
        has_time: true,
        duration_minutes: null,
      },
      { id: 3, due_date: day.toISOString(), has_time: false },
    ]);
    expect(ranges.map((r) => [r.start.getHours(), r.end.getMinutes()])).toEqual(
      [
        [9, 45],
        [14, 30],
      ],
    );
  });

  it("skips the task being edited", () => {
    expect(
      busyRangesFromTasks(
        [{ id: 7, due_date: day.toISOString(), has_time: true }],
        7,
      ),
    ).toEqual([]);
  });
});

describe("buildSlots", () => {
  const busy = busyRangesFromTasks([
    {
      id: 1,
      due_date: combineDayAndTime(day, "11:30").toISOString(),
      has_time: true,
      duration_minutes: 45,
    },
  ]);

  it("builds 30-minute slots from 08:00 to 18:00", () => {
    const slots = buildSlots({ day, busy: [], now: new Date(2026, 9, 26) });
    expect(slots).toHaveLength(21);
    expect(slots[0].time).toBe("08:00");
    expect(slots[20].time).toBe("18:00");
  });

  it("marks slots that overlap an appointment as taken", () => {
    const slots = buildSlots({ day, busy, now: new Date(2026, 9, 26) });
    const taken = slots.filter((s) => s.taken).map((s) => s.time);
    expect(taken).toEqual(["11:30", "12:00"]);
  });

  it("marks slots before now as past", () => {
    const slots = buildSlots({
      day,
      busy: [],
      now: new Date(2026, 9, 27, 9, 10),
    });
    expect(slots.filter((s) => s.past).map((s) => s.time)).toEqual([
      "08:00",
      "08:30",
      "09:00",
    ]);
  });
});

describe("endTime", () => {
  it("adds the duration", () => {
    expect(endTime("10:30", 45)).toBe("11:15");
    expect(endTime("23:45", 30)).toBe("00:15");
  });
});

describe("toTaskDueDate", () => {
  it("stores the local datetime when a time is set", () => {
    expect(toTaskDueDate("2026-10-28", "10:30")).toEqual({
      due_date: new Date(2026, 9, 28, 10, 30).toISOString(),
      has_time: true,
    });
  });

  it("stores local midnight without a time", () => {
    expect(toTaskDueDate("2026-10-28", null)).toEqual({
      due_date: new Date(2026, 9, 28).toISOString(),
      has_time: false,
    });
  });

  it("accepts the ISO value of an unchanged date input", () => {
    const iso = new Date(2026, 9, 28, 9, 0).toISOString();
    expect(toTaskDueDate(iso, "15:00").due_date).toBe(
      new Date(2026, 9, 28, 15, 0).toISOString(),
    );
    expect(toDateValue(toLocalDay(iso))).toBe("2026-10-28");
  });
});

describe("postponedDueDate", () => {
  const now = new Date(2026, 9, 27, 11, 12);

  it("keeps the time of a timed task", () => {
    expect(
      postponedDueDate(
        {
          due_date: new Date(2026, 9, 27, 14, 0).toISOString(),
          has_time: true,
        },
        1,
        now,
      ),
    ).toBe(new Date(2026, 9, 28, 14, 0).toISOString());
  });

  it("moves a date-only task to local midnight", () => {
    expect(
      postponedDueDate(
        { due_date: "2026-10-20T22:00:00.000Z", has_time: false },
        7,
        now,
      ),
    ).toBe(new Date(2026, 10, 3).toISOString());
  });
});
