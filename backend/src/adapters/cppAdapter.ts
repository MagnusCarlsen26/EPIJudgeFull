import { join } from "node:path";
import { config } from "../config.js";
import { languageConfigs } from "../judge0/languageIds.js";
import { FileBundle } from "../packaging/fileBundle.js";
import { normalizeJudge0Output } from "../runs/resultNormalizer.js";
import type { LanguageAdapter, BuildSubmissionInput } from "./languageAdapter.js";

export class CppAdapter implements LanguageAdapter {
  language = "cpp" as const;

  async buildSubmission(input: BuildSubmissionInput) {
    const metadata = input.problem.languages.cpp;
    if (!metadata) throw new Error("Missing C++ metadata.");

    const bundle = new FileBundle();
    await bundle.addDirectory(join(config.paths.runnersDir, "cpp"));
    bundle.addText(`test_data/${input.problemId}.tsv`, input.testData);
    bundle.addText("config.json", JSON.stringify({ timeoutSeconds: 0, numFailedTestsBeforeStop: 1 }));

    return {
      language_id: languageConfigs.cpp.judge0LanguageId,
      source_code: forceCppTestDataDir(input.code),
      additional_files: await bundle.toBase64Zip(),
      cpu_time_limit: input.limits.cpuTimeLimit,
      wall_time_limit: input.limits.wallTimeLimit,
      memory_limit: input.limits.memoryLimitKb,
      max_file_size: input.limits.maxOutputBytes,
      redirect_stderr_to_stdout: false
    };
  }

  parseResult = normalizeJudge0Output;
}

function forceCppTestDataDir(code: string): string {
  const replacement = 'std::vector<std::string> args{"--test-data-dir", "test_data"};';
  return code.replace(/std::vector<std::string>\s+args\s*\{argv\s*\+\s*1,\s*argv\s*\+\s*argc\};/, replacement);
}
