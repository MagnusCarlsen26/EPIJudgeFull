import { join } from "node:path";
import { config } from "../config.js";
import { languageConfigs } from "../judge0/languageIds.js";
import { FileBundle } from "../packaging/fileBundle.js";
import { normalizeJudge0Output } from "../runs/resultNormalizer.js";
import type { LanguageAdapter, BuildSubmissionInput } from "./languageAdapter.js";

export class JavaAdapter implements LanguageAdapter {
  language = "java" as const;

  async buildSubmission(input: BuildSubmissionInput) {
    const metadata = input.problem.languages.java;
    if (!metadata) throw new Error("Missing Java metadata.");

    const bundle = new FileBundle();
    await bundle.addDirectory(join(config.paths.runnersDir, "java"));
    bundle.addText(`test_data/${input.problemId}.tsv`, input.testData);
    bundle.addText("config.json", JSON.stringify({ timeoutSeconds: 0, numFailedTestsBeforeStop: 1 }));

    return {
      language_id: languageConfigs.java.judge0LanguageId,
      source_code: transformJavaForJudge0(input.code),
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

function transformJavaForJudge0(code: string): string {
  let transformed = code.replace(/^package\s+epi;\s*/m, "");
  if (!/import\s+epi\.\*;/.test(transformed)) {
    transformed = transformed.replace(/((?:import\s+[^\n]+;\s*)*)/, "$1import epi.*;\n");
  }
  transformed = transformed.replace(/public\s+class\s+\w+/, "public class Main");
  transformed = transformed.replace(
    /runFromAnnotations\(args,\s*("[^"]+"),/,
    'runFromAnnotations(new String[]{"--test-data-dir", "test_data"}, $1,'
  );
  return transformed;
}
