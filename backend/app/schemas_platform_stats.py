from pydantic import BaseModel

class PlatformStatsOut(BaseModel):
    total_users: int
    new_users_today: int
    new_users_this_week: int
    total_quiz_attempts: int
    quiz_attempts_today: int
    active_users_last_7_days: int