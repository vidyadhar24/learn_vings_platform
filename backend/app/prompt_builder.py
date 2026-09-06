"""
Turns a GenerateRequest into the prompt text sent to the LLM. Deliberately
mirrors prompt-mcq.md / prompt-qna.md (the manual copy-paste templates) —
same accuracy requirements, same output schema — just built as an f-string
instead of a file the user edits by hand.
"""
from .schemas_generate import GenerateRequest

_ACCURACY_BLOCK = """\
Accuracy requirements — read carefully before generating:
- Only use information you are highly confident is factually correct and still current as of today. Do not guess, extrapolate, or fill gaps with plausible-sounding but unverified detail.
- If a fact might have changed recently (version numbers, current best practices, deprecated features), either skip it or clearly caveat it.
- Before finalizing each question, silently re-check it: is it unambiguous, and is the correct answer/explanation actually correct? Discard and replace any question that fails this check.

Audience — write for two purposes at once:
1. Someone building real hands-on expertise in the topic.
2. Someone preparing for job interviews on the topic — include conceptual "why/how/trade-off" questions.
"""


def build_prompt(req: GenerateRequest) -> str:
    difficulty_line = (
        f"Spread the {req.num_questions} questions roughly evenly across easy/medium/hard."
        if req.difficulty == "mixed"
        else f"Every question should be {req.difficulty} difficulty."
    )
    custom_line = f"\nAdditional instruction from the user: {req.custom_instruction}\n" if req.custom_instruction else ""

    topic_placeholder = req.topic if req.topic else "<a distinct, specific sub-topic for this question>"

    if req.question_type == "mcq":
        schema_line = (
            '{"id": "placeholder", "type": "mcq", "category": "%s", "subcategory": "%s", "topic": "%s", '
            '"difficulty": "easy|medium|hard", "question": "...", '
            '"options": [{"id": "a", "text": "..."}, {"id": "b", "text": "..."}, {"id": "c", "text": "..."}, {"id": "d", "text": "..."}], '
            '"correct_option": "a", "explanation": "...", "tags": ["..."], "source": "llm", "source_url": null}'
        ) % (req.category, req.subcategory or "", topic_placeholder)
    else:
        schema_line = (
            '{"id": "placeholder", "type": "qna", "category": "%s", "subcategory": "%s", "topic": "%s", '
            '"difficulty": "easy|medium|hard", "question": "...", '
            '"answer": "one point per line, each prefixed with \\"- \\"", '
            '"examples": ["...", "..."], "code": "... or null", "tags": ["..."], "source": "llm", "source_url": null}'
        ) % (req.category, req.subcategory or "", topic_placeholder)

    # Only pin the topic instruction when the user actually specified one —
    # leaving it blank signals "I don't mind, let it vary" (this is what
    # restores the topic diversity that got removed when a fixed topic is given).
    topic_instruction = (
        f'every "topic" field must be exactly "{req.topic}"'
        if req.topic
        else 'vary the "topic" field across questions so it\'s not all one narrow point'
    )

    return f"""\
You are generating {req.question_type.upper()} study material for a learning platform.
Topic: {req.topic or req.category} (category: {req.category}, subcategory: {req.subcategory or "none"}).

{_ACCURACY_BLOCK}
{difficulty_line}
{custom_line}
Generate exactly {req.num_questions} questions within this topic area — {topic_instruction}.
The "id" field will be discarded and replaced — put any placeholder string there.
Output raw JSONL only, one object per line, inside a single fenced code block, no other commentary. Each line must match:
{schema_line}
"""