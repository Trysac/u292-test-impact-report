# Project record: test-impact-report

## Objective

Report which tests a code change impacts from a per-test line coverage map and a unified diff, with Istanbul conversion, rename handling and uncovered-change detection

State the measurable outcome this utility must deliver and who it is for.

## Scope

In scope:

- The public API documented in the README.

Out of scope:

- List what this utility deliberately does not do.

## Timeline

| Date | Milestone |
|---|---|
| 2026 | Repository created from the factory utility template. |

## Effort metrics

Measured values only. Leave "pending measurement" until a real figure is recorded; never estimate here.

| Metric | Value | Source |
|---|---|---|
| Tokens (input / output) | 989773 / 86999 | factory ledger |
| Hours (human) | pending measurement | time log |
| Cost (USD) | 0.1139 | factory ledger |

## Factory run u292 (measured from API usage)

| Date (UTC) | Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|---|
| 2026-11-10 | generation | deepseek-v4-pro | yes | 1795 | 32423 | 0 | 3584 | 0.0655 |
| 2026-11-11 | fix-1 | deepseek-flash | no | 19203 | 4525 | 0 | 171392 | 0.0061 |
| 2026-11-11 | fix-2 | deepseek-flash | no | 11405 | 1701 | 0 | 60416 | 0.0029 |
| 2026-11-11 | audit | deepseek-flash | no | 19808 | 19010 | 0 | 295808 | 0.0153 |
| 2026-11-11 | fix-3 | deepseek-flash | no | 17931 | 13340 | 0 | 369792 | 0.0118 |
| 2026-11-11 | docs | deepseek-flash | no | 18255 | 16000 | 0 | 384 | 0.0123 |

Total: $0.1139. Prices: deepseek line, as measured by its adapter. Providers serve the current version of each model id, so the date tells which version answered; versions, launch stages and price sources per line are in the factory's model register (docs/MODELS.md).
