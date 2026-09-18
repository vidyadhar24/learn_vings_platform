"""
Schema for browsing questions by favourite/tag rather than by category
filters. Unlike QuizQuestionOut/PrepareQuestionOut, this needs to represent
BOTH mcq and qna rows in one list (a tag might span both types), so it
carries `type` and exposes the answer-revealing fields generically.
"""
from typing import Optional
from pydantic import BaseModel


class QuestionSummaryOut(BaseModel):
    id: str
    type: str
    category: str
    subcategory: Optional[str]
    topic: Optional[str]
    difficulty: Optional[str]
    question: str
    favourite: bool
    payload: dict

    @classmethod
    def from_question(cls, q, favourite: bool = False):
        """favourite is now passed in by the caller (looked up per-user),
        since it's no longer a column on Question itself."""
        return cls(
            id=q.id, type=q.type, category=q.category, subcategory=q.subcategory,
            topic=q.topic, difficulty=q.difficulty, question=q.question,
            favourite=favourite, payload=q.payload,
        )