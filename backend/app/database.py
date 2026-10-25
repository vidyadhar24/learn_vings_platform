"""
DB engine + a per-request session dependency.

Unlike the loader (which opens one session, does its work, closes it),
a web API handles many concurrent requests — each needs its own session
that opens when the request starts and closes when it ends. FastAPI's
dependency injection (`Depends(get_db)`) handles that lifecycle for us.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import DATABASE_URL
from .db_models import Base   # NEW: the metadata that knows every table

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    """Creates any tables that don't exist yet, called once at app startup.
    create_all only ADDS missing tables; it never alters existing ones."""
    Base.metadata.create_all(engine)


def get_db():
    """FastAPI dependency: yields a session, guarantees it's closed after
    the request finishes (even if the endpoint raises an error)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()