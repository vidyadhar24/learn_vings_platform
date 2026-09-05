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
    payload: dict  # left as-is (options+correct_option, or answer+examples+code) —
                    # the frontend already knows how to render each type from Prepare/Quiz

    @classmethod
    def from_question(cls, q):
        return cls(
            id=q.id, type=q.type, category=q.category, subcategory=q.subcategory,
            topic=q.topic, difficulty=q.difficulty, question=q.question,
            favourite=q.favourite, payload=q.payload,
        )