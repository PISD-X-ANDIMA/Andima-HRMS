import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AREAS, DICTIONARY } from "@/modules/d4/web/i18n/dictionary";
import { translator } from "@/modules/d4/web/i18n/LanguageProvider";
import { plainText } from "@/modules/d4/shared/text";

const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
});
const sources = [...files("modules/d4/web"), ...files("modules/d4/shared")].filter((path) => !path.includes("/i18n/dictionary/"));
const unescape = (text: string) => text.replace(/\\(["\\])/g, "$1");
// Every literal handed to t(...), msg(...) or a DataTable noun: the key fallback would hide a missing entry on screen.
const used = sources.flatMap((path) => {
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(/\b(?:t|msg)\(\s*"((?:[^"\\]|\\.)*)"/g), ...source.matchAll(/\bnoun="([^"]+)"/g)].map((match) => ({ path, text: unescape(match[1]) }));
});
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("D4 language dictionary", () => {
  it("has an entry for every text the screens translate", () => {
    expect(used.filter(({ text }) => !DICTIONARY[text]).map(({ path, text }) => `${path}: ${text}`)).toEqual([]);
  });

  it("keeps each text in one feature file", () => {
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const [area, entries] of Object.entries(AREAS)) for (const text of Object.keys(entries)) {
      if (seen.has(text)) twice.push(`${text} (${seen.get(text)}, ${area})`);
      seen.set(text, area);
    }
    expect(twice).toEqual([]);
  });

  it("gives every entry a translation with the same placeholders", () => {
    const wrong = Object.entries(DICTIONARY).filter(([text, entry]) => (!entry.en && !entry.id)
      || [entry.en, entry.id, entry.enOne].some((value) => value !== undefined && placeholders(value).join() !== placeholders(text).join()));
    expect(wrong.map(([text]) => text)).toEqual([]);
  });

  it("falls back to the source text and fills placeholders", () => {
    expect(translator("en")("No such text {n}", { n: 3 })).toBe("No such text 3");
    expect(plainText("Showing {first} of {total}", { first: 1, total: 2 })).toBe("Showing 1 of 2");
    expect(plainText.language).toBeNull();
  });

  // Lecturer (24 Nov 2026): statuses and results did not follow the toggle. The stored value stays the key.
  it("translates status words in Indonesian and keeps them in English", () => {
    const id = translator("id"), en = translator("en");
    expect(["Completed", "In Progress", "Planned", "Not Passed", "Met", "Insufficient Data"].map((word) => id(word))).toEqual(["Selesai", "Berjalan", "Direncanakan", "Tidak Lulus", "Terpenuhi", "Data Belum Cukup"]);
    expect(en("Completed")).toBe("Completed");
  });

  it("uses the English singular for a count of one", () => {
    const en = translator("en");
    expect(en("{count} pegawai belum punya kategori.", { count: 1 })).toBe("1 employee has no category yet.");
    expect(en("{count} pegawai belum punya kategori.", { count: 2 })).toBe("2 employees have no category yet.");
    expect(translator("id")("{count} saved reviews", { count: 1 })).toBe("1 penilaian tersimpan");
    expect(en("Showing {first}–{last} of {total} {noun}", { first: 1, last: 1, total: 1, noun: en("employees", { count: 1 }) })).toBe("Showing 1–1 of 1 employee");
  });
});
