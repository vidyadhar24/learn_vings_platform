"""
Pydantic models for the two JSONL input formats.
type field ("mcq"/"qna") decides which model a line is validated against.
"""
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class MCQOption(BaseModel):
    id: str
    text: str


class MCQInput(BaseModel):
    """One line of an MCQ JSONL file."""
    id: str
    type: Literal["mcq"] = "mcq"
    category: str
    subcategory: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    question: str
    options: list[MCQOption]
    correct_option: str
    explanation: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    source: Optional[str] = None
    source_url: Optional[str] = None
    created_at: Optional[datetime] = None

    def to_payload(self) -> dict:
        """What goes into questions.payload for an mcq row."""
        return {
            "options": [o.model_dump() for o in self.options],
            "correct_option": self.correct_option,
            "explanation": self.explanation,
        }


class QnAInput(BaseModel):
    """One line of a Q&A (Prepare-mode) JSONL file."""
    id: str
    type: Literal["qna"] = "qna"
    category: str
    subcategory: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    question: str
    answer: str
    examples: list[str] = Field(default_factory=list)
    code: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    source: Optional[str] = None
    source_url: Optional[str] = None
    created_at: Optional[datetime] = None

    def to_payload(self) -> dict:
        """What goes into questions.payload for a qna row."""
        return {
            "answer": self.answer,
            "examples": self.examples,
            "code": self.code,
        }