"""Schemas for POST /questions/{id}/explain."""
from typing import Optional
from pydantic import BaseModel


class ExplainRequest(BaseModel):
    custom_instruction: Optional[str] = None  # e.g. "explain with examples", "show code"


class ExplainResponse(BaseModel):
    explanation: str