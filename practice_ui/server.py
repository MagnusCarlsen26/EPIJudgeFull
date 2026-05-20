from __future__ import annotations

import os
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .models import BookmarkPayload, CodePayload, NotesPayload, RunPayload, SessionPayload
from .problem_index import Problem, ProblemIndex
from .runner import expected_command, run_problem
from .storage import StateStore


REPO_ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = Path(__file__).resolve().parent / "static"
USER_CODE_DIR = REPO_ROOT / ".practice_ui" / "code"
HISTORY_DIR = REPO_ROOT / ".practice_ui" / "history"

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
    path = user_code_path(problem_id)
    code = read_user_code(problem)
    state = store.read()
    problem_state = state.get("problems", {}).get(problem_id, {})
    return {
        "id": problem.id,
        "title": problem.title,
        "chapter": problem.chapter,
        "filename": problem.filename,
        "path": problem.rel_path,
        "code": code,
        "passed": problem.passed,
        "total": problem.total,
        "notes": problem_state.get("notes", ""),
        "bookmarked": bool(problem_state.get("bookmarked", False)),
        "attempts": problem_state.get("attempts", []),
        "command": expected_command(index, problem_id, USER_CODE_DIR),
        "metadata": file_metadata(path) if path.exists() else None,
    }


@app.put("/api/problems/{problem_id}/code")
async def save_code(problem_id: str, payload: CodePayload) -> dict[str, Any]:
    write_code(problem_id, payload.code)
    state = store.read()
    state["session"]["lastProblemId"] = problem_id
    store.write(state)
    return {"ok": True}


@app.post("/api/problems/{problem_id}/reset")
async def reset_code(problem_id: str) -> dict[str, Any]:
    problem = require_problem(problem_id)
    code = boilerplate_code(problem)
    write_code(problem_id, code)
    state = store.read()
    state["session"]["lastProblemId"] = problem_id
    store.write(state)
    return {"ok": True, "code": code}


@app.post("/api/problems/{problem_id}/run")
async def run_tests(problem_id: str, payload: RunPayload) -> dict[str, Any]:
    problem = require_problem(problem_id)
    write_code(problem_id, payload.code)

    if payload.scope == "sample":
        with tempfile.TemporaryDirectory(prefix="practice-ui-sample-") as sample_dir:
            create_sample_test_data(problem, Path(sample_dir), limit=3)
            response = await run_problem(index, problem_id, USER_CODE_DIR, test_data_dir=Path(sample_dir))
        result = response.dict()
        result["scope"] = "sample"
        return result

    response = await run_problem(index, problem_id, USER_CODE_DIR)
    ran_at = datetime.now(timezone.utc).astimezone()
    attempt_id = f"{ran_at.strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:6]}"
    code_ref = write_attempt_code(problem_id, attempt_id, payload.code)
    attempt = {
        "id": attempt_id,
        "ranAt": ran_at.isoformat(timespec="seconds"),
        "scope": "all",
        "passed": response.passed,
        "total": response.total,
        "exitCode": response.exitCode,
        "durationMs": response.durationMs,
        "result": response.result,
        "codeRef": str(code_ref.relative_to(REPO_ROOT)),
    }
    store.append_attempt(problem_id, attempt)
    result = response.dict()
    result["scope"] = "all"
    return result


@app.get("/api/problems/{problem_id}/attempts/{attempt_id}/code")
async def get_attempt_code(problem_id: str, attempt_id: str) -> dict[str, Any]:
    require_problem(problem_id)
    attempt = store.get_attempt(problem_id, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Unknown attempt")
    code_ref = attempt.get("codeRef")
    if not code_ref:
        return {
            "code": "",
            "available": False,
            "detail": "Code snapshot is not available for this older attempt.",
        }
    path = (REPO_ROOT / code_ref).resolve()
    try:
        path.relative_to(HISTORY_DIR.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Unsafe code snapshot path") from exc
    if not path.exists():
        return {
            "code": "",
            "available": False,
            "detail": "Code snapshot is not available for this older attempt.",
        }
    return {"code": path.read_text(encoding="utf-8"), "available": True}


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


def user_code_path(problem_id: str) -> Path:
    problem = require_problem(problem_id)
    if "/" in problem.filename or "\\" in problem.filename or ".." in problem.filename:
        raise HTTPException(status_code=400, detail="Unsafe problem filename")
    path = (USER_CODE_DIR / problem.filename).resolve()
    try:
        path.relative_to(USER_CODE_DIR.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Problem path is outside user code directory") from exc
    return path


def read_user_code(problem: Problem) -> str:
    path = user_code_path(problem.id)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return boilerplate_code(problem)


def write_code(problem_id: str, code: str) -> None:
    path = user_code_path(problem_id)
    tmp = path.with_name(f".{path.name}.practice-ui-tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(code, encoding="utf-8")
        os.replace(tmp, path)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not save code") from exc


def write_attempt_code(problem_id: str, attempt_id: str, code: str) -> Path:
    safe_problem_id = problem_id.replace("/", "_").replace("\\", "_")
    path = HISTORY_DIR / safe_problem_id / f"{attempt_id}.py"
    tmp = path.with_name(f".{path.name}.tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(code, encoding="utf-8")
        os.replace(tmp, path)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not save code snapshot") from exc
    return path


def create_sample_test_data(problem: Problem, sample_dir: Path, limit: int) -> None:
    source = REPO_ROOT / "test_data" / problem.filename.replace(".py", ".tsv")
    if not source.exists():
        raise HTTPException(status_code=500, detail="Could not find test data for this problem")
    target = sample_dir / source.name
    sample_dir.mkdir(parents=True, exist_ok=True)
    lines = source.read_text(encoding="utf-8").splitlines(keepends=True)
    target.write_text("".join(lines[: limit + 1]), encoding="utf-8")


def boilerplate_code(problem: Problem) -> str:
    try:
        result = subprocess.run(
            ["git", "show", f"HEAD:epi_judge_python/{problem.filename}"],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise HTTPException(status_code=500, detail="Could not load starter code from git") from exc
    return result.stdout


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
