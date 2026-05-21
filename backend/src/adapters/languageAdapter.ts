import type { Judge0Output, Judge0Submission } from "../judge0/judge0Types.js";
import type { LanguageKey } from "../judge0/languageIds.js";
import type { ProblemMetadata } from "../problems/problemTypes.js";
import type { NormalizedRunResult, RunLimits, RunScope } from "../runs/runTypes.js";

export interface BuildSubmissionInput {
  problemId: string;
  language: LanguageKey;
  code: string;
  scope: RunScope;
  problem: ProblemMetadata;
  testData: string;
  limits: RunLimits;
}

export interface LanguageAdapter {
  language: LanguageKey;
  buildSubmission(input: BuildSubmissionInput): Promise<Judge0Submission>;
  parseResult(output: Judge0Output): NormalizedRunResult;
}
