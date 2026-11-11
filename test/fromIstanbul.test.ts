import { describe, expect, it } from "vitest";
import { fromIstanbul, TestImpactError } from "../src/index.js";

describe("fromIstanbul", () => {
  it("converts Istanbul coverage to CoverageMap", () => {
    const coverage = {
      "/repo/src/a.ts": {
        statementMap: {
          "0": { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
          "1": { start: { line: 5, column: 0 }, end: { line: 5, column: 9 } },
        },
        s: { "0": 1, "1": 0 },
      },
    };
    const result = fromIstanbul("t1", coverage, { root: "/repo" });
    expect(result).toEqual({ tests: { t1: { "src/a.ts": [[1, 3]] } } });
  });

  it("merges overlapping and adjacent ranges", () => {
    const coverage = {
      "/repo/a.ts": {
        statementMap: {
          "0": { start: { line: 1, column: 0 }, end: { line: 2, column: 1 } },
          "1": { start: { line: 3, column: 0 }, end: { line: 4, column: 1 } },
          "2": { start: { line: 4, column: 0 }, end: { line: 5, column: 1 } },
        },
        s: { "0": 1, "1": 1, "2": 1 },
      },
    };
    const result = fromIstanbul("t1", coverage, { root: "/repo" });
    expect(result.tests.t1?.["a.ts"]).toEqual([[1, 5]]);
  });

  it("ignores statements with zero count", () => {
    const coverage = {
      "/repo/a.ts": {
        statementMap: {
          "0": { start: { line: 1, column: 0 }, end: { line: 2, column: 1 } },
          "1": { start: { line: 3, column: 0 }, end: { line: 4, column: 1 } },
        },
        s: { "0": 0, "1": 2 },
      },
    };
    const result = fromIstanbul("t1", coverage, { root: "/repo" });
    expect(result.tests.t1?.["a.ts"]).toEqual([[3, 4]]);
  });

  it("throws invalid_map if path not under root", () => {
    const coverage = { "/other/a.ts": { statementMap: {}, s: {} } };
    expect(() => fromIstanbul("t1", coverage, { root: "/repo" })).toThrowError(TestImpactError);
  });

  it("throws invalid_map if count missing", () => {
    const coverage = {
      "/repo/a.ts": { statementMap: { "0": { start: { line: 1 }, end: { line: 2 } } }, s: {} },
    };
    expect(() => fromIstanbul("t1", coverage, { root: "/repo" })).toThrowError(TestImpactError);
  });
});
