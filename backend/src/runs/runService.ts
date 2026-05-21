import { nanoid } from "nanoid";
import { z } from "zod";
import { adapters } from "../adapters/index.js";
import { config } from "../config.js";
import { HttpError, toApiError } from "../errors/httpError.js";
import type { Judge0Client } from "../judge0/judge0Client.js";
import { languageConfigs, type LanguageKey } from "../judge0/languageIds.js";
import { loadTestData } from "../packaging/testDataLoader.js";
import type { ProblemCatalog } from "../problems/problemCatalog.js";
import type { RunStore } from "./runStore.js";
import type { RunLimits, RunRecord, RunScope } from "./runTypes.js";

export const createRunSchema = z.object({
  problemId: z.string().min(1),
  language: z.enum(["python", "cpp", "java"]),
  code: z.string().min(1),
  scope: z.enum(["sample", "all"]).default("all")
});

export class RunService {
  constructor(private readonly deps: {
    judge0Client: Judge0Client;
    problemCatalog: ProblemCatalog;
    runStore: RunStore;
  }) {}

  async createRun(input: z.infer<typeof createRunSchema>): Promise<RunRecord> {
    const parsed = createRunSchema.parse(input);
    const sourceBytes = Buffer.byteLength(parsed.code, "utf8");
    if (sourceBytes > config.run.maxSourceBytes) {
      throw new HttpError(400, "CODE_TOO_LARGE", "Submitted source code is too large.");
    }

    const problem = this.deps.problemCatalog.get(parsed.problemId);
    this.deps.problemCatalog.requireLanguage(problem, parsed.language);

    const runId = `run_${nanoid(16)}`;
    const now = new Date().toISOString();
    const record = this.deps.runStore.create({
      runId,
      status: "queued",
      problemId: parsed.problemId,
      language: parsed.language,
      scope: parsed.scope,
      createdAt: now,
      updatedAt: now
    });

    try {
      const adapter = adapterFor(parsed.language);
      const testData = await loadTestData(this.deps.problemCatalog, problem, parsed.scope);
      const submission = await adapter.buildSubmission({
        problemId: parsed.problemId,
        language: parsed.language,
        code: parsed.code,
        scope: parsed.scope,
        problem,
        testData,
        limits: limitsFor(parsed.scope)
      });
      const created = await this.deps.judge0Client.createSubmission(submission);
      this.deps.runStore.markSubmitted(runId, created.token);
      console.log(`submitted runId=${runId} problemId=${parsed.problemId} language=${parsed.language} scope=${parsed.scope} token=${created.token}`);
      return this.deps.runStore.get(runId) ?? record;
    } catch (error) {
      const failed = this.deps.runStore.fail(runId, toApiError(error));
      console.log(`failed runId=${runId} problemId=${parsed.problemId} language=${parsed.language} scope=${parsed.scope} error=${failed?.error?.code || "INTERNAL_ERROR"}`);
      return failed ?? record;
    }
  }

  async getRun(runId: string): Promise<RunRecord> {
    const run = this.deps.runStore.get(runId);
    if (!run) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found.");
    if (run.status === "completed" || run.status === "error" || !run.judge0Token) return run;

    const output = await this.deps.judge0Client.getSubmission(run.judge0Token);
    if ([1, 2].includes(output.status.id)) return run;

    const adapter = adapterFor(run.language);
    const result = adapter.parseResult(output);
    const completed = this.deps.runStore.complete(runId, result);
    console.log(`completed runId=${runId} problemId=${run.problemId} language=${run.language} scope=${run.scope} verdict=${result.verdict} durationMs=${result.durationMs}`);
    return completed ?? run;
  }
}

function adapterFor(language: LanguageKey) {
  const adapter = adapters[language];
  if (!adapter) throw new HttpError(400, "UNSUPPORTED_LANGUAGE", "Unsupported language.");
  return adapter;
}

function limitsFor(scope: RunScope): RunLimits {
  const isSample = scope === "sample";
  return {
    cpuTimeLimit: isSample ? 5 : 15,
    wallTimeLimit: isSample ? 10 : config.run.timeoutSeconds,
    memoryLimitKb: config.run.memoryLimitKb,
    maxOutputBytes: config.run.maxOutputBytes
  };
}
