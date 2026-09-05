"""
Schemas for POST /quiz/submit.

The client sends only {question_id, selected_option} pairs — it never
had the correct answers to begin with. The server looks each one up,
grades it, and only THEN reveals correct_option/explanation in the
response, per question, for the results/review screen.
"""
from typing import Optional
from pydantic import BaseModel


class QuizAnswerIn(BaseModel):
    """One answer the user picked during the quiz run."""
    question_id: str
    selected_option: str


class QuizSubmitIn(BaseModel):
    """The whole quiz submission: which filters were used (saved for
    history/analytics) plus every answer given."""
    category: str
    subcategory: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    answers: list[QuizAnswerIn]


class QuizAnswerReview(BaseModel):
    """Per-question result shown on the results screen — correct answer
    and explanation are revealed here since grading already happened.
    Includes both the option id and its text, since an id alone ("b")
    means nothing to the user without the option list."""
    question_id: str
    question: str
    selected_option: str
    selected_text: str
    correct_option: str
    correct_text: str
    is_correct: bool
    explanation: Optional[str]


class QuizSubmitOut(BaseModel):
    attempt_id: int
    score: int
    total: int
    review: list[QuizAnswerReview]