import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardrail for the rule the whole product rests on: no invented business data.
 *
 * The previous prototype assigned risk scores and cadastral codes with
 * Math.random() and hard-coded holders, RUCs and "synced today" labels. This
 * test fails the build if any of that comes back outside the clearly labelled
 * demo fixture module.
 */

const SRC = join(process.cwd(), "src");

/** Fixtures are allowed to contain invented values — they carry the DEMO tier. */
const FIXTURE_FILES = ["src/lib/demo/fixtures.ts"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sourceFiles = walk(SRC).filter((file) => /\.(ts|tsx)$/.test(file));

function read(file: string) {
  return { path: relative(process.cwd(), file), text: readFileSync(file, "utf8") };
}

describe("no fabricated business data (Plan Maestro §27)", () => {
  it("uses no Math.random() anywhere in the application source", () => {
    const offenders = sourceFiles
      .map(read)
      .filter((file) => file.text.includes("Math.random("))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("keeps invented records confined to the labelled demo fixture module", () => {
    const offenders = sourceFiles
      .map(read)
      .filter((file) => !FIXTURE_FILES.includes(file.path))
      .filter((file) => /\bDEMO-\d|fictional holder|INVERSIONES MINERAS|MINERA AURIFERA/i.test(file.text))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("hard-codes no RUC, cadastral code or resolution number", () => {
    const offenders = sourceFiles
      .map(read)
      .filter((file) => !FIXTURE_FILES.includes(file.path))
      .filter((file) =>
        /RUC\s*[:=]\s*["']\d|R\.P\.\s*N[º°]\s*\d|\b0102\d{5}\b/.test(file.text),
      )
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("makes no claim that a government database was refreshed on a schedule", () => {
    const claim =
      /actualizado (hoy|ayer)|[uú]ltima actualizaci[oó]n\s*[:=]|updated yesterday|synced (today|in real time)|real-time sync|hoy,?\s*\d{1,2}:\d{2}/i;
    // The same words appear legitimately in copy that denies the claim ("we do
    // not sync in real time") and in comments describing what was removed, so a
    // hit only counts when its line is not a negation.
    const negation = /\bnot\b|\bnever\b|\bwithout\b|\bno\b|\bnunca\b|prototype|removed|replaces/i;

    const offenders = sourceFiles
      .map(read)
      .flatMap((file) =>
        file.text
          .split("\n")
          .map((line, index) => ({ line, index }))
          .filter(({ line }) => claim.test(line) && !negation.test(line))
          .map(({ index }) => `${file.path}:${index + 1}`),
      );
    expect(offenders).toEqual([]);
  });

  it("keeps the banned screening vocabulary out of user-facing strings", () => {
    const offenders = sourceFiles
      .map(read)
      .filter((file) =>
        /(zona segura|viabilidad legal confirmada|tr[aá]mite acelerado|NO INSCRITO \/ ILEGAL)/i.test(
          file.text,
        ),
      )
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });
});
