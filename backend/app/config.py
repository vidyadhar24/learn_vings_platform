"""Same idea as the loader's config.py — kept separate because the backend
and the loader are two different deployables (API server vs. one-off script)."""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/learning_platform")
DEFAULT_USER_ID = "local"

# LLM settings — deliberately provider-agnostic. Any OpenAI-compatible
# endpoint works here unchanged: Gemini today (which speaks this protocol
# natively), a local Ollama/vLLM server tomorrow, just by changing these
# three values in .env — no code changes needed elsewhere.
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
LLM_API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get("GEMINI_API_KEY")
LLM_MODEL = os.environ.get("LLM_MODEL", "gemini-3.5-flash")