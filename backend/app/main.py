"""
FastAPI entrypoint. Run with: uvicorn app.main:app --reload

/categories is the first endpoint on purpose: it's the simplest possible
round trip (HTTP -> DB session -> query -> response) so we can confirm the
whole stack works before building the more complex quiz/prepare endpoints.
"""
from typing import Optional
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, distinct, func

from .database import get_db
from .db_models import Question
from .schemas_output import QuizQuestionOut, PrepareQuestionOut
from .schemas_quiz import QuizSubmitIn, QuizSubmitOut, QuizAnswerReview
from .db_models import QuizAttempt, QuizAttemptAnswer
from .config import DEFAULT_USER_ID

app = FastAPI(title="Learning Platform API")


@app.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    """Returns every distinct category currently in the questions table —
    this is what populates the first dropdown in the filter UI."""
    rows = db.execute(select(distinct(Question.category))).scalars().all()
    return {"categories": sorted(rows)}


@app.get("/subcategories")
def list_subcategories(category: str, db: Session = Depends(get_db)):
    """Second dropdown — narrowed to whatever category was already picked."""
    stmt = select(distinct(Question.subcategory)).where(Question.category == category)
    rows = db.execute(stmt).scalars().all()
    return {"subcategories": sorted(r for r in rows if r)}


@app.get("/topics")
def list_topics(category: str, subcategory: Optional[str] = None, db: Session = Depends(get_db)):
    """Third dropdown — topic is optional in the data, so results can be empty
    even when category/subcategory are valid; that's fine, topic stays optional."""
    stmt = select(distinct(Question.topic)).where(Question.category == category)
    if subcategory:
        stmt = stmt.where(Question.subcategory == subcategory)
    rows = db.execute(stmt).scalars().all()
    return {"topics": sorted(r for r in rows if r)}


@app.get("/questions/quiz", response_model=list[QuizQuestionOut])
def get_quiz_questions(
    category: str,
    subcategory: Optional[str] = None,
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """Random batch of MCQs matching the chosen filters, answer hidden.
    ORDER BY random() is fine at this data size; revisit if the table
    grows into the millions of rows (it'd get slow to scan/sort)."""
    stmt = select(Question).where(Question.type == "mcq", Question.category == category)
    if subcategory:
        stmt = stmt.where(Question.subcategory == subcategory)
    if topic:
        stmt = stmt.where(Question.topic == topic)
    if difficulty:
        stmt = stmt.where(Question.difficulty == difficulty)
    stmt = stmt.order_by(func.random()).limit(limit)

    rows = db.execute(stmt).scalars().all()
    return [QuizQuestionOut.from_question(q) for q in rows]


@app.get("/questions/prepare", response_model=list[PrepareQuestionOut])
def get_prepare_questions(
    category: str,
    subcategory: Optional[str] = None,
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """Same filter logic as the quiz endpoint, but for qna rows, and the
    full payload (answer/examples/code) is returned — Prepare mode is
    meant to show it, just collapsed behind a toggle in the UI."""
    stmt = select(Question).where(Question.type == "qna", Question.category == category)
    if subcategory:
        stmt = stmt.where(Question.subcategory == subcategory)
    if topic:
        stmt = stmt.where(Question.topic == topic)
    if difficulty:
        stmt = stmt.where(Question.difficulty == difficulty)
    stmt = stmt.limit(limit)

    rows = db.execute(stmt).scalars().all()
    return [PrepareQuestionOut.from_question(q) for q in rows]


@app.post("/quiz/submit", response_model=QuizSubmitOut)
def submit_quiz(submission: QuizSubmitIn, db: Session = Depends(get_db)):
    """Grades the submission server-side (client never had correct_option),
    saves the attempt for history, and returns the score + a review list
    with correct answers now revealed."""
    ids = [a.question_id for a in submission.answers]
    questions = db.execute(select(Question).where(Question.id.in_(ids))).scalars().all()
    questions_by_id = {q.id: q for q in questions}

    review = []
    score = 0
    for ans in submission.answers:
        q = questions_by_id[ans.question_id]
        correct_option = q.payload["correct_option"]
        is_correct = ans.selected_option == correct_option
        score += int(is_correct)
        review.append(QuizAnswerReview(
            question_id=q.id, question=q.question,
            selected_option=ans.selected_option, correct_option=correct_option,
            is_correct=is_correct, explanation=q.payload.get("explanation"),
        ))

    # Persist the attempt so there's a scoring history (user_id hardcoded
    # until real accounts exist — see blueprint's multi-account note).
    attempt = QuizAttempt(
        user_id=DEFAULT_USER_ID,
        filters={"category": submission.category, "subcategory": submission.subcategory,
                 "topic": submission.topic, "difficulty": submission.difficulty},
        total_questions=len(submission.answers),
        score=score,
    )
    db.add(attempt)
    db.flush()  # assigns attempt.id without committing yet

    for r in review:
        db.add(QuizAttemptAnswer(
            attempt_id=attempt.id, question_id=r.question_id,
            selected_option=r.selected_option, is_correct=r.is_correct,
        ))
    db.commit()

    return QuizSubmitOut(attempt_id=attempt.id, score=score, total=len(submission.answers), review=review)