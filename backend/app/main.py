"""
FastAPI entrypoint. Run with: uvicorn app.main:app --reload

/categories is the first endpoint on purpose: it's the simplest possible
round trip (HTTP -> DB session -> query -> response) so we can confirm the
whole stack works before building the more complex quiz/prepare endpoints.
"""
import json
import re
import uuid
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, distinct, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .database import get_db
from .db_models import Question, QuizAttempt, QuizAttemptAnswer, Tag, QuestionTag
from .schemas_output import QuizQuestionOut, PrepareQuestionOut
from .schemas_quiz import QuizSubmitIn, QuizSubmitOut, QuizAnswerReview
from .schemas_tags import TagOut, TagAssignIn, FavouriteIn
from .schemas_browse import QuestionSummaryOut
from .schemas_input import MCQInput, QnAInput
from .schemas_generate import GenerateRequest, GenerateResponse, GeneratedQuestionOut, CommitRequest
from .schemas_explain import ExplainRequest, ExplainResponse
from .prompt_builder import build_prompt
from .llm_client import generate_text
from .config import DEFAULT_USER_ID

MODEL_BY_TYPE = {"mcq": MCQInput, "qna": QnAInput}

app = FastAPI(title="Learning Platform API")

# Without this, a browser blocks requests from the React dev server (a
# different origin/port) to this API — CORS is a browser-side security
# rule, not something Python enforces on its own.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",              # local dev (Vite)
        "https://vings-learning-platform.onrender.comm", # replace with your actual Render Static Site URL
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


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

        # Options are stored as [{"id": "a", "text": "..."}], so build a
        # quick id->text lookup to resolve both the user's pick and the
        # correct one into readable text for the results screen.
        option_text_by_id = {opt["id"]: opt["text"] for opt in q.payload["options"]}

        review.append(QuizAnswerReview(
            question_id=q.id, question=q.question,
            selected_option=ans.selected_option, selected_text=option_text_by_id.get(ans.selected_option, ""),
            correct_option=correct_option, correct_text=option_text_by_id.get(correct_option, ""),
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


@app.get("/tags", response_model=list[TagOut])
def list_all_tags(db: Session = Depends(get_db)):
    """Every tag that exists — feeds the dropdown on the browse-by-tag view."""
    tags = db.execute(select(Tag)).scalars().all()
    return [TagOut(id=t.id, name=t.name) for t in tags]


@app.get("/questions/favourites", response_model=list[QuestionSummaryOut])
def list_favourites(db: Session = Depends(get_db)):
    """All questions currently marked favourite, mcq and qna mixed together."""
    rows = db.execute(select(Question).where(Question.favourite == True)).scalars().all()
    return [QuestionSummaryOut.from_question(q) for q in rows]


@app.get("/questions/by-tag", response_model=list[QuestionSummaryOut])
def list_by_tag(tag_id: int, db: Session = Depends(get_db)):
    """All questions carrying a given tag, for DEFAULT_USER_ID."""
    stmt = (
        select(Question)
        .join(QuestionTag, QuestionTag.question_id == Question.id)
        .where(QuestionTag.tag_id == tag_id, QuestionTag.user_id == DEFAULT_USER_ID)
    )
    rows = db.execute(stmt).scalars().all()
    return [QuestionSummaryOut.from_question(q) for q in rows]


@app.post("/admin/load")
async def admin_load_jsonl(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Same job as loader/load.py, but over HTTP instead of a local script —
    useful once the app is deployed and you don't have a terminal handy
    with DATABASE_URL pointed at production.

    Every line is validated and upserted independently: one bad line
    doesn't abort the rest of the file, and every failure is reported
    back with its line number and the actual error, rather than being
    silently skipped.
    """
    raw_bytes = await file.read()
    lines = raw_bytes.decode("utf-8").splitlines()

    loaded, errors = 0, []

    for line_no, line in enumerate(lines, start=1):
        line = line.strip()
        if not line:
            continue
        try:
            raw = json.loads(line)
            model_cls = MODEL_BY_TYPE.get(raw.get("type"))
            if model_cls is None:
                raise ValueError(f"Unknown or missing type: {raw.get('type')!r}")
            parsed = model_cls(**raw)
            payload = parsed.to_payload()

            # Insert new, or update content only — rating/favourite/duplicate
            # are left alone on conflict, same rule as the standalone loader.
            stmt = pg_insert(Question).values(
                id=parsed.id, type=parsed.type, category=parsed.category,
                subcategory=parsed.subcategory, topic=parsed.topic,
                difficulty=parsed.difficulty, question=parsed.question,
                payload=payload, source=parsed.source, source_url=parsed.source_url,
                favourite=False, duplicate=False,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "type": stmt.excluded.type, "category": stmt.excluded.category,
                    "subcategory": stmt.excluded.subcategory, "topic": stmt.excluded.topic,
                    "difficulty": stmt.excluded.difficulty, "question": stmt.excluded.question,
                    "payload": stmt.excluded.payload, "source": stmt.excluded.source,
                    "source_url": stmt.excluded.source_url,
                },
            )
            db.execute(stmt)

            for tag_name in parsed.tags:
                db.execute(pg_insert(Tag).values(name=tag_name).on_conflict_do_nothing(index_elements=["name"]))
                tag = db.execute(select(Tag).where(Tag.name == tag_name)).scalar_one()
                db.execute(pg_insert(QuestionTag).values(
                    question_id=parsed.id, tag_id=tag.id, user_id=DEFAULT_USER_ID
                ).on_conflict_do_nothing(index_elements=["question_id", "tag_id", "user_id"]))

            loaded += 1
        except Exception as e:
            errors.append({"line": line_no, "error": str(e)})

    db.commit()
    return {"loaded": loaded, "failed": len(errors), "errors": errors}


def _extract_jsonl(raw_text: str) -> list[str]:
    """Pulls JSONL lines out of the LLM's response. Handles the case where
    it's wrapped in a ```...``` fence (asked for in the prompt) as well as
    the case where the model ignores that and just returns raw lines."""
    fence_match = re.search(r"```[a-zA-Z]*\s*(.*?)```", raw_text, re.DOTALL)
    text = fence_match.group(1) if fence_match else raw_text
    return [line.strip() for line in text.splitlines() if line.strip()]


@app.post("/admin/generate", response_model=GenerateResponse)
def generate_questions(req: GenerateRequest):
    """Calls the LLM, validates its output, and returns a PREVIEW only —
    nothing is written to the database here. That happens in /admin/commit,
    only once the user has looked at what came back."""
    prompt = build_prompt(req)
    raw_response = generate_text(prompt)
    lines = _extract_jsonl(raw_response)

    items, errors = [], []
    for line_no, line in enumerate(lines, start=1):
        try:
            raw = json.loads(line)
            model_cls = MODEL_BY_TYPE[req.question_type]
            # The LLM's own "id" is discarded — we mint one ourselves so two
            # generate runs can never collide with (or silently overwrite) each other.
            raw["id"] = f"{req.question_type}_{uuid.uuid4().hex[:10]}"
            parsed = model_cls(**raw)
            items.append(GeneratedQuestionOut(
                id=parsed.id, type=parsed.type, category=parsed.category,
                subcategory=parsed.subcategory,
                # Only pinned to the form value when the user actually gave one —
                # leaving it blank means "let it vary," so we trust the LLM's
                # per-question topic in that case instead of forcing null.
                topic=(req.topic if req.topic else parsed.topic),
                difficulty=parsed.difficulty, question=parsed.question,
                payload=parsed.to_payload(),
            ))
        except Exception as e:
            errors.append({"line": line_no, "error": str(e)})

    return GenerateResponse(items=items, errors=errors)


@app.post("/admin/commit")
def commit_generated(body: CommitRequest, db: Session = Depends(get_db)):
    """Inserts exactly the previewed items the user approved. No re-validation
    against the LLM needed here — these already passed schema validation in
    /admin/generate; we're just persisting what's already been reviewed."""
    for item in body.items:
        stmt = pg_insert(Question).values(
            id=item.id, type=item.type, category=item.category,
            subcategory=item.subcategory, topic=item.topic,
            difficulty=item.difficulty, question=item.question,
            payload=item.payload, source="llm", source_url=None,
            favourite=False, duplicate=False,
        )
        # No on_conflict clause needed — ids are freshly minted uuids in
        # /admin/generate, so a collision here would be a genuine bug, not
        # an expected re-run scenario (unlike the file loader).
        db.execute(stmt)
    db.commit()
    return {"inserted": len(body.items)}


@app.post("/questions/{question_id}/explain", response_model=ExplainResponse)
def explain_question(question_id: str, body: ExplainRequest, db: Session = Depends(get_db)):
    """Generates a deeper explanation on demand. The question/answer is
    looked up from the DB by id (never trusted from the request body) so
    a tampered frontend request can't make this explain something else."""
    q = _get_question_or_404(db, question_id)

    if q.type == "mcq":
        options_text = "\n".join(f"- {opt['text']}" for opt in q.payload["options"])
        context = (
            f"Question: {q.question}\nOptions:\n{options_text}\n"
            f"Correct answer: {next(o['text'] for o in q.payload['options'] if o['id'] == q.payload['correct_option'])}\n"
            f"Existing brief explanation: {q.payload.get('explanation') or 'none'}"
        )
    else:
        context = f"Question: {q.question}\nAnswer: {q.payload['answer']}"

    custom_line = f"\nThe user specifically asked for: {body.custom_instruction}" if body.custom_instruction else ""

    prompt = f"""\
You are a tutor helping someone deeply understand a study question they've already seen.
{context}
{custom_line}
Give a clear, thorough explanation of the underlying concept — not just why the stated answer is correct, but the reasoning and context behind it. If the user asked for examples or code, include them concretely. Keep it focused and skip generic preamble like "Great question!"."""

    explanation = generate_text(prompt)
    return ExplainResponse(explanation=explanation)