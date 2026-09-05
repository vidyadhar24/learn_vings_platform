"""Engine + session factory, and a helper to create all tables."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config import DATABASE_URL
from db_models import Base

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def init_db():
    """Creates all tables if they don't exist yet. Fine for now;
    switch to Alembic migrations once the schema stabilizes."""
    Base.metadata.create_all(engine)
