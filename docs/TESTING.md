# Testing

## Running tests

```bash
npm test
```

Coverage thresholds are enforced at 80%.

## Collecting per-test coverage

### Vitest

Configure `vitest.config.ts` with `coverage.reporter` and `coverage.reportsDirectory`, then use `--coverage` and a custom reporter to capture per-test coverage.

### Jest

Use `jest --coverage --coverageReporters=json` and parse `coverage-final.json`; each file's `statementMap` and `s` arrays provide per-statement execution counts for the entire suite, not per test. Per-test coverage requires a custom reporter extending Istanbul's reporter to capture coverage per test.
