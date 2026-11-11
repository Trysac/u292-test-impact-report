# test-impact-report

[![npm version](https://img.shields.io/npm/v/@trysac/test-impact-report.svg)](https://www.npmjs.com/package/@trysac/test-impact-report)
[![license: MIT](https://img.shields.io/npm/l/@trysac/test-impact-report.svg)](LICENSE)
[![CI](https://github.com/Trysac/u292-test-impact-report/actions/workflows/ci.yml/badge.svg)](https://github.com/Trysac/u292-test-impact-report/actions/workflows/ci.yml)

Report which tests a code change impacts from a per-test line coverage map and a unified diff, with Istanbul conversion, rename handling and uncovered-change detection

## Problem

Describe in two or three sentences the concrete problem this utility solves, who hits it, and why existing
packages do not solve it well. Keep it factual; link to an issue or decision record when there is one.

## Install

```sh
npm install @trysac/test-impact-report
```

Requires Node.js 20 or newer. The package ships ES modules with TypeScript declarations.

## Usage

```ts
import { greet } from "@trysac/test-impact-report";

// Build a greeting; surrounding whitespace is ignored.
const message = greet("  Ada ");
console.log(message); // "Hello, Ada!"

try {
  greet("   ");
} catch (error) {
  console.error((error as Error).message); // "name must not be empty"
}
```

## API

| Export | Signature | Description |
|---|---|---|
| `greet` | `(name: string) => string` | Placeholder API; replace it with the real one. |

## Development

```sh
npm install
npm run check   # lint, format, types, tests with coverage, docs, secrets
```

See [AGENTS.md](AGENTS.md) for the full command list and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## License

[MIT](LICENSE) © 2026 Miguel Gomez
