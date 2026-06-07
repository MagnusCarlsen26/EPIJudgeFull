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

const acceptedOutput: Judge0Output = {
  stdout: "3 / 3\n",
  stderr: "",
  compile_output: "",
  message: "",
  status: { id: 3, description: "Accepted" },
  time: "0.2",
  memory: 2048,
};

describe("RunService", () => {
  it("creates and completes an async run with mocked Judge0", async () => {
    const judge0Client = new MockJudge0Client(acceptedOutput);
    const service = new RunService({
      judge0Client,
      problemCatalog: await ProblemCatalog.load(config.paths.manifestPath),
      runStore: new RunStore(3600),
    });

    const created = await service.createRun({
      problemId: "advance_by_offsets",
      language: "python",
      code: "def can_reach_end(A):\n    return True\n",
      scope: "sample",
    });
    expect(created.status).toBe("running");
    expect(judge0Client.createdSubmission?.language_id).toBe(71);

    const completed = await service.getRun(created.runId);
    expect(completed.status).toBe("completed");
    expect(completed.result?.verdict).toBe("passed");
  });

  it("submits C++ runs with Judge0 language id 54 and argv rewrite", async () => {
    const judge0Client = new MockJudge0Client(acceptedOutput);
    const service = new RunService({
      judge0Client,
      problemCatalog: await ProblemCatalog.load(config.paths.manifestPath),
      runStore: new RunStore(3600),
    });

    const cppCode = [
      '#include "test_framework/generic_test.h"',
      "int main(int argc, char* argv[]) {",
      '  std::vector<std::string> args{argv + 1, argv + argc};',
      "  return 0;",
      "}",
    ].join("\n");

    const created = await service.createRun({
      problemId: "parity",
      language: "cpp",
      code: cppCode,
      scope: "sample",
    });
    expect(created.status).toBe("running");
    expect(judge0Client.createdSubmission?.language_id).toBe(54);
    expect(judge0Client.createdSubmission?.source_code).toContain('"--test-data-dir", "test_data"');
    expect(judge0Client.createdSubmission?.source_code).not.toContain("argv + 1");

    const completed = await service.getRun(created.runId);
    expect(completed.status).toBe("completed");
    expect(completed.result?.verdict).toBe("passed");
  });

  it("submits Java runs with Judge0 language id 62 and Main class rename", async () => {
    const judge0Client = new MockJudge0Client(acceptedOutput);
    const service = new RunService({
      judge0Client,
      problemCatalog: await ProblemCatalog.load(config.paths.manifestPath),
      runStore: new RunStore(3600),
    });

    const javaCode = [
      "package epi;",
      "import java.util.*;",
      "public class Parity {",
      '  public static void main(String[] args) { TestFramework.runFromAnnotations(args, "Parity", new TestFramework.TestConfig()); }',
      "}",
    ].join("\n");

    const created = await service.createRun({
      problemId: "parity",
      language: "java",
      code: javaCode,
      scope: "sample",
    });
    expect(created.status).toBe("running");
    expect(judge0Client.createdSubmission?.language_id).toBe(62);
    expect(judge0Client.createdSubmission?.source_code).toContain("public class Main");
    expect(judge0Client.createdSubmission?.source_code).toContain('"--test-data-dir", "test_data"');
    expect(judge0Client.createdSubmission?.source_code).not.toMatch(/^package\s+epi;/m);

    const completed = await service.getRun(created.runId);
    expect(completed.status).toBe("completed");
    expect(completed.result?.verdict).toBe("passed");
  });
});
