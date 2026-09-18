from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt, JWTError
from .config import JWT_SECRET_KEY

from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from .database import get_db
from .db_models import User

# bcrypt is the industry-standard choice here — deliberately slow by
# design, which makes brute-forcing stolen hashes impractical.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain_password: str) -> str:
    """Called at signup — turns the user's password into a one-way hash
    before it ever touches the database."""
    return pwd_context.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Called at login — re-hashes the entered password using the same
    salt stored in hashed_password, and compares. We never decrypt the
    stored hash; hashing is one-directional."""
    return pwd_context.verify(plain_password, hashed_password)


ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days — user stays logged in a week

def create_access_token(user_id: int) -> str:
    """Called right after a successful login/signup. Packs the user's ID
    and an expiry time into a signed token the frontend will store and
    send back on every request."""
    expire = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> int | None:
    """Called on every request to a protected route. Returns the user_id
    if the token is valid and unexpired, or None if it's been tampered
    with, expired, or malformed."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except JWTError:
        return None

def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> User:
    """Reads the 'Authorization: Bearer <token>' header, decodes it, and
    returns the matching User row. Raises 401 if the header is missing,
    malformed, the token is invalid/expired, or the user no longer exists."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")

    return user