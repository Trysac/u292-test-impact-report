/**
 * Public API of @trysac/test-impact-report.
 *
 * Reports which tests a code change impacts by joining a unified diff with a
 * per-test line coverage map. Converts Istanbul coverage and renders reports.
 */

export type FileChangeStatus = "modified" | "added" | "deleted" | "renamed";

export interface FileChange {
  oldPath: string;
  newPath: string;
  status: FileChangeStatus;
  oldLines: number[];
}

export type CoverageRange = [number, number];

export interface CoverageMap {
  tests: Record<string, Record<string, CoverageRange[]>>;
}

export interface ImpactReport {
  tests: string[];
  byFile: Record<string, string[]>;
  uncovered: string[];
  newFiles: string[];
}

export type TestImpactErrorCode =
  | "input_too_large"
  | "invalid_diff"
  | "invalid_json"
  | "invalid_map"
  | "too_many_tests";

export class TestImpactError extends Error {
  readonly code: TestImpactErrorCode;

  constructor(code: TestImpactErrorCode, message: string) {
    super(message);
    this.name = "TestImpactError";
    this.code = code;
  }
}

const DEFAULT_MAX_DIFF_BYTES = 10_485_760; // 10 MiB
const DEFAULT_MAX_COVERAGE_BYTES = 52_428_800; // 50 MiB
const DEFAULT_MAX_TESTS = 100_000;

const MAX_MESSAGE_VALUE_LENGTH = 80;

function clip(value: string, maxLength = MAX_MESSAGE_VALUE_LENGTH): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function utf8ByteLength(str: string): number {
  let bytes = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

function stripGitPathPrefix(path: string): string {
  if (path === "/dev/null") return "";
  if (path.startsWith("a/") || path.startsWith("b/")) return path.slice(2);
  return path;
}

function parseHunkHeader(line: string, lineNumber: number): { oldStart: number; oldCount: number } {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (!match) {
    throw new TestImpactError(
      "invalid_diff",
      `Invalid diff at line ${lineNumber}: malformed hunk header`,
    );
  }
  const oldStart = Number(match[1]);
  const oldCount = match[2] ? Number(match[2]) : 1;
  // newStart and newCount are parsed but not used; they are validated by regex
  return { oldStart, oldCount };
}

function findNextDiffHeader(lines: string[], fromIndex: number): number {
  for (let i = fromIndex; i < lines.length; i++) {
    if (lines[i]?.startsWith("diff --git ")) return i;
  }
  return lines.length;
}

function parseFileBlock(block: string[], startLineNumber: number): FileChange {
  let renameFrom: string | undefined;
  let renameTo: string | undefined;
  let oldPathLine: string | undefined;
  let newPathLine: string | undefined;

  for (let i = 0; i < block.length; i++) {
    const line = block[i];
    if (line?.startsWith("@@ ")) break;
    if (line?.startsWith("rename from ")) renameFrom = line.slice("rename from ".length).trim();
    else if (line?.startsWith("rename to ")) renameTo = line.slice("rename to ".length).trim();
    else if (line?.startsWith("--- ")) oldPathLine = line.slice("--- ".length).trim();
    else if (line?.startsWith("+++ ")) newPathLine = line.slice("+++ ".length).trim();
  }

  if (renameFrom !== undefined && renameTo !== undefined) {
    return {
      oldPath: renameFrom,
      newPath: renameTo,
      status: "renamed",
      oldLines: [],
    };
  }

  if (oldPathLine === undefined || newPathLine === undefined) {
    // Binary file notices carry the paths in a "Binary files a/x and b/y differ" line.
    for (const line of block) {
      if (line?.startsWith("@@ ")) break;
      if (line?.startsWith("Binary files ") && line.endsWith(" differ")) {
        const inner = line.slice("Binary files ".length, -" differ".length);
        const separator = inner.indexOf(" and ");
        if (separator > 0) {
          oldPathLine = inner.slice(0, separator);
          newPathLine = inner.slice(separator + " and ".length);
          break;
        }
      }
    }
  }

  if (oldPathLine === undefined || newPathLine === undefined) {
    throw new TestImpactError(
      "invalid_diff",
      `Invalid diff at line ${startLineNumber}: missing file headers`,
    );
  }

  const oldPath = stripGitPathPrefix(oldPathLine);
  const newPath = stripGitPathPrefix(newPathLine);

  let status: FileChangeStatus;
  if (oldPath === "") status = "added";
  else if (newPath === "") status = "deleted";
  else status = "modified";

  const oldLines: number[] = [];
  let i = 0;
  while (i < block.length) {
    const line = block[i];
    if (line?.startsWith("@@ ")) {
      const lineNumber = startLineNumber + i;
      const { oldStart, oldCount } = parseHunkHeader(line, lineNumber);
      if (oldCount === 0) {
        if (oldStart > 0) oldLines.push(oldStart);
        i++;
        continue;
      }
      let currentOldLine = oldStart;
      i++;
      while (i < block.length) {
        const hunkLine = block[i];
        if (hunkLine?.startsWith("@@ ") || hunkLine?.startsWith("diff --git ")) break;
        if (hunkLine === "\\ No newline at end of file") {
          i++;
          continue;
        }
        const prefix = hunkLine?.[0];
        if (prefix === " ") {
          currentOldLine++;
        } else if (prefix === "-") {
          oldLines.push(currentOldLine);
          currentOldLine++;
        }
        // prefix '+' does not affect currentOldLine
        i++;
      }
    } else {
      i++;
    }
  }

  return {
    oldPath,
    newPath,
    status,
    oldLines,
  };
}

export function parseDiff(text: string, opts: { maxBytes?: number } = {}): FileChange[] {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_DIFF_BYTES;
  if (utf8ByteLength(text) > maxBytes) {
    throw new TestImpactError(
      "input_too_large",
      `Diff input exceeds maximum allowed size (${maxBytes} bytes)`,
    );
  }

  const rawLines = text.split("\n");
  const lines = rawLines.map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));

  const changes: FileChange[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line?.startsWith("diff --git ")) {
      i++;
      continue;
    }
    const fileEnd = findNextDiffHeader(lines, i + 1);
    const block = lines.slice(i, fileEnd);
    changes.push(parseFileBlock(block, i + 1));
    i = fileEnd;
  }
  return changes;
}

export function parseCoverageMap(
  json: string,
  opts: { maxBytes?: number; maxTests?: number } = {},
): CoverageMap {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_COVERAGE_BYTES;
  const maxTests = opts.maxTests ?? DEFAULT_MAX_TESTS;

  if (utf8ByteLength(json) > maxBytes) {
    throw new TestImpactError(
      "input_too_large",
      `Coverage map input exceeds maximum allowed size (${maxBytes} bytes)`,
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (err) {
    throw new TestImpactError("invalid_json", `Invalid JSON: ${clip((err as Error).message)}`);
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("tests" in data) ||
    typeof data.tests !== "object" ||
    data.tests === null ||
    Array.isArray(data.tests)
  ) {
    throw new TestImpactError(
      "invalid_map",
      'Coverage map must be an object with a "tests" object',
    );
  }

  const testsObj = data.tests as Record<string, unknown>;
  if (Object.keys(testsObj).length > maxTests) {
    throw new TestImpactError(
      "too_many_tests",
      `Too many tests: ${Object.keys(testsObj).length} exceeds ${maxTests}`,
    );
  }

  const result: CoverageMap = {
    tests: Object.create(null) as Record<string, Record<string, CoverageRange[]>>,
  };
  for (const [testId, fileMap] of Object.entries(testsObj)) {
    if (typeof fileMap !== "object" || fileMap === null || Array.isArray(fileMap)) {
      throw new TestImpactError("invalid_map", `Test ${clip(testId)} has invalid coverage data`);
    }
    result.tests[testId] = Object.create(null) as Record<string, CoverageRange[]>;
    for (const [filePath, ranges] of Object.entries(fileMap as Record<string, unknown>)) {
      if (!Array.isArray(ranges)) {
        throw new TestImpactError(
          "invalid_map",
          `File ${clip(filePath)} for test ${clip(testId)} has invalid ranges`,
        );
      }
      const parsedRanges: CoverageRange[] = [];
      for (const range of ranges) {
        if (
          !Array.isArray(range) ||
          range.length !== 2 ||
          typeof range[0] !== "number" ||
          typeof range[1] !== "number"
        ) {
          throw new TestImpactError(
            "invalid_map",
            `Invalid range for file ${clip(filePath)} in test ${clip(testId)}`,
          );
        }
        const start = range[0];
        const end = range[1];
        if (
          !Number.isInteger(start) ||
          !Number.isInteger(end) ||
          start < 1 ||
          end < 1 ||
          start > end
        ) {
          throw new TestImpactError(
            "invalid_map",
            `Invalid range [${start}, ${end}] for file ${clip(filePath)} in test ${clip(testId)}`,
          );
        }
        parsedRanges.push([start, end]);
      }
      result.tests[testId][filePath] = parsedRanges;
    }
  }
  return result;
}

function makeRelativePath(absPath: string, root: string): string {
  const normalizedRoot = root.endsWith("/") ? root.slice(0, -1) : root;
  if (absPath === normalizedRoot) return "";
  if (!absPath.startsWith(`${normalizedRoot}/`)) {
    throw new TestImpactError(
      "invalid_map",
      `Path ${clip(absPath)} is not under root ${clip(root)}`,
    );
  }
  return absPath.slice(normalizedRoot.length + 1);
}

function mergeRanges(ranges: CoverageRange[]): CoverageRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const first = sorted[0];
  if (!first) return [];
  const merged: CoverageRange[] = [first];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (!current) continue;
    const last = merged[merged.length - 1];
    if (!last) continue;
    if (current[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push([current[0], current[1]]);
    }
  }
  return merged;
}

export function fromIstanbul(
  testId: string,
  coverage: unknown,
  opts: { root: string },
): CoverageMap {
  if (typeof coverage !== "object" || coverage === null || Array.isArray(coverage)) {
    throw new TestImpactError("invalid_map", "Istanbul coverage must be an object");
  }

  const fileMap = coverage as Record<string, unknown>;
  const testFiles = Object.create(null) as Record<string, CoverageRange[]>;
  const result: CoverageMap = {
    tests: Object.create(null) as Record<string, Record<string, CoverageRange[]>>,
  };

  for (const [absPath, fileData] of Object.entries(fileMap)) {
    if (typeof fileData !== "object" || fileData === null || Array.isArray(fileData)) {
      throw new TestImpactError("invalid_map", `Invalid data for file ${clip(absPath)}`);
    }
    const { statementMap, s } = fileData as { statementMap?: unknown; s?: unknown };
    if (
      typeof statementMap !== "object" ||
      statementMap === null ||
      typeof s !== "object" ||
      s === null
    ) {
      throw new TestImpactError("invalid_map", `Invalid Istanbul data for file ${clip(absPath)}`);
    }

    const relPath = makeRelativePath(absPath, opts.root);
    const ranges: CoverageRange[] = [];

    for (const [stmtId, stmt] of Object.entries(statementMap as Record<string, unknown>)) {
      const count = (s as Record<string, unknown>)[stmtId];
      if (typeof count !== "number" || !Number.isFinite(count)) {
        throw new TestImpactError(
          "invalid_map",
          `Invalid count for statement ${clip(stmtId)} in file ${clip(absPath)}`,
        );
      }
      if (count <= 0) continue;

      if (typeof stmt !== "object" || stmt === null || !("start" in stmt) || !("end" in stmt)) {
        throw new TestImpactError(
          "invalid_map",
          `Invalid statement map for ${clip(stmtId)} in file ${clip(absPath)}`,
        );
      }
      const startLine = (stmt as { start: { line: unknown } }).start.line;
      const endLine = (stmt as { end: { line: unknown } }).end.line;
      if (
        typeof startLine !== "number" ||
        typeof endLine !== "number" ||
        !Number.isInteger(startLine) ||
        !Number.isInteger(endLine) ||
        startLine < 1 ||
        endLine < startLine
      ) {
        throw new TestImpactError(
          "invalid_map",
          `Invalid line numbers for statement ${clip(stmtId)} in file ${clip(absPath)}`,
        );
      }
      ranges.push([startLine, endLine]);
    }

    if (ranges.length > 0) {
      testFiles[relPath] = mergeRanges(ranges);
    }
  }

  result.tests[testId] = testFiles;
  return result;
}

function findTestsCoveringFile(map: CoverageMap, filePath: string): string[] {
  const impacted: string[] = [];
  for (const [testId, files] of Object.entries(map.tests)) {
    if (Object.hasOwn(files, filePath)) impacted.push(testId);
  }
  return impacted.sort();
}

function findTestsCoveringLines(map: CoverageMap, filePath: string, lines: number[]): string[] {
  if (lines.length === 0) return [];
  const impacted: string[] = [];
  for (const [testId, files] of Object.entries(map.tests)) {
    const ranges = Object.hasOwn(files, filePath) ? files[filePath] : undefined;
    if (!ranges) continue;
    const hasLine = lines.some((line) =>
      ranges.some(([start, end]) => line >= start && line <= end),
    );
    if (hasLine) impacted.push(testId);
  }
  return impacted.sort();
}

export function impact(changes: FileChange[], map: CoverageMap): ImpactReport {
  const impactedTestsSet = new Set<string>();
  const uncovered: string[] = [];
  const newFiles: string[] = [];
  const byFile = Object.create(null) as Record<string, string[]>;

  for (const change of changes) {
    switch (change.status) {
      case "added":
        newFiles.push(change.newPath);
        break;
      case "deleted": {
        const impacted = findTestsCoveringFile(map, change.oldPath);
        for (const t of impacted) impactedTestsSet.add(t);
        if (impacted.length === 0) {
          if (change.oldLines.length > 0) uncovered.push(change.oldPath);
        } else {
          byFile[change.oldPath] = impacted;
        }
        break;
      }
      case "renamed": {
        const impacted = findTestsCoveringFile(map, change.oldPath);
        for (const t of impacted) impactedTestsSet.add(t);
        if (impacted.length > 0) byFile[change.newPath] = impacted;
        break;
      }
      case "modified": {
        const impacted = findTestsCoveringLines(map, change.oldPath, change.oldLines);
        for (const t of impacted) impactedTestsSet.add(t);
        if (impacted.length === 0) {
          uncovered.push(change.newPath);
        } else {
          byFile[change.newPath] = impacted;
        }
        break;
      }
    }
  }

  const tests = Array.from(impactedTestsSet).sort();
  uncovered.sort();
  newFiles.sort();
  for (const file of Object.keys(byFile)) {
    byFile[file]?.sort();
  }

  return { tests, byFile, uncovered, newFiles };
}

export function renderReport(report: ImpactReport, format: "markdown" | "json"): string {
  if (format === "json") return `${JSON.stringify(report, null, 2)}\n`;

  const files = Object.keys(report.byFile).sort();
  const lines: string[] = [];
  lines.push("## Test impact");
  lines.push("");

  const testCount = report.tests.length;
  const fileCount = files.length;
  const testWord = testCount === 1 ? "test" : "tests";
  const fileWord = fileCount === 1 ? "file" : "files";
  lines.push(`${testCount} ${testWord} impacted by ${fileCount} changed ${fileWord}.`);
  lines.push("");

  lines.push("| File | Tests |");
  lines.push("| --- | --- |");
  for (const file of files) {
    const testList = report.byFile[file] ?? [];
    lines.push(`| ${file} | ${testList.join(", ")} |`);
  }

  if (report.uncovered.length > 0) {
    lines.push("");
    lines.push("### Uncovered changes");
    lines.push("");
    for (const file of report.uncovered) {
      lines.push(`- \`${file}\``);
    }
  }

  if (report.newFiles.length > 0) {
    lines.push("");
    lines.push("### New files");
    lines.push("");
    for (const file of report.newFiles) {
      lines.push(`- \`${file}\``);
    }
  }

  return `${lines.join("\n")}\n`;
}
