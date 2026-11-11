import { describe, expect, it } from "vitest";
import { type CoverageMap, type FileChange, impact, parseDiff } from "../src/index.js";

describe("impact", () => {
  const baseCoverage: CoverageMap = {
    tests: {
      t1: { "src/a.ts": [[1, 10]] },
      t2: { "src/a.ts": [[11, 20]] },
      t3: { "src/b.ts": [[1, 5]] },
    },
  };

  it("impacts tests whose ranges contain changed lines", () => {
    const changes: FileChange[] = [
      { oldPath: "src/a.ts", newPath: "src/a.ts", status: "modified", oldLines: [10, 11] },
    ];
    const report = impact(changes, baseCoverage);
    expect(report.tests).toEqual(["t1", "t2"]);
    expect(report.byFile).toEqual({ "src/a.ts": ["t1", "t2"] });
  });

  it("puts modified file with no covered lines into uncovered", () => {
    const changes: FileChange[] = [
      { oldPath: "src/c.ts", newPath: "src/c.ts", status: "modified", oldLines: [1] },
    ];
    const report = impact(changes, baseCoverage);
    expect(report.uncovered).toEqual(["src/c.ts"]);
    expect(report.byFile).toEqual({});
  });

  it("puts added file into newFiles", () => {
    const changes: FileChange[] = [
      { oldPath: "", newPath: "src/new.ts", status: "added", oldLines: [] },
    ];
    const report = impact(changes, baseCoverage);
    expect(report.newFiles).toEqual(["src/new.ts"]);
  });

  it("rename impacts every test covering old path and byFile uses new path", () => {
    const changes: FileChange[] = [
      { oldPath: "src/b.ts", newPath: "src/d.ts", status: "renamed", oldLines: [] },
    ];
    const report = impact(changes, baseCoverage);
    expect(report.tests).toEqual(["t3"]);
    expect(report.byFile).toEqual({ "src/d.ts": ["t3"] });
  });

  it("rename diff of src/b.ts to src/d.ts impacts every test covering src/b.ts", () => {
    const diff =
      "diff --git a/src/b.ts b/src/d.ts\nsimilarity index 100%\nrename from src/b.ts\nrename to src/d.ts\n";
    const report = impact(parseDiff(diff), baseCoverage);
    expect(report.tests).toEqual(["t3"]);
    expect(report.byFile).toEqual({ "src/d.ts": ["t3"] });
  });

  it("deleted file impacts every test covering old path and byFile uses old path", () => {
    const changes: FileChange[] = [
      { oldPath: "src/a.ts", newPath: "", status: "deleted", oldLines: [] },
    ];
    const report = impact(changes, baseCoverage);
    expect(report.tests).toEqual(["t1", "t2"]);
    expect(report.byFile).toEqual({ "src/a.ts": ["t1", "t2"] });
  });

  it("puts deleted file with no covering test into uncovered", () => {
    const changes: FileChange[] = [
      { oldPath: "src/gone.ts", newPath: "", status: "deleted", oldLines: [1] },
    ];
    const report = impact(changes, baseCoverage);
    expect(report.tests).toEqual([]);
    expect(report.uncovered).toEqual(["src/gone.ts"]);
    expect(report.byFile).toEqual({});
  });

  it("handles paths that are Object.prototype members", () => {
    const coverage: CoverageMap = JSON.parse(
      '{"tests":{"t1":{"constructor":[[1,5]],"__proto__":[[1,5]]},"t2":{"toString":[[1,5]]},"t3":{"hasOwnProperty":[[1,5]]}}}',
    );
    const changes: FileChange[] = [
      { oldPath: "constructor", newPath: "constructor", status: "modified", oldLines: [1] },
      { oldPath: "__proto__", newPath: "__proto__", status: "modified", oldLines: [1] },
      { oldPath: "toString", newPath: "toString", status: "modified", oldLines: [1] },
      { oldPath: "hasOwnProperty", newPath: "", status: "deleted", oldLines: [] },
      { oldPath: "valueOf", newPath: "", status: "deleted", oldLines: [] },
    ];
    const report = impact(changes, coverage);
    expect(report.tests).toEqual(["t1", "t2", "t3"]);
    expect(report.byFile["constructor"]).toEqual(["t1"]);
    expect(report.byFile["__proto__"]).toEqual(["t1"]);
    expect(report.byFile["toString"]).toEqual(["t2"]);
    expect(report.byFile["hasOwnProperty"]).toEqual(["t3"]);
    expect(report.uncovered).toEqual([]);
  });

  it("keeps a __proto__ file path in the report", () => {
    const coverage: CoverageMap = { tests: { t1: { "src/a.ts": [[1, 5]] } } };
    const changes: FileChange[] = [
      { oldPath: "src/a.ts", newPath: "__proto__", status: "modified", oldLines: [1] },
    ];
    const report = impact(changes, coverage);
    expect(Object.hasOwn(report.byFile, "__proto__")).toBe(true);
    expect(report.byFile["__proto__"]).toEqual(["t1"]);
  });

  it("sorts lists and byFile values", () => {
    const coverage: CoverageMap = {
      tests: {
        tB: { "file2.ts": [[1, 5]] },
        tA: { "file1.ts": [[1, 5]] },
      },
    };
    const changes: FileChange[] = [
      { oldPath: "file1.ts", newPath: "file1.ts", status: "modified", oldLines: [1] },
      { oldPath: "file2.ts", newPath: "file2.ts", status: "modified", oldLines: [1] },
    ];
    const report = impact(changes, coverage);
    expect(report.tests).toEqual(["tA", "tB"]);
    expect(report.byFile["file1.ts"]).toEqual(["tA"]);
    expect(report.byFile["file2.ts"]).toEqual(["tB"]);
  });

  it("test covering two files", () => {
    const coverage: CoverageMap = {
      tests: {
        t1: { "a.ts": [[1, 10]], "b.ts": [[1, 10]] },
      },
    };
    const changes: FileChange[] = [
      { oldPath: "a.ts", newPath: "a.ts", status: "modified", oldLines: [5] },
      { oldPath: "b.ts", newPath: "b.ts", status: "modified", oldLines: [5] },
    ];
    const report = impact(changes, coverage);
    expect(report.tests).toEqual(["t1"]);
    expect(report.byFile).toEqual({ "a.ts": ["t1"], "b.ts": ["t1"] });
  });
});
