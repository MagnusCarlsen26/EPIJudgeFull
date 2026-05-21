import type { LanguageKey } from "../judge0/languageIds.js";

export type RunScope = "sample" | "all";
export type RunStatus = "queued" | "running" | "completed" | "error";
export type RunVerdict = "passed" | "failed" | "compile_error" | "runtime_error" | "timeout" | "internal_error";

export interface RunLimits {
  cpuTimeLimit: number;
  wallTimeLimit: number;
  memoryLimitKb: number;
  maxOutputBytes: number;
}

export interface NormalizedRunResult {
  verdict: RunVerdict;
  passed: number;
  total: number;
  exitCode: number;
  durationMs: number;
  memoryKb: number;
  stdout: string;
  stderr: string;
  compileOutput: string;
  message: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
}

export interface RunRecord {
  runId: string;
  judge0Token?: string;
  status: RunStatus;
  problemId: string;
  language: LanguageKey;
  scope: RunScope;
  createdAt: string;
  updatedAt: string;
  result?: NormalizedRunResult;
  error?: ApiErrorPayload;
}
