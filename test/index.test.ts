import { describe, expect, it } from "vitest";
import * as pkg from "../src/index.js";

describe("public API", () => {
  it("exports all expected functions", () => {
    expect(typeof pkg.parseDiff).toBe("function");
    expect(typeof pkg.parseCoverageMap).toBe("function");
    expect(typeof pkg.fromIstanbul).toBe("function");
    expect(typeof pkg.impact).toBe("function");
    expect(typeof pkg.renderReport).toBe("function");
    expect(typeof pkg.TestImpactError).toBe("function");
  });
});
