import type { ApiErrorPayload, NormalizedRunResult, RunRecord } from "./runTypes.js";

export class RunStore {
  private readonly runs = new Map<string, RunRecord>();

  constructor(private readonly ttlSeconds: number) {
    setInterval(() => this.cleanup(), 60_000).unref();
  }

  create(record: RunRecord): RunRecord {
    this.runs.set(record.runId, record);
    return record;
  }

  get(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  markSubmitted(runId: string, judge0Token: string): RunRecord | undefined {
    return this.patch(runId, { judge0Token, status: "running" });
  }

  complete(runId: string, result: NormalizedRunResult): RunRecord | undefined {
    return this.patch(runId, { status: "completed", result });
  }

  fail(runId: string, error: ApiErrorPayload): RunRecord | undefined {
    return this.patch(runId, { status: "error", error });
  }

  private patch(runId: string, values: Partial<RunRecord>): RunRecord | undefined {
    const current = this.runs.get(runId);
    if (!current) return undefined;
    const next = { ...current, ...values, updatedAt: new Date().toISOString() };
    this.runs.set(runId, next);
    return next;
  }

  private cleanup(): void {
    const now = Date.now();
    const terminalTtlMs = this.ttlSeconds * 1000;
    const staleRunningTtlMs = 15 * 60 * 1000;
    for (const [runId, run] of this.runs) {
      const age = now - Date.parse(run.updatedAt);
      if ((run.status === "completed" || run.status === "error") && age > terminalTtlMs) {
        this.runs.delete(runId);
      } else if ((run.status === "queued" || run.status === "running") && age > staleRunningTtlMs) {
        this.runs.delete(runId);
      }
    }
  }
}
