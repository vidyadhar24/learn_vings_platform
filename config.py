"""Loads settings from environment / .env file."""
import os
from dotenv import load_dotenv

load_dotenv()

# Postgres connection string, e.g. postgresql://user:pass@host/dbname
# Points at local Docker Postgres during dev, Neon when loading the real DB.
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/learning_platform")

# Placeholder user id until real auth exists — every per-user row uses this.
DEFAULT_USER_ID = "local"
