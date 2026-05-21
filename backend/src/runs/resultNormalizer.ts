import type { Judge0Output } from "../judge0/judge0Types.js";
import type { NormalizedRunResult, RunVerdict } from "./runTypes.js";

const STATS_RE = /(?<passed>\d+)\s*\/\s*(?<total>\d+)/g;

export function normalizeJudge0Output(output: Judge0Output): NormalizedRunResult {
  const stdout = output.stdout || "";
  const stderr = output.stderr || "";
  const compileOutput = output.compile_output || "";
  const message = output.message || "";
  const statusId = output.status?.id ?? 0;
  const parsed = parseOutputStats(stdout);
  const verdict = verdictFor(statusId, parsed);

  return {
    verdict,
    passed: parsed?.passed ?? 0,
    total: parsed?.total ?? 0,
    exitCode: exitCodeFor(statusId),
    durationMs: output.time ? Math.round(Number(output.time) * 1000) : 0,
    memoryKb: output.memory ?? 0,
    stdout,
    stderr,
    compileOutput,
    message
  };
}

export function parseOutputStats(stdout: string): { passed: number; total: number } | null {
  const matches = [...stdout.matchAll(STATS_RE)];
  const match = matches.at(-1);
  if (!match?.groups) return null;
  return { passed: Number(match.groups.passed), total: Number(match.groups.total) };
}

function verdictFor(statusId: number, stats: { passed: number; total: number } | null): RunVerdict {
  if (statusId === 6) return "compile_error";
  if ([5, 13].includes(statusId)) return "timeout";
  if (statusId !== 3) return "runtime_error";
  if (!stats || stats.total === 0) return "internal_error";
  return stats.passed >= stats.total ? "passed" : "failed";
}

function exitCodeFor(statusId: number): number {
  return statusId === 3 ? 0 : 1;
}
