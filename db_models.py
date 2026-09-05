"""
SQLAlchemy models matching the blueprint's DB schema.
`Question`/`Tag` are global/shared; `QuestionTag`/`QuizAttempt*` carry
user_id so they're multi-account-ready even though we hardcode one user now.
"""
from sqlalchemy import (
    Column, String, Text, Boolean, Numeric, TIMESTAMP, ForeignKey, Integer, func
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Question(Base):
    """One MCQ or Q&A item. Type-specific fields live in `payload` (JSONB)
    so adding new mcq/qna-only fields later needs no migration."""
    __tablename__ = "questions"

    id = Column(String, primary_key=True)          # author-supplied, e.g. "mcq_spark_001"
    type = Column(String, nullable=False)           # "mcq" | "qna"
    category = Column(String, index=True, nullable=False)
    subcategory = Column(String, index=True)
    topic = Column(String)
    difficulty = Column(String)                     # "easy" | "medium" | "hard"
    question = Column(Text, nullable=False)
    payload = Column(JSONB, nullable=False)          # mcq: options/correct_option/explanation
                                                      # qna: answer/examples/code
    source = Column(String)
    source_url = Column(String)
    rating = Column(Numeric)                         # app-owned after first insert
    favourite = Column(Boolean, default=False)        # app-owned after first insert
    duplicate = Column(Boolean, default=False)        # app-owned after first insert
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    tag_links = relationship("QuestionTag", back_populates="question")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class QuestionTag(Base):
    """Many-to-many link, scoped per user so tagging is user-specific
    once multi-account lands (currently always DEFAULT_USER_ID)."""
    __tablename__ = "question_tags"

    question_id = Column(String, ForeignKey("questions.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)
    user_id = Column(String, primary_key=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    question = relationship("Question", back_populates="tag_links")
    tag = relationship("Tag")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False)
    started_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    filters = Column(JSONB)          # the category/subcategory/difficulty picked
    total_questions = Column(Integer)
    score = Column(Integer)


class QuizAttemptAnswer(Base):
    __tablename__ = "quiz_attempt_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attempt_id = Column(Integer, ForeignKey("quiz_attempts.id"), nullable=False)
    question_id = Column(String, ForeignKey("questions.id"), nullable=False)
    selected_option = Column(String)
    is_correct = Column(Boolean)
