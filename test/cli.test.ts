import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "../src/cli.js";

describe("run", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function writeTempFile(name: string, content: string): Promise<string> {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tir-"));
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, content);
    return filePath;
  }

  it("prints report and returns 0", async () => {
    const diffPath = await writeTempFile(
      "diff.patch",
      "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n-old\n+new\n+extra\n",
    );
    const coveragePath = await writeTempFile(
      "map.json",
      JSON.stringify({ tests: { t1: { "a.ts": [[1, 1]] } } }),
    );
    let stdout = "";
    let stderr = "";
    const io = {
      stdout: { write: (s: string) => (stdout += s) },
      stderr: { write: (s: string) => (stderr += s) },
    };
    const code = await run(
      ["--diff", diffPath, "--coverage", coveragePath, "--format", "markdown"],
      io,
    );
    expect(code).toBe(0);
    expect(stdout).toContain("## Test impact");
    expect(stdout).toContain("1 test impacted by 1 changed file.");
    expect(stderr).toBe("");
  });

  it("returns 1 when --fail-on-uncovered and uncovered non-empty", async () => {
    const diffPath = await writeTempFile(
      "diff.patch",
      "diff --git a/uncovered.ts b/uncovered.ts\n--- a/uncovered.ts\n+++ b/uncovered.ts\n@@ -1 +1 @@\n-old\n+new\n",
    );
    const coveragePath = await writeTempFile(
      "map.json",
      JSON.stringify({ tests: { t1: { "other.ts": [[1, 1]] } } }),
    );
    const io = { stdout: { write: () => {} }, stderr: { write: () => {} } };
    const code = await run(
      ["--diff", diffPath, "--coverage", coveragePath, "--fail-on-uncovered"],
      io,
    );
    expect(code).toBe(1);
  });

  it("returns 2 on missing --diff", async () => {
    const io = { stdout: { write: () => {} }, stderr: { write: () => {} } };
    const code = await run(["--coverage", "map.json"], io);
    expect(code).toBe(2);
  });

  it("returns 2 on file read error", async () => {
    const io = { stdout: { write: () => {} }, stderr: { write: () => {} } };
    const code = await run(["--diff", "nonexistent.patch", "--coverage", "nonexistent.json"], io);
    expect(code).toBe(2);
  });

  it("returns 2 on parse error", async () => {
    const diffPath = await writeTempFile("bad.patch", "not a diff");
    const coveragePath = await writeTempFile("map.json", "{}");
    const io = { stdout: { write: () => {} }, stderr: { write: () => {} } };
    const code = await run(["--diff", diffPath, "--coverage", coveragePath], io);
    expect(code).toBe(2);
  });
});
