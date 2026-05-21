import { describe, expect, it } from "vitest";
import { Judge0Client } from "../src/judge0/judge0Client.js";
import type { Judge0Output, Judge0Submission } from "../src/judge0/judge0Types.js";
import { ProblemCatalog } from "../src/problems/problemCatalog.js";
import { config } from "../src/config.js";
import { RunStore } from "../src/runs/runStore.js";
import { RunService } from "../src/runs/runService.js";

class MockJudge0Client extends Judge0Client {
  public createdSubmission: Judge0Submission | null = null;
  constructor(private readonly output: Judge0Output) {
    super({ baseUrl: "http://judge0.test", authToken: "", wait: false });
  }
  override async createSubmission(submission: Judge0Submission) {
    this.createdSubmission = submission;
    return { token: "token-1" };
  }
  override async getSubmission() {
    return this.output;
  }
}

describe("RunService", () => {
  it("creates and completes an async run with mocked Judge0", async () => {
    const judge0Client = new MockJudge0Client({
      stdout: "3 / 3\n",
      stderr: "",
      compile_output: "",
      message: "",
      status: { id: 3, description: "Accepted" },
      time: "0.2",
      memory: 2048
    });
    const service = new RunService({
      judge0Client,
      problemCatalog: await ProblemCatalog.load(config.paths.manifestPath),
      runStore: new RunStore(3600)
    });

    const created = await service.createRun({
      problemId: "advance_by_offsets",
      language: "python",
      code: "def can_reach_end(A):\n    return True\n",
      scope: "sample"
    });
    expect(created.status).toBe("running");
    expect(judge0Client.createdSubmission?.language_id).toBe(71);

    const completed = await service.getRun(created.runId);
    expect(completed.status).toBe("completed");
    expect(completed.result?.verdict).toBe("passed");
  });
});
