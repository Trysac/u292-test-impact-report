# Use per-test line coverage and unified diffs for precise test impact

Status: accepted (generated, pending human review)

## Context

Large TypeScript test suites run every test on every pull request, wasting time. Folder heuristics miss real dependencies. Per-test coverage maps already record which lines each test executed.

## Decision

Implement a library that joins a git unified diff with a per-test line coverage map to determine exactly which tests are impacted by changes and which changed lines are not covered by any test.

## Consequences

Enables efficient test selection and identifies untested changed code. Does not handle dynamic test dependencies or renames with edits; out of scope. Requires per-test coverage collection tooling.
