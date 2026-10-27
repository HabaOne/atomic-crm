import { describe, expect, it } from "vitest";

import { defaultTaskTypes } from "../root/defaultConfiguration";
import { parseQuickEntry } from "./quickEntry";

// Tuesday, 27 October 2026, 11:12 local time
const now = new Date(2026, 9, 27, 11, 12);
const day = (month: number, date: number, year = 2026) =>
  new Date(year, month - 1, date);

describe("parseQuickEntry", () => {
  it("parses an English line with day, time, type, and duration", () => {
    expect(
      parseQuickEntry("tomorrow 10:30 call 30 min", now, defaultTaskTypes),
    ).toEqual({
      day: day(10, 28),
      time: "10:30",
      type: "Call",
      durationMinutes: 30,
      text: "",
    });
  });

  it("parses a German line with 'uhr'", () => {
    expect(
      parseQuickEntry("morgen 14 uhr meeting", now, defaultTaskTypes),
    ).toEqual({
      day: day(10, 28),
      time: "14:00",
      type: "Meeting",
      text: "",
    });
  });

  it("maps German type words onto the configured task types", () => {
    const result = parseQuickEntry(
      "heute um 16:30 Anruf Angebot besprechen",
      now,
      defaultTaskTypes,
    );
    expect(result.day).toEqual(day(10, 27));
    expect(result.time).toBe("16:30");
    expect(result.type).toBe("Call");
    expect(result.text).toBe("Angebot besprechen");
  });

  it("resolves weekday names to the next occurrence", () => {
    expect(parseQuickEntry("friday", now).day).toEqual(day(10, 30));
    expect(parseQuickEntry("Freitag", now).day).toEqual(day(10, 30));
    expect(parseQuickEntry("Do 9:00", now).day).toEqual(day(10, 29));
    // Today's weekday means next week
    expect(parseQuickEntry("tuesday", now).day).toEqual(day(11, 3));
    expect(parseQuickEntry("übermorgen", now).day).toEqual(day(10, 29));
    expect(parseQuickEntry("day after tomorrow", now).day).toEqual(day(10, 29));
  });

  it("keeps lower-case two-letter words as text", () => {
    const result = parseQuickEntry("do the review", now);
    expect(result.day).toBeUndefined();
    expect(result.text).toBe("do the review");
  });

  it("parses am/pm and bare hours after a preposition", () => {
    expect(parseQuickEntry("3pm", now).time).toBe("15:00");
    expect(parseQuickEntry("3:30 pm", now).time).toBe("15:30");
    expect(parseQuickEntry("12am", now).time).toBe("00:00");
    expect(parseQuickEntry("um 9", now).time).toBe("09:00");
    expect(parseQuickEntry("at 4", now).time).toBe("04:00");
    expect(parseQuickEntry("14h", now).time).toBe("14:00");
  });

  it("parses explicit dates", () => {
    expect(parseQuickEntry("29.10. 10:00", now).day).toEqual(day(10, 29));
    expect(parseQuickEntry("3.11 10:00", now).day).toEqual(day(11, 3));
    expect(parseQuickEntry("2026-12-01", now).day).toEqual(day(12, 1));
    // A day-month in the past rolls over to next year
    expect(parseQuickEntry("01.02.", now).day).toEqual(day(2, 1, 2027));
  });

  it("parses durations in hours and minutes", () => {
    expect(parseQuickEntry("1 h", now).durationMinutes).toBe(60);
    expect(parseQuickEntry("1,5 stunden", now).durationMinutes).toBe(90);
    expect(parseQuickEntry("45min", now).durationMinutes).toBe(45);
  });

  it("ignores invalid times and returns them as text", () => {
    const result = parseQuickEntry("25:99 sync", now);
    expect(result.time).toBeUndefined();
    expect(result.text).toBe("25:99 sync");
  });

  it("returns an empty result for empty input", () => {
    expect(parseQuickEntry("   ", now)).toEqual({ text: "" });
  });
});
