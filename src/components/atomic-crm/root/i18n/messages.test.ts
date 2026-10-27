import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { crmGermanMessages } from "./de";
import { crmEnglishMessages } from "./en";

const flatten = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });

describe("crm messages", () => {
  const english = new Set(flatten(crmEnglishMessages));
  const german = new Set(flatten(crmGermanMessages));

  it("has the same keys in English and German", () => {
    expect([...english].filter((key) => !german.has(key))).toEqual([]);
    expect([...german].filter((key) => !english.has(key))).toEqual([]);
  });

  it("defines every crm key used in the source", () => {
    const root = path.resolve(__dirname, "..", "..");
    const used = new Set<string>();
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(
        /["'`](crm\.[a-z0-9_]+(?:\.[a-z0-9_]+)+)["'`]/g,
      )) {
        used.add(match[1]);
      }
    }
    expect(used.size).toBeGreaterThan(50);
    expect([...used].filter((key) => !english.has(key)).sort()).toEqual([]);
  });
});
