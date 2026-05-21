import { join } from "node:path";
import { config } from "../config.js";
import { languageConfigs } from "../judge0/languageIds.js";
import { FileBundle } from "../packaging/fileBundle.js";
import { normalizeJudge0Output } from "../runs/resultNormalizer.js";
import type { LanguageAdapter, BuildSubmissionInput } from "./languageAdapter.js";

export class PythonAdapter implements LanguageAdapter {
  language = "python" as const;

  async buildSubmission(input: BuildSubmissionInput) {
    const metadata = input.problem.languages.python;
    if (!metadata) throw new Error("Missing Python metadata.");

    const bundle = new FileBundle();
    await bundle.addDirectory(join(config.paths.runnersDir, "python"));
    bundle.addText(metadata.filename, input.code);
    bundle.addText(`test_data/${input.problemId}.tsv`, input.testData);
    bundle.addText("config.json", JSON.stringify({ timeoutSeconds: 0, numFailedTestsBeforeStop: 1 }));

    return {
      language_id: languageConfigs.python.judge0LanguageId,
      source_code: [
        "import runpy",
        "import sys",
        `sys.argv = [${JSON.stringify(metadata.filename)}, "--test-data-dir", "test_data", "--no-update-js"]`,
        `runpy.run_path(${JSON.stringify(metadata.filename)}, run_name="__main__")`
      ].join("\n"),
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
