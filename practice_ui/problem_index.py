from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Problem:
    id: str
    title: str
    chapter: str
    chapter_id: str
    filename: str
    rel_path: str
    passed: int
    total: int
    order: int


def chapter_id(title: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return normalized or "chapter"


class ProblemIndex:
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root.resolve()
        self.python_dir = (self.repo_root / "epi_judge_python").resolve()
        self.mapping_path = self.repo_root / "problem_mapping.js"
        self._problems: list[Problem] = []
        self._by_id: dict[str, Problem] = {}
        self.reload()

    def reload(self) -> None:
        data = parse_problem_mapping(self.mapping_path)
        problems: list[Problem] = []
        order = 0
        for chapter_title, chapter_items in data.items():
            cid = chapter_id(chapter_title)
            for problem_title, languages in chapter_items.items():
                for lang_file, stats in languages.items():
                    prefix = "Python: "
                    if not lang_file.startswith(prefix):
                        continue
                    filename = lang_file[len(prefix) :].strip()
                    if not filename.endswith(".py"):
                        continue
                    problem_id = filename[:-3]
                    problems.append(
                        Problem(
                            id=problem_id,
                            title=problem_title,
                            chapter=chapter_title,
                            chapter_id=cid,
                            filename=filename,
                            rel_path=f"epi_judge_python/{filename}",
                            passed=int(stats.get("passed", 0)),
                            total=int(stats.get("total", 0)),
                            order=order,
                        )
                    )
                    order += 1
        self._problems = problems
        self._by_id = {problem.id: problem for problem in problems}

    @property
    def problems(self) -> list[Problem]:
        return self._problems

    def get(self, problem_id: str) -> Problem | None:
        return self._by_id.get(problem_id)

    def require(self, problem_id: str) -> Problem:
        problem = self.get(problem_id)
        if problem is None:
            raise KeyError(problem_id)
        return problem

    def safe_problem_path(self, problem_id: str) -> Path:
        problem = self.require(problem_id)
        if "/" in problem.filename or "\\" in problem.filename or ".." in problem.filename:
            raise ValueError("Unsafe problem filename")
        path = (self.python_dir / problem.filename).resolve()
        if self.python_dir not in path.parents or "_solutions" in path.parts:
            raise ValueError("Problem path is outside epi_judge_python")
        return path


def parse_problem_mapping(mapping_path: Path) -> dict:
    text = mapping_path.read_text(encoding="utf-8")
    text = text.strip()
    if text.startswith("problem_mapping"):
        text = re.sub(r"^problem_mapping\s*=\s*", "", text, count=1)
    if text.endswith(";"):
        text = text[:-1]
    return json.loads(text)

