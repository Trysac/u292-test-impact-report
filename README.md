# @trysac/test-impact-report

[![npm version](https://img.shields.io/npm/v/@trysac/test-impact-report.svg)](https://www.npmjs.com/package/@trysac/test-impact-report)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/Trysac/u292-test-impact-report)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

Report which tests a code change impacts by joining a unified diff with a per-test line coverage map. Converts Istanbul coverage and renders pull-request-ready reports.

## Installation

```bash
npm install @trysac/test-impact-report
```

## Usage

```typescript
import { parseDiff, parseCoverageMap, impact, renderReport } from '@trysac/test-impact-report';

const changes = parseDiff(diffText);
const coverage = parseCoverageMap(coverageJson);
const report = impact(changes, coverage);
console.log(renderReport(report, 'markdown'));
```

For collecting per-test coverage, see [docs/TESTING.md](docs/TESTING.md) for Vitest and Jest recipes.

## API

- `parseDiff(text, opts?)` → `FileChange[]`
- `parseCoverageMap(json, opts?)` → `CoverageMap`
- `fromIstanbul(testId, coverage, opts)` → `CoverageMap`
- `impact(changes, map)` → `ImpactReport`
- `renderReport(report, format)` → `string`
- `TestImpactError`

## CLI

```bash
node cli.js --diff changes.patch --coverage coverage-map.json --format markdown
```

Available flags: `--diff`, `--coverage`, `--format` (`markdown`|`json`), `--fail-on-uncovered`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Testing](docs/TESTING.md)
- [Security](docs/SECURITY.md)

## License

MIT
