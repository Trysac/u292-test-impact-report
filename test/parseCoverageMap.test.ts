import { describe, expect, it } from "vitest";
import { parseCoverageMap, TestImpactError } from "../src/index.js";

function captureError(fn: () => unknown): TestImpactError | undefined {
  try {
    fn();
  } catch (err) {
    return err as TestImpactError;
  }
  return undefined;
}

describe("parseCoverageMap", () => {
  it("parses valid JSON with tests and ranges", () => {
    const json = JSON.stringify({
      tests: {
        t1: {
          "src/a.ts": [
            [1, 5],
            [10, 12],
          ],
        },
      },
    });
    const result = parseCoverageMap(json);
    expect(result).toEqual({
      tests: {
        t1: {
          "src/a.ts": [
            [1, 5],
            [10, 12],
          ],
        },
      },
    });
  });

  it("throws invalid_json on bad JSON", () => {
    const err = captureError(() => parseCoverageMap("{bad"));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("invalid_json");
  });

  it("throws invalid_map if top-level structure wrong", () => {
    const err = captureError(() => parseCoverageMap(JSON.stringify({ foo: "bar" })));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("invalid_map");
  });

  it("throws invalid_map for invalid range (start > end)", () => {
    const json = JSON.stringify({ tests: { t1: { "a.ts": [[3, 2]] } } });
    const err = captureError(() => parseCoverageMap(json));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("invalid_map");
  });

  it("throws too_many_tests if number of tests exceeds maxTests", () => {
    const tests: Record<string, unknown> = {};
    for (let i = 0; i < 3; i++) tests[`t${i}`] = {};
    const json = JSON.stringify({ tests });
    const err = captureError(() => parseCoverageMap(json, { maxTests: 2 }));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("too_many_tests");
  });

  it("throws too_many_tests over the 100 000 test default", () => {
    const tests: Record<string, Record<string, never>> = {};
    for (let i = 0; i <= 100_000; i++) tests[`t${i}`] = {};
    const err = captureError(() => parseCoverageMap(JSON.stringify({ tests })));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("too_many_tests");
  });

  it("throws input_too_large if byte length exceeds maxBytes", () => {
    const bigJson = JSON.stringify({ tests: { t: { "a.ts": [[1, 2]] } } });
    const err = captureError(() => parseCoverageMap(bigJson, { maxBytes: 10 }));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("input_too_large");
  });

  it("rejects a coverage map over the 50 MiB default", () => {
    const err = captureError(() => parseCoverageMap("a".repeat(52_428_801)));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("input_too_large");
  });

  it("keeps a __proto__ test id as an own key", () => {
    const json = '{"tests":{"__proto__":{"a.ts":[[1,2]]}}}';
    const result = parseCoverageMap(json);
    expect(Object.hasOwn(result.tests, "__proto__")).toBe(true);
    expect(result.tests["__proto__"]?.["a.ts"]).toEqual([[1, 2]]);
  });

  it("clips long values in error messages", () => {
    const longPath = "x".repeat(10_000);
    const json = JSON.stringify({ tests: { t1: { [longPath]: [[3, 2]] } } });
    const err = captureError(() => parseCoverageMap(json));
    expect(err).toBeInstanceOf(TestImpactError);
    expect(err?.code).toBe("invalid_map");
    expect((err as TestImpactError).message.length).toBeLessThanOrEqual(200);
  });
});
