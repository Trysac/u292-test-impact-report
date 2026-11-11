import { promises as fs } from "node:fs";
import { impact, parseCoverageMap, parseDiff, renderReport, TestImpactError } from "./index.js";

export interface CLI_IO {
  stdout: { write(data: string): void };
  stderr: { write(data: string): void };
}

export async function run(argv: string[], io: CLI_IO): Promise<number> {
  let diffPath: string | undefined;
  let coveragePath: string | undefined;
  let format: "markdown" | "json" = "markdown";
  let failOnUncovered = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--diff":
        if (i + 1 >= argv.length) return usageError(io, "Missing value for --diff");
        diffPath = argv[++i];
        break;
      case "--coverage":
        if (i + 1 >= argv.length) return usageError(io, "Missing value for --coverage");
        coveragePath = argv[++i];
        break;
      case "--format": {
        if (i + 1 >= argv.length) return usageError(io, "Missing value for --format");
        const fmt = argv[++i];
        if (fmt !== "markdown" && fmt !== "json") return usageError(io, `Invalid format: ${fmt}`);
        format = fmt;
        break;
      }
      case "--fail-on-uncovered":
        failOnUncovered = true;
        break;
      default:
        return usageError(io, `Unknown argument: ${arg}`);
    }
  }

  if (!diffPath || !coveragePath) {
    return usageError(io, "Missing required arguments: --diff and --coverage");
  }

  try {
    const [diffText, coverageText] = await Promise.all([
      fs.readFile(diffPath, "utf8"),
      fs.readFile(coveragePath, "utf8"),
    ]);
    const changes = parseDiff(diffText);
    const coverageMap = parseCoverageMap(coverageText);
    const report = impact(changes, coverageMap);
    const output = renderReport(report, format);
    io.stdout.write(output);
    return failOnUncovered && report.uncovered.length > 0 ? 1 : 0;
  } catch (err) {
    if (err instanceof TestImpactError) {
      io.stderr.write(`Error: ${err.message}\n`);
      return 2;
    }
    io.stderr.write(`Unexpected error: ${(err as Error).message}\n`);
    return 2;
  }
}

function usageError(io: CLI_IO, message: string): number {
  io.stderr.write(`Usage error: ${message}\n`);
  return 2;
}
