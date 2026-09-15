"""Schemas for GET /stats/sessions and GET /stats/overview."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SessionSummaryOut(BaseModel):
    """One past quiz attempt, for the session history list."""
    attempt_id: int
    started_at: datetime
    category: Optional[str]
    subcategory: Optional[str]
    topic: Optional[str]
    difficulty: Optional[str]
    total_questions: int
    score: int
    percentage: float


class CategoryStatsOut(BaseModel):
    """Aggregated performance across all sessions within one category —
    e.g. 'you've attempted Data Engineering 5 times, averaging 72%'."""
    category: str
    attempts: int
    total_questions: int
    total_correct: int
    average_percentage: float


class ContentCountOut(BaseModel):
    """One row of the admin content-overview breakdown — how many
    questions exist for a given category/subcategory/topic/type combo."""
    category: str
    subcategory: Optional[str]
    topic: Optional[str]
    type: str
    count: int