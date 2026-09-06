"""
Single-purpose LLM client. The whole point of this file is that it should
NEVER need an if/else per provider — Gemini and local model servers
(Ollama, vLLM, LM Studio...) all speak the same "chat completions" protocol,
so swapping providers is a .env change (LLM_BASE_URL/LLM_API_KEY/LLM_MODEL),
never a code change here.
"""
from openai import OpenAI
from .config import LLM_BASE_URL, LLM_API_KEY, LLM_MODEL

client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)


def generate_text(prompt: str) -> str:
    """Sends one prompt, returns the raw text response. Kept intentionally
    simple (no streaming, no conversation history) since every use in this
    app is a single one-shot generation, not a back-and-forth chat."""
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content