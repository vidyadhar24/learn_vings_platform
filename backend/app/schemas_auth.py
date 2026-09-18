from pydantic import BaseModel, EmailStr

class SignupRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    """Returned by both signup and login — the frontend stores this
    token and attaches it to future requests to prove who's calling."""
    access_token: str
    token_type: str = "bearer"