from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .models import BookmarkPayload, CodePayload, NotesPayload, SessionPayload
from .problem_index import Problem, ProblemIndex
from .runner import expected_command, run_problem
from .storage import StateStore


REPO_ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="EPI Python Practice UI")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

index = ProblemIndex(REPO_ROOT)
store = StateStore(REPO_ROOT)


@app.get("/")
async def root() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/problems")
async def list_problems() -> dict[str, Any]:
    index.reload()
    state = store.read()
    chapters: dict[str, dict[str, Any]] = {}
    for problem in index.problems:
        chapters.setdefault(
            problem.chapter_id,
            {"id": problem.chapter_id, "title": problem.chapter, "problems": []},
        )["problems"].append(problem_summary(problem, state))
    return {"chapters": list(chapters.values())}


@app.get("/api/problems/{problem_id}")
async def get_problem(problem_id: str) -> dict[str, Any]:
    problem = require_problem(problem_id)
    path = safe_path(problem_id)
    state = store.read()
    problem_state = state.get("problems", {}).get(problem_id, {})
    return {
        "id": problem.id,
        "title": problem.title,
        "chapter": problem.chapter,
        "filename": problem.filename,
        "path": problem.rel_path,
        "code": path.read_text(encoding="utf-8"),
        "passed": problem.passed,
        "total": problem.total,
        "notes": problem_state.get("notes", ""),
        "bookmarked": bool(problem_state.get("bookmarked", False)),
        "attempts": problem_state.get("attempts", []),
        "command": expected_command(index, problem_id),
        "metadata": file_metadata(path),
    }


@app.put("/api/problems/{problem_id}/code")
async def save_code(problem_id: str, payload: CodePayload) -> dict[str, Any]:
    write_code(problem_id, payload.code)
    state = store.read()
    state["session"]["lastProblemId"] = problem_id
    store.write(state)
    return {"ok": True}


@app.post("/api/problems/{problem_id}/run")
async def run_tests(problem_id: str, payload: CodePayload) -> dict[str, Any]:
    write_code(problem_id, payload.code)
    response = await run_problem(index, problem_id)
    attempt = {
        "ranAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "passed": response.passed,
        "total": response.total,
        "exitCode": response.exitCode,
        "durationMs": response.durationMs,
        "result": response.result,
    }
    store.append_attempt(problem_id, attempt)
    return response.dict()


@app.put("/api/problems/{problem_id}/notes")
async def save_notes(problem_id: str, payload: NotesPayload) -> dict[str, Any]:
    require_problem(problem_id)
    store.update_problem(problem_id, {"notes": payload.notes})
    return {"ok": True}


@app.put("/api/problems/{problem_id}/bookmark")
async def save_bookmark(problem_id: str, payload: BookmarkPayload) -> dict[str, Any]:
    require_problem(problem_id)
    store.update_problem(problem_id, {"bookmarked": payload.bookmarked})
    return {"ok": True}


@app.get("/api/session")
async def get_session() -> dict[str, Any]:
    return {"language": "python", "session": store.read()["session"]}


@app.put("/api/session")
async def put_session(payload: SessionPayload) -> dict[str, Any]:
    state = store.read()
    state["session"].update(payload.session)
    if "filters" in payload.session:
        state["session"]["filters"].update(payload.session["filters"])
    store.write(state)
    return {"language": "python", "session": state["session"]}


def require_problem(problem_id: str) -> Problem:
    try:
        return index.require(problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Unknown problem id") from exc


def safe_path(problem_id: str) -> Path:
    try:
        return index.safe_problem_path(problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Unknown problem id") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def write_code(problem_id: str, code: str) -> None:
    path = safe_path(problem_id)
    tmp = path.with_name(f".{path.name}.practice-ui-tmp")
    try:
        tmp.write_text(code, encoding="utf-8")
        os.replace(tmp, path)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not save code") from exc


def problem_summary(problem: Problem, state: dict[str, Any]) -> dict[str, Any]:
    problem_state = state.get("problems", {}).get(problem.id, {})
    attempts = problem_state.get("attempts", [])
    notes = problem_state.get("notes", "")
    return {
        "id": problem.id,
        "title": problem.title,
        "filename": problem.filename,
        "path": problem.rel_path,
        "passed": problem.passed,
        "total": problem.total,
        "status": status_for(problem, attempts),
        "bookmarked": bool(problem_state.get("bookmarked", False)),
        "lastRunAt": attempts[-1]["ranAt"] if attempts else None,
        "notesPreview": notes.strip().replace("\n", " ")[:120],
    }


def status_for(problem: Problem, attempts: list[dict[str, Any]]) -> str:
    if problem.total and problem.passed >= problem.total:
        return "solved"
    if attempts or problem.passed:
        return "in_progress"
    return "not_started"


def file_metadata(path: Path) -> dict[str, Any]:
    stat = path.stat()
    return {"sizeBytes": stat.st_size, "modifiedAt": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds")}
