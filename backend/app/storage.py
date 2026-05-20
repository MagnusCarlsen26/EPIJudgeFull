from __future__ import annotations

import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any


DEFAULT_STATE: dict[str, Any] = {
    "version": 1,
    "session": {
        "lastProblemId": None,
        "filters": {"chapter": None, "status": "all", "query": ""},
        "sort": "book_order",
        "theme": "system",
        "sidebarCollapsed": False,
        "expandedChapterIds": [],
    },
    "problems": {},
}


class StateStore:
    def __init__(self, repo_root: Path):
        self.path = repo_root / ".practice_ui" / "state.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def read(self) -> dict[str, Any]:
        if not self.path.exists():
            state = deepcopy(DEFAULT_STATE)
            self.write(state)
            return state
        try:
            state = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            state = deepcopy(DEFAULT_STATE)
        return merge_defaults(state)

    def write(self, state: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        os.replace(tmp, self.path)

    def update_problem(self, problem_id: str, values: dict[str, Any]) -> dict[str, Any]:
        state = self.read()
        problem_state = state.setdefault("problems", {}).setdefault(problem_id, {})
        problem_state.update(values)
        self.write(state)
        return problem_state

    def append_attempt(self, problem_id: str, attempt: dict[str, Any]) -> None:
        state = self.read()
        problem_state = state.setdefault("problems", {}).setdefault(problem_id, {})
        problem_state.setdefault("attempts", []).append(attempt)
        state["session"]["lastProblemId"] = problem_id
        self.write(state)

    def get_attempt(self, problem_id: str, attempt_id: str) -> dict[str, Any] | None:
        problem_state = self.read().get("problems", {}).get(problem_id, {})
        for attempt in problem_state.get("attempts", []):
            if attempt.get("id") == attempt_id:
                return attempt
        return None


def merge_defaults(state: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(DEFAULT_STATE)
    merged.update({k: v for k, v in state.items() if k not in {"session", "problems"}})
    merged["session"].update(state.get("session", {}))
    merged["session"]["filters"].update(state.get("session", {}).get("filters", {}))
    if merged["session"].get("theme") not in {"light", "dark", "system"}:
        merged["session"]["theme"] = DEFAULT_STATE["session"]["theme"]
    if not isinstance(merged["session"].get("sidebarCollapsed"), bool):
        merged["session"]["sidebarCollapsed"] = DEFAULT_STATE["session"]["sidebarCollapsed"]
    if not isinstance(merged["session"].get("expandedChapterIds"), list):
        merged["session"]["expandedChapterIds"] = DEFAULT_STATE["session"]["expandedChapterIds"]
    merged["problems"] = state.get("problems", {})
    return merged
