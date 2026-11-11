import { describe, expect, it } from "vitest";
import { type ImpactReport, renderReport } from "../src/index.js";

describe("renderReport", () => {
  const baseReport: ImpactReport = {
    tests: ["t1", "t2"],
    byFile: { "src/a.ts": ["t1", "t2"] },
    uncovered: [],
    newFiles: [],
  };

  it("renders markdown exactly as expected", () => {
    const expected =
      "## Test impact\n\n2 tests impacted by 1 changed file.\n\n| File | Tests |\n| --- | --- |\n| src/a.ts | t1, t2 |\n";
    expect(renderReport(baseReport, "markdown")).toBe(expected);
  });

  it("renders singular form for 1 test/file", () => {
    const report = { tests: ["t1"], byFile: { "a.ts": ["t1"] }, uncovered: [], newFiles: [] };
    const expected =
      "## Test impact\n\n1 test impacted by 1 changed file.\n\n| File | Tests |\n| --- | --- |\n| a.ts | t1 |\n";
    expect(renderReport(report, "markdown")).toBe(expected);
  });

  it("adds uncovered and new files sections when non-empty", () => {
    const report = {
      tests: ["t1"],
      byFile: { "a.ts": ["t1"] },
      uncovered: ["b.ts", "c.ts"],
      newFiles: ["d.ts"],
    };
    const output = renderReport(report, "markdown");
    expect(output).toContain("### Uncovered changes\n\n- `b.ts`\n- `c.ts`");
    expect(output).toContain("### New files\n\n- `d.ts`");
  });

  it("renders JSON", () => {
    const output = renderReport(baseReport, "json");
    const parsed = JSON.parse(output);
    expect(parsed).toEqual(baseReport);
  });
});
