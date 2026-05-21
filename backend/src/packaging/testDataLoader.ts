import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";
import { HttpError } from "../errors/httpError.js";
import type { ProblemCatalog } from "../problems/problemCatalog.js";
import type { ProblemMetadata } from "../problems/problemTypes.js";
import type { RunScope } from "../runs/runTypes.js";

export async function loadTestData(catalog: ProblemCatalog, problem: ProblemMetadata, scope: RunScope): Promise<string> {
  const path = join(config.paths.testDataDir, catalog.testDataFilename(problem));
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch {
    throw new HttpError(500, "TEST_DATA_NOT_FOUND", "Could not find test data for this problem.");
  }
  if (scope === "all") return contents;
  return sampleByLines(contents);
}

function sampleByLines(contents: string): string {
  const lines = contents.split(/(?<=\n)/);
  return lines.slice(0, 4).join("");
}
