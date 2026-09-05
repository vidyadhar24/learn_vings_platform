"""
Loads a JSONL file of questions into Postgres.

Usage:
    python load.py path/to/file.jsonl

Each line's "type" field picks the validation model. On conflict (same id),
content fields are updated but rating/favourite/duplicate are left alone
if the row already exists — those become app-owned after first insert.
"""
import json
import sys

from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend.app.config import DEFAULT_USER_ID
from db import SessionLocal, init_db
from backend.app.db_models import Question, Tag, QuestionTag
from schemas_input import MCQInput, QnAInput

MODEL_BY_TYPE = {"mcq": MCQInput, "qna": QnAInput}


def parse_line(raw: dict):
    """Validates one JSON object against the right schema for its type.
    Returns (parsed_model, payload_dict) or raises on bad/missing type."""
    qtype = raw.get("type")
    model_cls = MODEL_BY_TYPE.get(qtype)
    if model_cls is None:
        raise ValueError(f"Unknown or missing type: {qtype!r}")
    parsed = model_cls(**raw)
    return parsed, parsed.to_payload()


def upsert_question(session, parsed, payload: dict):
    """Insert new, or update content fields only — never overwrites
    rating/favourite/duplicate on an existing row (app-owned after insert)."""
    stmt = pg_insert(Question).values(
        id=parsed.id,
        type=parsed.type,
        category=parsed.category,
        subcategory=parsed.subcategory,
        topic=parsed.topic,
        difficulty=parsed.difficulty,
        question=parsed.question,
        payload=payload,
        source=parsed.source,
        source_url=parsed.source_url,
        favourite=False,
        duplicate=False,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["id"],
        set_={
            "type": stmt.excluded.type,
            "category": stmt.excluded.category,
            "subcategory": stmt.excluded.subcategory,
            "topic": stmt.excluded.topic,
            "difficulty": stmt.excluded.difficulty,
            "question": stmt.excluded.question,
            "payload": stmt.excluded.payload,
            "source": stmt.excluded.source,
            "source_url": stmt.excluded.source_url,
            # rating/favourite/duplicate deliberately omitted from the update set
        },
    )
    session.execute(stmt)


def sync_tags(session, question_id: str, tag_names: list[str]):
    """Creates any new tags and links them to the question for DEFAULT_USER_ID.
    Existing links are left as-is (doesn't remove tags a user added manually)."""
    for name in tag_names:
        tag_stmt = pg_insert(Tag).values(name=name).on_conflict_do_nothing(index_elements=["name"])
        session.execute(tag_stmt)
        tag = session.query(Tag).filter_by(name=name).one()

        link_stmt = pg_insert(QuestionTag).values(
            question_id=question_id, tag_id=tag.id, user_id=DEFAULT_USER_ID
        ).on_conflict_do_nothing(index_elements=["question_id", "tag_id", "user_id"])
        session.execute(link_stmt)


def load_file(path: str):
    init_db()
    session = SessionLocal()
    ok, failed = 0, 0

    with open(path, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
                parsed, payload = parse_line(raw)
                upsert_question(session, parsed, payload)
                sync_tags(session, parsed.id, parsed.tags)
                ok += 1
            except Exception as e:
                print(f"[line {line_no}] FAILED: {e}")
                failed += 1

    session.commit()
    session.close()
    print(f"Done. {ok} loaded, {failed} failed.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python load.py path/to/file.jsonl")
        sys.exit(1)
    load_file(sys.argv[1])
