import { describe, expect, it } from "vitest";
import { normalizeJudge0Output, parseOutputStats } from "../src/runs/resultNormalizer.js";
import type { Judge0Output } from "../src/judge0/judge0Types.js";

function output(statusId: number, stdout = "", extra: Partial<Judge0Output> = {}): Judge0Output {
  return {
    stdout,
    stderr: "",
    compile_output: "",
    message: "",
    status: { id: statusId, description: "" },
    time: "0.123",
    memory: 1234,
    ...extra
  };
}

describe("resultNormalizer", () => {
  it("parses the last N / M stats line", () => {
    expect(parseOutputStats("1 / 3\n3 / 3\n")).toEqual({ passed: 3, total: 3 });
  });

  it("maps accepted full pass to passed", () => {
    expect(normalizeJudge0Output(output(3, "3 / 3\n")).verdict).toBe("passed");
  });

  it("maps accepted partial pass to failed", () => {
    expect(normalizeJudge0Output(output(3, "2 / 3\n")).verdict).toBe("failed");
  });

  it("maps nonzero EPI assertion output to failed", () => {
    expect(normalizeJudge0Output(output(11, "Test FAILED\n*** You've passed 1/3 tests. ***\n")).verdict).toBe("failed");
  });

  it("maps compile and timeout statuses", () => {
    expect(normalizeJudge0Output(output(6)).verdict).toBe("compile_error");
    expect(normalizeJudge0Output(output(5)).verdict).toBe("timeout");
  });
});
