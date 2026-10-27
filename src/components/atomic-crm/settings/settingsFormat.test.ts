import { describe, expect, it } from "vitest";

import { formatJson, formatList, parseJson, parseList } from "./settingsFormat";

describe("settings text formats", () => {
  it("edits lists as comma-separated text", () => {
    expect(formatList(["Email", "Call"])).toBe("Email, Call");
    expect(parseList("Email, Call,\nMeeting, ")).toEqual([
      "Email",
      "Call",
      "Meeting",
    ]);
  });

  it("edits objects as JSON and keeps invalid text", () => {
    const stages = [{ value: "won", label: "Won" }];
    expect(parseJson(formatJson(stages))).toEqual(stages);
    expect(parseJson('[{"value": ')).toBe('[{"value": ');
    expect(formatJson(undefined)).toBe("");
  });
});
