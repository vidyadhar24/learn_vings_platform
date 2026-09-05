"""
Response schemas for the API. Two different "views" of the same
Question row, because they're shown in very different contexts:

- QuizQuestionOut: sent while a quiz is in progress. Deliberately
  omits correct_option/explanation so the answer can't be read from
  the network response before the user submits a guess.
- PrepareQuestionOut: sent in Prepare mode, where seeing the full
  answer (just visually collapsed in the UI) is the whole point.
"""
from typing import Optional
from pydantic import BaseModel


class MCQOptionOut(BaseModel):
    id: str
    text: str


class QuizQuestionOut(BaseModel):
    id: str
    category: str
    subcategory: Optional[str]
    topic: Optional[str]
    difficulty: Optional[str]
    question: str
    options: list[MCQOptionOut]
    # correct_option / explanation intentionally NOT included here

    @classmethod
    def from_question(cls, q):
        """Builds this schema from a Question ORM row, pulling the
        options list out of the payload JSONB and leaving the rest out."""
        return cls(
            id=q.id, category=q.category, subcategory=q.subcategory,
            topic=q.topic, difficulty=q.difficulty, question=q.question,
            options=q.payload["options"],
        )


class PrepareQuestionOut(BaseModel):
    id: str
    category: str
    subcategory: Optional[str]
    topic: Optional[str]
    difficulty: Optional[str]
    question: str
    answer: str
    examples: list[str]
    code: Optional[str]

    @classmethod
    def from_question(cls, q):
        """Same idea, but for qna rows — pulls answer/examples/code
        out of payload since Prepare mode is allowed to show it all."""
        return cls(
            id=q.id, category=q.category, subcategory=q.subcategory,
            topic=q.topic, difficulty=q.difficulty, question=q.question,
            answer=q.payload["answer"], examples=q.payload.get("examples", []),
            code=q.payload.get("code"),
        )