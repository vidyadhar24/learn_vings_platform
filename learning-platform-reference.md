# Learning Platform: Reference

## Stack
- Backend: FastAPI on Render (web service, free tier)
- Frontend: React + Vite on Render (static site)
- Database: Neon Postgres (free tier)
- Python packages via `uv` (`pyproject.toml`); frontend via `npm`
- LLM: Gemini through an OpenAI-compatible client (`llm_client.py`)
- Switching LLM provider = change `.env` only (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`)

## Running locally
- Backend: from project root, `uv run uvicorn backend.app.main:app --reload`
- Frontend: from `frontend/`, `npm run dev`
- Use Chrome (admin secret `prompt()` does not work in VS Code's embedded browser)
- API docs: `http://localhost:8000/docs`
- Frontend API address: `BASE_URL` at top of `api.js` (hardcoded to `http://localhost:8000`; point it at the Render backend URL for production)

## Render
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (runs from `backend/`)
- Free tier sleeps after 15 min idle; first request is slow
- All env vars must also be set in Render's Environment tab
- Anything outside `backend/app/` (e.g. root `db.py`) is not importable on Render
- `main.py` must import `init_db` from `.database`

## Environment variables
- `DATABASE_URL`: Neon connection string
- `ADMIN_SECRET`: passphrase for admin routes
- `JWT_SECRET_KEY`: signs login tokens; keep different from `ADMIN_SECRET`
- `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`
- One `.env` at project root only
- No quotes, no spaces in values
- Fully restart backend after editing `.env` (`--reload` does not pick it up)
- Shell-exported variables override `.env` unless `load_dotenv(override=True)`
- Never print secrets in `config.py`
- Changing `JWT_SECRET_KEY` logs everyone out

## Who can do what

### Not logged in
- Browse categories, subcategories, topics
- Start a Quiz or Prepare session
- Cannot: submit a quiz, favourite, tag, rate, view stats, use Browse tabs

### Logged-in user
- Submit quiz (Finish) and see results
- Favourite / unfavourite questions
- Add tags to questions
- Rate questions (Again / Hard / Good / Easy)
- Browse own Favourites and By tag
- View own Stats (by category + session history)
- Use "Revisit questions rated" filter
- Favourites, tags, ratings, attempts, stats are all per-user; users never see each other's

### Admin (anyone who knows `ADMIN_SECRET`)
- Not a user role; no login needed
- Load Data page: Upload file, Generate with LLM, Content Overview, Platform Stats
- "Explain with LLM" button (also needs the secret; regular users cannot use it without it)
- Sees content across everyone: question counts, platform-wide user and attempt numbers

### Admin secret flow
- Prompt appears on first admin action per tab session
- Stored in `sessionStorage` (cleared when tab closes)
- Wrong secret: 403, cleared, re-prompts once
- Cancel: error message shown on the page
- Content Overview and Platform Stats prompt as soon as the tab opens
- Upload and Generate prompt when the button is clicked

## Accounts and passwords
- Signup / login via "Log in / Sign up" link, top right of Home
- Email is the unique login ID; each user gets an auto-increment integer `id`
- Passwords stored only as bcrypt hashes; nobody can read them, including you
- Login token (JWT): 7-day expiry, stored in browser `localStorage` as `authToken`
- Log out = deletes the token from the browser
- Expired or invalid token: 401, token cleared, log in again
- Wrong email and wrong password give the same error (intentional)
- Keep `bcrypt==4.0.1` pinned (newer versions break passlib)

## Content
- One `questions` table; `type` is `mcq` or `qna`; type-specific fields live in `payload` (JSONB)
- JSONL fields (both types): `id`, `type`, `category`, `subcategory`, `topic`, `difficulty`, `question`, `source`, `source_url`, `tags`
- MCQ extra: `options` (`[{id, text}]`), `correct_option`, `explanation`
- QnA extra: `answer`, `examples`, `code`
- File upload upserts on `id` (re-upload updates content)
- Tags inside uploaded files are ignored (tags are per-user, created in the UI)
- Upload limit: 5 MB (413 if larger)
- Bad lines do not stop the file; each failure is reported with its line number

### LLM generation
- Fill form, Generate (preview only, nothing saved), then "Insert into DB"
- Max 50 questions per request
- Topic filled: every question forced to that topic
- Topic blank: LLM varies topics
- IDs minted by backend (`mcq_` / `qna_` + 10 hex chars); never overwrites existing rows
- Saved with `source = "llm"`
- If Gemini is overloaded: retry later or use file upload

## Rating and revisit
- 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
- Rating buttons appear on the quiz results screen only
- Re-rating overwrites the old value
- Start screen dropdown "Revisit questions rated": Again only / Hard or worse / Good or worse / Any rated
- Dropdown sends `max_rating`; combines with category, subcategory, topic, difficulty
- Works only when logged in; ignored when logged out
- Number of questions is a maximum; fewer come back if fewer match

## Database tables
- `users`
- `questions`
- `tags` (tag names are shared across users)
- `question_tags` (per-user link: question + tag + user)
- `question_favourites` (per-user)
- `question_ratings` (per-user, rating 1-4)
- `quiz_attempts` (per-user)
- `quiz_attempt_answers`
- Unused columns: `questions.rating`, `questions.duplicate`
- `questions.favourite` removed from the model (may linger in older databases)

### Schema changes
- Tables auto-created at startup via `init_db()`
- `create_all` only adds missing tables; never alters existing ones
- Changing a column: drop affected tables, restart (their data is lost)
- Dropping `questions` needs `CASCADE`
- Alembic not set up yet

## Limits and protections
- Rate limits (per IP, in memory, reset on restart): `/admin/generate` 2/min; `/admin/load`, `/admin/commit`, `/admin/platform-stats` 20/min
- Over the limit: 429
- `num_questions`: 1-50, enforced server-side
- Admin routes need `X-Admin-Secret` header (403 if wrong)
- User routes need `Authorization: Bearer <token>` (401 if wrong or expired)

## Admin pages
- Content Overview: category > subcategory > topic drill-down with mcq / qna counts
- Platform Stats: total users, new today, new this week, total quiz attempts, attempts today, active users (7 days)

## Testing tips
- Swagger `/docs` does not reliably send header params; test authenticated routes with `curl`
- User header: `-H 'authorization: Bearer <token>'`
- Admin header: `-H 'X-Admin-Secret: <secret>'`
- Check data directly in Neon: `SELECT * FROM users;` etc.

## Dependencies added during this phase
- `slowapi`
- `"passlib[bcrypt]"` (quote it in zsh)
- `bcrypt==4.0.1`
- `"python-jose[cryptography]"`
- `"pydantic[email]"`

## Not built yet
- Password reset and email verification
- Rate limiting on login / signup attempts
- Admin accounts (one shared secret only)
- Rating widget in Browse and Prepare
- Rating buttons do not show a previously saved rating
- "Obsolete" flag for outdated questions (decided: admin-only boolean on `questions`, build together with duplicate detection)
- Duplicate-detection UI
- Full spaced repetition (SM-2): extend `question_ratings` with `ease_factor`, `interval_days`, `next_review_date`, `review_count`
- Real-time "who's online" (stats are aggregate counts only)
- Tags from uploaded files (`/admin/load` skips them)
- Alembic migrations
- Planned: full database reset with fresh data once features settle
