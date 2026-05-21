import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { loadTestData } from "../src/packaging/testDataLoader.js";
import { ProblemCatalog } from "../src/problems/problemCatalog.js";

describe("testDataLoader", () => {
  it("loads sample and all scopes", async () => {
    const catalog = await ProblemCatalog.load(config.paths.manifestPath);
    const problem = catalog.get("advance_by_offsets");
    const sample = await loadTestData(catalog, problem, "sample");
    const all = await loadTestData(catalog, problem, "all");

    expect(sample.split("\n").filter(Boolean).length).toBeLessThan(all.split("\n").filter(Boolean).length);
    expect(sample).toContain("\t");
    expect(all).toContain(sample.trimEnd());
  });
});
