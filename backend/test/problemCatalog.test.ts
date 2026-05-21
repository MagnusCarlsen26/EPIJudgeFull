import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { ProblemCatalog } from "../src/problems/problemCatalog.js";

describe("ProblemCatalog", () => {
  it("loads generated static problem metadata", async () => {
    const catalog = await ProblemCatalog.load(config.paths.manifestPath);
    const problem = catalog.get("advance_by_offsets");
    expect(problem.title).toBeTruthy();
    expect(problem.languages.python?.filename).toBe("advance_by_offsets.py");
    expect(problem.languages.cpp?.filename).toBe("advance_by_offsets.cc");
    expect(problem.languages.java?.filename).toBe("AdvanceByOffsets.java");
  });
});
