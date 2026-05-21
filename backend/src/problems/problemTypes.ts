import type { LanguageKey } from "../judge0/languageIds.js";

export interface ProblemLanguageMetadata {
  label: string;
  filename: string;
  path: string;
  solutionPath: string;
  boilerplatePath: string;
  solvedPath: string;
  passed: number;
  total: number;
}

export interface ProblemMetadata {
  id: string;
  title: string;
  chapter: string;
  chapterId: string;
  filename: string;
  path: string;
  boilerplatePath: string;
  solvedPath: string;
  languages: Partial<Record<LanguageKey, ProblemLanguageMetadata>>;
  passed: number;
  total: number;
  order: number;
}

export interface ProblemsFile {
  chapters: Array<{
    id: string;
    title: string;
    problems: ProblemMetadata[];
  }>;
}

export interface ManifestFile {
  problems: string;
}
