import { describe, expect, it } from "vitest";
import { parseDiff, TestImpactError } from "../src/index.js";

function captureError(fn: () => unknown): TestImpactError | undefined {
  try {
    fn();
  } catch (err) {
    return err as TestImpactError;
  }
  return undefined;
}

describe("parseDiff", () => {
  it("parses a simple modified file with two removed lines", () => {
    const diff =
      "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -10,2 +10,3 @@\n-x\n-y\n+x2\n+y2\n+z\n";
    const result = parseDiff(diff);
    expect(result).toEqual([
      {
        oldPath: "src/a.ts",
        newPath: "src/a.ts",
        status: "modified",
        oldLines: [10, 11],
      },
    ]);
  });

  it("handles pure insertion hunk", () => {
    const diff =
      "diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -5,0 +6,2 @@\n+new line1\n+new line2\n";
    const result = parseDiff(diff);
    expect(result[0]?.oldLines).toEqual([5]);
  });

  it("handles added file with /dev/null and hunk with old start 0", () => {
    const diff =
      "diff --git a/new.txt b/new.txt\nnew file mode 100644\n--- /dev/null\n+++ b/new.txt\n@@ -0,0 +1 @@\n+content\n";
    const result = parseDiff(diff);
    expect(result).toEqual([
      {
        oldPath: "",
        newPath: "new.txt",
        status: "added",
        oldLines: [],
      },
    ]);
  });

  it("handles rename headers without hunks", () => {
    const diff =
      "diff --git a/old.ts b/new.ts\nsimilarity index 100%\nrename from old.ts\nrename to new.ts\n";
    const result = parseDiff(diff);
    expect(result[0]).toEqual({
      oldPath: "old.ts",
      newPath: "new.ts",
      status: "renamed",
      oldLines: [],
    });
  });

  it("parses a rename of src/b.ts to src/d.ts without hunks", () => {
    const diff =
      "diff --git a/src/b.ts b/src/d.ts\nsimilarity index 100%\nrename from src/b.ts\nrename to src/d.ts\n";
    const result = parseDiff(diff);
    expect(result).toEqual([
      {
        oldPath: "src/b.ts",
        newPath: "src/d.ts",
        status: "renamed",
        oldLines: [],
      },
    ]);
  });

  it("handles file paths with spaces", () => {
    const diff =
      "diff --git a/hello world.ts b/hello world.ts\n--- a/hello world.ts\n+++ b/hello world.ts\n@@ -1 +1,2 @@\n-old\n+new\n";
    const result = parseDiff(diff);
    expect(result[0]?.oldPath).toBe("hello world.ts");
    expect(result[0]?.newPath).toBe("hello world.ts");
    expect(result[0]?.oldLines).toEqual([1]);
  });

  it("ignores \\ No newline at end of file lines", () => {
    const diff =
      "diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1,2 +1,2 @@\n-old line\n\\ No newline at end of file\n+new line\n\\ No newline at end of file\n";
    const result = parseDiff(diff);
    expect(result[0]?.oldLines).toEqual([1]);
  });

  it("handles CRLF line endings", () => {
    const diff =
      "diff --git a/a.txt b/a.txt\r\n--- a/a.txt\r\n+++ b/a.txt\r\n@@ -1,2 +1,2 @@\r\n-old\r\n+new\r\n";
    const result = parseDiff(diff);
    expect(result[0]?.oldLines).toEqual([1]);
  });

  it("treats binary file notice as modified with no lines", () => {
    const diff =
      "diff --git a/image.png b/image.png\nindex 123..456 100644\nBinary files a/image.png and b/image.png differ\n";
    const result = parseDiff(diff);
    expect(result[0]).toEqual({
      oldPath: "image.png",
      newPath: "image.png",
      status: "modified",
      oldLines: [],
    });
  });

  it("parses multiple files", () => {
    const diff =
      "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+b\ndiff --git a/b.ts b/b.ts\n--- a/b.ts\n+++ b/b.ts\n@@ -2,0 +2,1 @@\n+insert\n";
    const result = parseDiff(diff);
    expect(result).toHaveLength(2);
    expect(result[0]?.oldLines).toEqual([1]);
    expect(result[1]?.oldLines).toEqual([2]);
  });

  it("handles two hunks in one file", () => {
    const diff =
      "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+b\n@@ -10,2 +10,3 @@\n-x\n-y\n+x\n+y\n+z\n";
    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0]?.oldLines).toEqual([1, 10, 11]);
  });

  it("does not mistake hunk content for file headers", () => {
    const diff =
      "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n--- old comment\n+++ new comment\n";
    const result = parseDiff(diff);
    expect(result).toEqual([
      {
        oldPath: "src/a.ts",
        newPath: "src/a.ts",
        status: "modified",
        oldLines: [1],
      },
    ]);
  });

  it("throws input_too_large if byte length exceeds maxBytes", () => {
    const bigString = "a".repeat(20);
    const err = captureError(() => parseDiff(bigString, { maxBytes: 10 }));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("input_too_large");
  });

  it("rejects a diff over the 10 MiB default", () => {
    const err = captureError(() => parseDiff("a".repeat(10_485_761)));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("input_too_large");
  });

  it("accepts a diff exactly at the 10 MiB default", () => {
    const text = "a".repeat(10_485_760);
    expect(captureError(() => parseDiff(text))?.code).not.toBe("input_too_large");
  });

  it("throws invalid_diff with line number for malformed hunk header", () => {
    const diff = "diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -a +b @@\n";
    const err = captureError(() => parseDiff(diff));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("invalid_diff");
    expect(err?.message).toContain("line 4");
  });
});
