from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


ProblemStatus = Literal["not_started", "in_progress", "solved"]
RunResult = Literal["passed", "failed", "timeout", "runtime_error"]


class CodePayload(BaseModel):
    code: str


class NotesPayload(BaseModel):
    notes: str


class BookmarkPayload(BaseModel):
    bookmarked: bool


class SessionPayload(BaseModel):
    session: dict[str, Any] = Field(default_factory=dict)


class Attempt(BaseModel):
    ranAt: str
    passed: int
    total: int
    exitCode: int
    durationMs: int
    result: RunResult | None = None


class RunResponse(BaseModel):
    exitCode: int
    passed: int
    total: int
    durationMs: int
    stdout: str
    stderr: str
    result: RunResult

