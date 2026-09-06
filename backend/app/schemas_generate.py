"""
Schemas for POST /admin/generate (produces a preview, doesn't touch the DB)
and POST /admin/commit (inserts a previewed batch the user approved).
"""
from typing import Literal, Optional
from pydantic import BaseModel


class GenerateRequest(BaseModel):
    """The 5 fields from the "Load Data using LLM" form, plus an optional
    tone/style instruction the user can add (e.g. "explain with examples")."""
    question_type: Literal["mcq", "qna"]
    category: str
    subcategory: Optional[str] = None
    topic: Optional[str] = None
    num_questions: int = 10
    difficulty: str = "mixed"  # "easy" | "medium" | "hard" | "mixed"
    custom_instruction: Optional[str] = None


class GeneratedQuestionOut(BaseModel):
    """One item in the preview list, before it's committed to the DB.
    Same shape as QuestionSummaryOut minus `favourite` — a row that
    doesn't exist yet has no favourite status."""
    id: str
    type: str
    category: str
    subcategory: Optional[str]
    topic: Optional[str]
    difficulty: Optional[str]
    question: str
    payload: dict


class GenerateResponse(BaseModel):
    items: list[GeneratedQuestionOut]
    errors: list[dict]  # [{"line": n, "error": "..."}] — same shape as /admin/load


class CommitRequest(BaseModel):
    """What the frontend sends back after the user reviews the preview and
    hits 'Insert into DB' — the exact items shown, nothing re-generated."""
    items: list[GeneratedQuestionOut]