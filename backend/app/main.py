"""
FastAPI entrypoint. Run with: uvicorn app.main:app --reload

/categories is the first endpoint on purpose: it's the simplest possible
round trip (HTTP -> DB session -> query -> response) so we can confirm the
whole stack works before building the more complex quiz/prepare endpoints.
"""
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, distinct, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .database import get_db
from .db_models import Question, QuizAttempt, QuizAttemptAnswer, Tag, QuestionTag
from .schemas_output import QuizQuestionOut, PrepareQuestionOut
from .schemas_quiz import QuizSubmitIn, QuizSubmitOut, QuizAnswerReview
from .schemas_tags import TagOut, TagAssignIn, FavouriteIn
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


def _get_question_or_404(db: Session, question_id: str) -> Question:
    """Shared lookup used by every per-question endpoint below."""
    q = db.get(Question, question_id)
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return q


@app.post("/questions/{question_id}/tags", response_model=TagOut)
def assign_tag(question_id: str, body: TagAssignIn, db: Session = Depends(get_db)):
    """Creates the tag if it's new (this is what lets a user type a fresh
    tag name in the UI), then links it to the question for DEFAULT_USER_ID.
    on_conflict_do_nothing makes re-assigning the same tag a harmless no-op."""
    _get_question_or_404(db, question_id)

    db.execute(pg_insert(Tag).values(name=body.name).on_conflict_do_nothing(index_elements=["name"]))
    tag = db.execute(select(Tag).where(Tag.name == body.name)).scalar_one()

    db.execute(pg_insert(QuestionTag).values(
        question_id=question_id, tag_id=tag.id, user_id=DEFAULT_USER_ID
    ).on_conflict_do_nothing(index_elements=["question_id", "tag_id", "user_id"]))
    db.commit()
    return TagOut(id=tag.id, name=tag.name)


@app.get("/questions/{question_id}/tags", response_model=list[TagOut])
def list_question_tags(question_id: str, db: Session = Depends(get_db)):
    """Tags currently attached to one question, for DEFAULT_USER_ID."""
    stmt = (
        select(Tag)
        .join(QuestionTag, QuestionTag.tag_id == Tag.id)
        .where(QuestionTag.question_id == question_id, QuestionTag.user_id == DEFAULT_USER_ID)
    )
    tags = db.execute(stmt).scalars().all()
    return [TagOut(id=t.id, name=t.name) for t in tags]


@app.delete("/questions/{question_id}/tags/{tag_id}", status_code=204)
def remove_tag(question_id: str, tag_id: int, db: Session = Depends(get_db)):
    """Un-tagging a question — deletes just this user's link, not the tag itself
    (the tag may still be attached to other questions)."""
    stmt = select(QuestionTag).where(
        QuestionTag.question_id == question_id,
        QuestionTag.tag_id == tag_id,
        QuestionTag.user_id == DEFAULT_USER_ID,
    )
    link = db.execute(stmt).scalar_one_or_none()
    if link:
        db.delete(link)
        db.commit()


@app.patch("/questions/{question_id}/favourite")
def set_favourite(question_id: str, body: FavouriteIn, db: Session = Depends(get_db)):
    """Toggles favourite on/off. Currently a plain column on Question since
    it's single-user; if multi-account lands, this moves to a per-user table
    the same way tags did."""
    q = _get_question_or_404(db, question_id)
    q.favourite = body.favourite
    db.commit()
    return {"id": q.id, "favourite": q.favourite}