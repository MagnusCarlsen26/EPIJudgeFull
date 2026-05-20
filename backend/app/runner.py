from __future__ import annotations

import asyncio
import os
import re
import shutil
import sys
import time
from pathlib import Path

from .models import RunResponse, RunResult
from .problem_index import ProblemIndex


STATS_RE = re.compile(r"(?P<passed>\d+)\s*/\s*(?P<total>\d+)")
PYTHON_RUNNER_DIR = Path(__file__).resolve().parents[1] / "runners" / "python"
PYTHON_EXECUTABLE = os.environ.get("PYTHON_EXECUTABLE") or shutil.which("python3") or sys.executable


async def run_problem(
    index: ProblemIndex,
    problem_id: str,
    code_dir: Path | None = None,
    test_data_dir: Path | None = None,
    timeout_s: int = 30,
) -> RunResponse:
    problem = index.require(problem_id)
    cwd = code_dir or index.python_dir
    resolved_test_data_dir = test_data_dir or index.repo_root / "test_data"
    env = os.environ.copy()
    python_path_entries = [str(index.python_dir), str(PYTHON_RUNNER_DIR)]
    env["PYTHONPATH"] = os.pathsep.join(
        [*python_path_entries, env["PYTHONPATH"]] if env.get("PYTHONPATH") else python_path_entries
    )
    start = time.perf_counter()
    process = await asyncio.create_subprocess_exec(
        PYTHON_EXECUTABLE,
        problem.filename,
        "--test-data-dir",
        str(resolved_test_data_dir),
        "--no-update-js",
        cwd=str(cwd),
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout_b, stderr_b = await asyncio.wait_for(process.communicate(), timeout=timeout_s)
        exit_code = int(process.returncode or 0)
        timed_out = False
    except asyncio.TimeoutError:
        process.kill()
        stdout_b, stderr_b = await process.communicate()
        exit_code = -1
        timed_out = True

    duration_ms = int((time.perf_counter() - start) * 1000)
    stdout = stdout_b.decode("utf-8", errors="replace")
    stderr = stderr_b.decode("utf-8", errors="replace")

    index.reload()
    fresh = index.require(problem_id)
    passed, total = fresh.passed, fresh.total
    if (not total or passed == problem.passed) and stdout:
        parsed = parse_output_stats(stdout)
        if parsed:
            passed, total = parsed

    result: RunResult
    if timed_out:
        result = "timeout"
    elif exit_code == 0 and total > 0 and passed >= total:
        result = "passed"
    elif exit_code == 0:
        result = "failed"
    else:
        result = "runtime_error"

    return RunResponse(
        exitCode=exit_code,
        passed=passed,
        total=total,
        durationMs=duration_ms,
        stdout=stdout,
        stderr=stderr,
        result=result,
    )


def parse_output_stats(stdout: str) -> tuple[int, int] | None:
    matches = list(STATS_RE.finditer(stdout))
    if not matches:
        return None
    match = matches[-1]
    return int(match.group("passed")), int(match.group("total"))


def expected_command(index: ProblemIndex, problem_id: str, code_dir: Path | None = None) -> dict[str, str]:
    problem = index.require(problem_id)
    cwd = code_dir or index.python_dir
    test_data_dir = index.repo_root / "test_data"
    return {
        "command": f"{Path(PYTHON_EXECUTABLE).name} {problem.filename} --test-data-dir {test_data_dir} --no-update-js",
        "workingDirectory": str(cwd),
    }
