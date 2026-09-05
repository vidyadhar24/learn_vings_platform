"""Schemas for tag creation/assignment and favourite toggling."""
from pydantic import BaseModel


class TagOut(BaseModel):
    id: int
    name: str


class TagAssignIn(BaseModel):
    """Body for assigning a tag to a question. Name, not id — the UI lets
    users type a new tag name on the fly, so the endpoint creates it if
    it doesn't exist yet (see /questions/{id}/tags in main.py)."""
    name: str


class FavouriteIn(BaseModel):
    favourite: bool