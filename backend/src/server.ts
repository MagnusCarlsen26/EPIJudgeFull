import { createApp } from "./app.js";
import { config } from "./config.js";
import { Judge0Client } from "./judge0/judge0Client.js";
import { validateJudge0Languages } from "./judge0/languageIds.js";
import { ProblemCatalog } from "./problems/problemCatalog.js";
import { RunStore } from "./runs/runStore.js";
import { RunService } from "./runs/runService.js";

async function main() {
  const judge0Client = new Judge0Client(config.judge0);
  const problemCatalog = await ProblemCatalog.load(config.paths.manifestPath);
  const runStore = new RunStore(config.run.resultTtlSeconds);
  const runService = new RunService({ judge0Client, problemCatalog, runStore });
  const app = createApp({ judge0Client, runService });

  validateJudge0Languages(judge0Client).catch((error) => {
    console.warn(`Judge0 language validation skipped: ${error instanceof Error ? error.message : String(error)}`);
  });

  app.listen(config.port, () => {
    console.log(`EPIJudge backend listening on http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
