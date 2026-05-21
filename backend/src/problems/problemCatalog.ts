import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { HttpError } from "../errors/httpError.js";
import type { LanguageKey } from "../judge0/languageIds.js";
import type { ManifestFile, ProblemMetadata, ProblemsFile } from "./problemTypes.js";

export class ProblemCatalog {
  private constructor(private readonly problemsById: Map<string, ProblemMetadata>) {}

  static async load(manifestPath: string): Promise<ProblemCatalog> {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as ManifestFile;
    const problemsPath = resolve(dirname(manifestPath), manifest.problems.replace(/^\/data\//, ""));
    const problemsFile = JSON.parse(await readFile(problemsPath, "utf8")) as ProblemsFile;
    const problems = problemsFile.chapters.flatMap((chapter) => chapter.problems);
    return new ProblemCatalog(new Map(problems.map((problem) => [problem.id, problem])));
  }

  get(problemId: string): ProblemMetadata {
    const problem = this.problemsById.get(problemId);
    if (!problem) throw new HttpError(404, "UNKNOWN_PROBLEM", "Unknown problem id.");
    return problem;
  }

  requireLanguage(problem: ProblemMetadata, language: LanguageKey) {
    const metadata = problem.languages[language];
    if (!metadata) throw new HttpError(400, "UNSUPPORTED_LANGUAGE", "Problem does not support this language.");
    return metadata;
  }

  testDataFilename(problem: ProblemMetadata): string {
    return `${problem.id}.tsv`;
  }

  all(): ProblemMetadata[] {
    return [...this.problemsById.values()];
  }
}
