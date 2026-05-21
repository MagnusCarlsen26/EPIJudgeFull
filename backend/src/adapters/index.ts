import { CppAdapter } from "./cppAdapter.js";
import { JavaAdapter } from "./javaAdapter.js";
import type { LanguageAdapter } from "./languageAdapter.js";
import { PythonAdapter } from "./pythonAdapter.js";

export const adapters: Record<string, LanguageAdapter> = {
  python: new PythonAdapter(),
  cpp: new CppAdapter(),
  java: new JavaAdapter()
};
