/**
 * Parses a one-line appointment entry in English or German, for example
 * "tomorrow 10:30 call 30 min" or "morgen 14 uhr meeting". Every part is
 * optional; whatever is not recognised is returned as the note text.
 */
export interface QuickEntryResult {
  /** Local midnight of the recognised day */
  day?: Date;
  /** "HH:MM", 24-hour clock */
  time?: string;
  durationMinutes?: number;
  type?: string;
  text: string;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  sonntag: 0,
  so: 0,
  monday: 1,
  mon: 1,
  montag: 1,
  mo: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  dienstag: 2,
  di: 2,
  wednesday: 3,
  wed: 3,
  mittwoch: 3,
  mi: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  donnerstag: 4,
  do: 4,
  friday: 5,
  fri: 5,
  freitag: 5,
  fr: 5,
  saturday: 6,
  sat: 6,
  samstag: 6,
  sa: 6,
};

const RELATIVE_DAYS: Record<string, number> = {
  today: 0,
  heute: 0,
  tomorrow: 1,
  morgen: 1,
  übermorgen: 2,
  uebermorgen: 2,
};

/** German and English words that map onto common task types. */
const TYPE_ALIASES: Record<string, string> = {
  anruf: "call",
  anrufen: "call",
  telefonat: "call",
  termin: "meeting",
  treffen: "meeting",
  besprechung: "meeting",
  nachfassen: "follow-up",
  followup: "follow-up",
  mittagessen: "lunch",
  "e-mail": "email",
  mail: "email",
};

/** Filler words that carry no meaning once the parts are extracted. */
const FILLERS = new Set([
  "at",
  "um",
  "am",
  "on",
  "for",
  "für",
  "fuer",
  "mit",
  "with",
]);

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const pad = (value: number) => String(value).padStart(2, "0");

const formatTime = (hours: number, minutes: number) =>
  `${pad(hours)}:${pad(minutes)}`;

const validTime = (hours: number, minutes: number) =>
  hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;

export const parseQuickEntry = (
  input: string,
  now: Date,
  taskTypes: string[] = [],
): QuickEntryResult => {
  const result: QuickEntryResult = { text: "" };
  let rest = ` ${input.trim()} `;
  const today = startOfDay(now);

  const take = (
    pattern: RegExp,
    handle: (match: RegExpMatchArray) => boolean,
  ) => {
    const match = rest.match(pattern);
    if (match && handle(match)) {
      rest = rest.replace(match[0], " ");
    }
  };

  // Duration: "30 min", "45 minutes", "1 h", "2 std", "1,5 stunden"
  take(
    /\s(\d+(?:[.,]\d+)?)\s*(min|mins|minute|minutes|minuten)(?=\s|[.,;!?])/i,
    (m) => {
      result.durationMinutes = Math.round(Number(m[1].replace(",", ".")));
      return result.durationMinutes > 0;
    },
  );
  if (result.durationMinutes === undefined) {
    take(
      /\s(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|std|stunde|stunden)(?=\s|[.,;!?])/i,
      (m) => {
        const hours = Number(m[1].replace(",", "."));
        // "14h" is a time of day, not a duration
        if (hours > 8) return false;
        result.durationMinutes = Math.round(hours * 60);
        return result.durationMinutes > 0;
      },
    );
  }

  // Explicit dates: "2026-10-29", "29.10.2026", "29.10."
  take(/\s(\d{4})-(\d{1,2})-(\d{1,2})(?=\s)/, (m) => {
    const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(day.getTime())) return false;
    result.day = day;
    return true;
  });
  if (!result.day) {
    take(/\s(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4})?)?(?=\s)/, (m) => {
      const dayOfMonth = Number(m[1]);
      const month = Number(m[2]);
      if (dayOfMonth < 1 || dayOfMonth > 31 || month < 1 || month > 12) {
        return false;
      }
      let year = m[3] ? Number(m[3]) : today.getFullYear();
      if (year < 100) year += 2000;
      let day = new Date(year, month - 1, dayOfMonth);
      // Without a year, a date in the past means next year
      if (!m[3] && day < today) day = new Date(year + 1, month - 1, dayOfMonth);
      result.day = day;
      return true;
    });
  }

  // Time: "10:30", "3pm", "3:30 pm", "14 uhr", "14:30 uhr", "14h"
  take(/\s(\d{1,2}):(\d{2})\s*(am|pm)?(?:\s*uhr)?(?=\s)/i, (m) => {
    let hours = Number(m[1]);
    const minutes = Number(m[2]);
    if (m[3]) hours = (hours % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0);
    if (!validTime(hours, minutes)) return false;
    result.time = formatTime(hours, minutes);
    return true;
  });
  if (!result.time) {
    take(/\s(\d{1,2})\s*(am|pm)(?=\s)/i, (m) => {
      const hours =
        (Number(m[1]) % 12) + (m[2].toLowerCase() === "pm" ? 12 : 0);
      if (!validTime(hours, 0)) return false;
      result.time = formatTime(hours, 0);
      return true;
    });
  }
  if (!result.time) {
    take(/\s(\d{1,2})\s*(uhr|h)(?=\s)/i, (m) => {
      const hours = Number(m[1]);
      if (!validTime(hours, 0)) return false;
      result.time = formatTime(hours, 0);
      return true;
    });
  }
  if (!result.time) {
    // "at 3" / "um 9": a bare hour after a time preposition
    take(/\s(at|um)\s+(\d{1,2})(?=\s)/i, (m) => {
      const hours = Number(m[2]);
      if (!validTime(hours, 0)) return false;
      result.time = formatTime(hours, 0);
      return true;
    });
  }

  // Relative days and weekdays
  const words = rest.split(/\s+/).filter(Boolean);
  const remaining: string[] = [];
  const typeByName = new Map(
    taskTypes.map((type) => [type.toLowerCase(), type]),
  );
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lower = word.toLowerCase().replace(/[.,;!?]+$/, "");
    if (
      !result.day &&
      lower === "day" &&
      words[i + 1]?.toLowerCase() === "after"
    ) {
      // "day after tomorrow"
      if (words[i + 2]?.toLowerCase().replace(/[.,;!?]+$/, "") === "tomorrow") {
        result.day = addDays(today, 2);
        i += 2;
        continue;
      }
    }
    if (!result.day && lower in RELATIVE_DAYS) {
      result.day = addDays(today, RELATIVE_DAYS[lower]);
      continue;
    }
    if (!result.day && lower in WEEKDAYS) {
      // Two-letter German abbreviations only count when written alone
      // with a capital ("Do", "Mo"), so "do" in a sentence stays text.
      if (lower.length === 2 && word[0] !== word[0].toUpperCase()) {
        remaining.push(word);
        continue;
      }
      const target = WEEKDAYS[lower];
      let offset = (target - today.getDay() + 7) % 7;
      if (offset === 0) offset = 7;
      result.day = addDays(today, offset);
      continue;
    }
    if (!result.type) {
      const direct = typeByName.get(lower);
      const aliased = TYPE_ALIASES[lower]
        ? typeByName.get(TYPE_ALIASES[lower])
        : undefined;
      if (direct || aliased) {
        result.type = direct ?? aliased;
        continue;
      }
    }
    remaining.push(word);
  }

  // Drop leading and trailing filler words left over from "at 10:30"
  while (remaining.length && FILLERS.has(remaining[0].toLowerCase())) {
    remaining.shift();
  }
  while (
    remaining.length &&
    FILLERS.has(remaining[remaining.length - 1].toLowerCase())
  ) {
    remaining.pop();
  }
  result.text = remaining.join(" ");
  return result;
};
