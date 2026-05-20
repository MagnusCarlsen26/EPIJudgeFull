import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const repoRoot = new URL("../../", import.meta.url);
const publicDir = new URL("../public/", import.meta.url);
const dataDir = new URL("data/", publicDir);
const languageConfigs = {
  "C++": {
    key: "cpp",
    starterDir: "epi_judge_cpp",
    solutionDir: "epi_judge_cpp_solutions",
  },
  Java: {
    key: "java",
    starterDir: "epi_judge_java",
    solutionDir: "epi_judge_java_solutions",
    sourceSubdir: "epi",
  },
  Python: {
    key: "python",
    starterDir: "epi_judge_python",
    solutionDir: "epi_judge_python_solutions",
  },
};

rmSync(dataDir, { recursive: true, force: true });

const mapping = parseProblemMapping(readFile("problem_mapping.js"));
const chapters = [];
const assets = {
  boilerplate: emptyLanguageMap(),
  solutions: emptyLanguageMap(),
};
const assetsByFilename = {
  boilerplate: emptyLanguageMap(),
  solutions: emptyLanguageMap(),
};
const boilerplate = assets.boilerplate;
const boilerplateByProblem = {};
const solutions = assets.solutions;
const solutionsByProblem = {};
let order = 0;

for (const [chapterTitle, chapterItems] of Object.entries(mapping)) {
  const chapter = {
    id: chapterId(chapterTitle),
    title: chapterTitle,
    problems: [],
  };

  for (const [problemTitle, languages] of Object.entries(chapterItems)) {
    const languageEntries = Object.entries(languages)
      .map(([langFile, stats]) => parseLanguageEntry(langFile, stats))
      .filter(Boolean);
    const pythonEntry = languageEntries.find((entry) => entry.languageKey === "python");
    if (!pythonEntry) continue;

    const id = basenameWithoutExtension(pythonEntry.filename);
    const languageAssets = {};

    for (const entry of languageEntries) {
      const config = languageConfigs[entry.languageLabel];
      const starterPath = emitHashedAsset({
        kind: "boilerplate",
        languageKey: config.key,
        problemId: id,
        filename: entry.filename,
        sourcePath: languageSourcePath(config, entry.filename, "starterDir"),
      });
      const solutionPath = emitHashedAsset({
        kind: "solutions",
        languageKey: config.key,
        problemId: id,
        filename: entry.filename,
        sourcePath: languageSourcePath(config, entry.filename, "solutionDir"),
      });

      boilerplate[config.key][id] = starterPath;
      solutions[config.key][id] = solutionPath;
      assetsByFilename.boilerplate[config.key][entry.filename] = starterPath;
      assetsByFilename.solutions[config.key][entry.filename] = solutionPath;
      languageAssets[config.key] = {
        label: entry.languageLabel,
        filename: entry.filename,
        path: languageSourcePath(config, entry.filename, "starterDir"),
        solutionPath: languageSourcePath(config, entry.filename, "solutionDir"),
        boilerplatePath: starterPath,
        solvedPath: solutionPath,
        passed: Number(entry.stats.passed || 0),
        total: Number(entry.stats.total || 0),
      };
    }

    boilerplateByProblem[id] = boilerplate.python[id];
    solutionsByProblem[id] = solutions.python[id];

    chapter.problems.push({
      id,
      title: problemTitle,
      chapter: chapterTitle,
      chapterId: chapter.id,
      filename: pythonEntry.filename,
      path: `epi_judge_python/${pythonEntry.filename}`,
      boilerplatePath: boilerplate.python[id],
      solvedPath: solutions.python[id],
      languages: languageAssets,
      passed: Number(pythonEntry.stats.passed || 0),
      total: Number(pythonEntry.stats.total || 0),
      order,
    });
    order += 1;
  }

  if (chapter.problems.length) chapters.push(chapter);
}

const problemsJson = `${JSON.stringify({ chapters }, null, 2)}\n`;
const problemsPath = `/data/problems.${hash(problemsJson)}.json`;
writeFileSync(new URL(problemsPath.replace("/data/", ""), dataDir), problemsJson);

const manifest = {
  problems: problemsPath,
  assets,
  assetsByFilename,
  boilerplate,
  boilerplateByProblem,
  solutions,
  solutionsByProblem,
};
writeFileSync(new URL("manifest.json", dataDir), `${JSON.stringify(manifest, null, 2)}\n`);

function readFile(path) {
  try {
    return readFileSync(new URL(path, repoRoot), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return readFromGit(path);
  }
}

function readFromGit(path) {
  const revisions = ["HEAD", "6cc4002^"];
  for (const revision of revisions) {
    try {
      return execFileSync("git", ["show", `${revision}:${path}`], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      // Try the next known source.
    }
  }
  throw new Error(`Could not read ${path} from disk or git history.`);
}

function parseProblemMapping(text) {
  let json = text.trim();
  if (json.startsWith("problem_mapping")) json = json.replace(/^problem_mapping\s*=\s*/, "");
  if (json.endsWith(";")) json = json.slice(0, -1);
  return JSON.parse(json);
}

function chapterId(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chapter";
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function emptyLanguageMap() {
  return Object.fromEntries(Object.values(languageConfigs).map((config) => [config.key, {}]));
}

function parseLanguageEntry(langFile, stats) {
  const match = langFile.match(/^(C\+\+|Java|Python):\s*(.+)$/);
  if (!match) return null;
  const languageLabel = match[1];
  const config = languageConfigs[languageLabel];
  if (!config) return null;
  return {
    languageLabel,
    languageKey: config.key,
    filename: match[2].trim(),
    stats,
  };
}

function emitHashedAsset({ kind, languageKey, problemId, filename, sourcePath }) {
  const code = readFile(sourcePath);
  const extension = extname(filename);
  const hashedFilename = `${problemId}.${hash(code)}${extension}`;
  const targetDir = new URL(`${kind}/${languageKey}/`, dataDir);
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(new URL(hashedFilename, targetDir), code);
  return `/data/${kind}/${languageKey}/${hashedFilename}`;
}

function basenameWithoutExtension(filename) {
  const extension = extname(filename);
  return extension ? filename.slice(0, -extension.length) : filename;
}

function languageSourcePath(config, filename, dirKey) {
  return config.sourceSubdir
    ? join(config[dirKey], config.sourceSubdir, filename)
    : join(config[dirKey], filename);
}
