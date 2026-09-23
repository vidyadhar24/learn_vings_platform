from pydantic import BaseModel, Field

class RatingIn(BaseModel):
    """1=Again (didn't know it), 2=Hard, 3=Good, 4=Easy — same scale
    spaced-repetition algorithms expect, so this can grow into that later."""
    rating: int = Field(..., ge=1, le=4)

class RatingOut(BaseModel):
    question_id: str
    rating: int