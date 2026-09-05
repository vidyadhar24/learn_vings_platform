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
from .schemas_output import QuizQuestionOut

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