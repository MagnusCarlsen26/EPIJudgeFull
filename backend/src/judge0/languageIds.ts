import type { Judge0Client } from "./judge0Client.js";

export const languageConfigs = {
  python: { judge0LanguageId: 71, label: "Python 3" },
  cpp: { judge0LanguageId: 54, label: "C++ GCC" },
  java: { judge0LanguageId: 62, label: "Java OpenJDK" }
} as const;

export type LanguageKey = keyof typeof languageConfigs;

export async function validateJudge0Languages(client: Judge0Client): Promise<void> {
  const languages = await client.getLanguages();
  const ids = new Set(languages.map((language) => language.id));
  for (const [key, config] of Object.entries(languageConfigs)) {
    if (!ids.has(config.judge0LanguageId)) {
      console.warn(`Judge0 language id ${config.judge0LanguageId} for ${key} was not reported by /languages.`);
    }
  }
}
