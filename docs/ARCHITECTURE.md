# Architecture

`@trysac/test-impact-report` is a pure TypeScript library with no runtime dependencies.

## Modules

- `src/index.ts` — core API: diff parsing, coverage map parsing, Istanbul conversion, impact calculation, and report rendering.
- `src/cli.ts` — node-based CLI wrapper that reads files and invokes the core functions.

## Design decisions

- **Per-test coverage maps** provide exact test-file relationships without static analysis.
- **Unified diff parsing** handles standard git diff format, including renames and binary files.
- **Old-side line numbers** are used because the coverage map describes the base revision.

## Data flow

1. Parse unified diff into `FileChange[]`.
2. Parse coverage JSON into `CoverageMap`.
3. Compute `ImpactReport` by matching changed old lines against test ranges.
4. Render markdown or JSON.
