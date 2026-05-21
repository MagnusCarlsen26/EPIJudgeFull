import dotenv from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z.string().default("development"),
  FRONTEND_ORIGINS: z.string().default("http://localhost:5173,http://localhost:3000"),
  JUDGE0_BASE_URL: z.string().url().default("http://localhost:2358"),
  JUDGE0_AUTH_TOKEN: z.string().default(""),
  JUDGE0_SUBMISSION_WAIT: z.coerce.boolean().default(false),
  RUN_RESULT_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  RUN_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(30),
  RUN_MEMORY_LIMIT_KB: z.coerce.number().int().positive().default(262144),
  RUN_MAX_OUTPUT_BYTES: z.coerce.number().int().positive().default(200000)
});

const env = envSchema.parse(process.env);
const repoRoot = resolve(process.cwd(), "..");

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  frontendOrigins: env.FRONTEND_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  judge0: {
    baseUrl: env.JUDGE0_BASE_URL.replace(/\/$/, ""),
    authToken: env.JUDGE0_AUTH_TOKEN,
    wait: env.JUDGE0_SUBMISSION_WAIT
  },
  run: {
    resultTtlSeconds: env.RUN_RESULT_TTL_SECONDS,
    timeoutSeconds: env.RUN_TIMEOUT_SECONDS,
    memoryLimitKb: env.RUN_MEMORY_LIMIT_KB,
    maxOutputBytes: env.RUN_MAX_OUTPUT_BYTES,
    maxSourceBytes: 200_000
  },
  paths: {
    repoRoot,
    manifestPath: resolve(repoRoot, "frontend/public/data/manifest.json"),
    testDataDir: resolve(repoRoot, "judge-assets/test_data"),
    runnersDir: resolve(repoRoot, "judge-assets/runners")
  }
} as const;
