import { useState, useEffect } from "react";
import { getPrepareQuestions, setFavourite, assignTag } from "./api";

// Answers are written with one point per line (see prompt-qna.md). Splitting
// on "\n" and rendering as <li> is what actually turns that into a visible
// bullet list — HTML collapses raw newlines in a <p>, so this step is required
// even though the source text is already formatted with "- " per line.
function AnswerText({ answer }) {
  const lines = answer.split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean);
  if (lines.length <= 1) return <p className="question-text">{answer}</p>;
  return (
    <ul className="question-text" style={{ paddingLeft: 20 }}>
      {lines.map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  );
}

export default function PreparePage({ filters, onExit }) {
  const [questions, setQuestions] = useState(null); // null = still loading, [] = loaded but empty
  const [index, setIndex] = useState(0);

  useEffect(() => {
    getPrepareQuestions(filters).then(setQuestions);
  }, []);

  if (questions === null) return <p style={{ color: "var(--card)", textAlign: "center", marginTop: 64 }}>Loading questions...</p>;

  if (questions.length === 0) {
    return (
      <div className="card-stack">
        <p className="question-text">No questions match that combination. Try a different category, subcategory, topic, or difficulty.</p>
        <button className="btn" onClick={onExit}>Home</button>
      </div>
    );
  }

  const current = questions[index];
  const isFirst = index === 0;
  const isLast = index === questions.length - 1;

  return (
    <div className="card-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="pill-btn" onClick={onExit}>Home</button>
        <p className="counter" style={{ margin: 0 }}>Question {index + 1} of {questions.length}</p>
      </div>
      <div className="progress-line">
        <div className="progress-fill" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>

      {/* key={current.id} forces QuestionCard to remount per question, so its
          "revealed"/tag state resets automatically when moving to the next card. */}
      <QuestionCard key={current.id} question={current} />

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
        <button className="pill-btn" onClick={() => setIndex(index - 1)} disabled={isFirst}>
          ← Previous
        </button>
        <button className="btn" onClick={() => setIndex(index + 1)} disabled={isLast}>
          Next →
        </button>
      </div>
    </div>
  );
}

// Split out because each card needs its own "revealed" and "tag input"
// state — keeping that in the parent would mean tracking one object
// keyed by question id instead of just useState per card.
function QuestionCard({ question }) {
  const [revealed, setRevealed] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [isFavourite, setIsFavourite] = useState(false);

  function handleFavourite() {
    const next = !isFavourite;
    setFavourite(question.id, next).then(() => setIsFavourite(next));
  }

  function handleAddTag() {
    if (!tagInput.trim()) return;
    assignTag(question.id, tagInput.trim()).then(() => setTagInput(""));
  }

  return (
    <div style={{ margin: "16px 0", paddingBottom: 16, borderBottom: "1px solid #e4dfd0" }}>
      <p className="question-text" style={{ fontWeight: 600 }}>{question.question}</p>

      {!revealed ? (
        <button className="pill-btn" onClick={() => setRevealed(true)}>Show answer</button>
      ) : (
        <>
          <AnswerText answer={question.answer} />
          {question.examples.length > 0 && (
            <ul style={{ color: "var(--ink-muted)" }}>{question.examples.map((ex, i) => <li key={i}>{ex}</li>)}</ul>
          )}
          {question.code && (
            <pre style={{ background: "#EFEAD9", padding: 12, overflowX: "auto" }}>{question.code}</pre>
          )}
        </>
      )}

      <div className="card-actions">
        <button className={`pill-btn ${isFavourite ? "active" : ""}`} onClick={handleFavourite}>
          {isFavourite ? "★ Favourited" : "☆ Favourite"}
        </button>
        <input
          className="pill-input"
          placeholder="Add tag..."
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
        />
        <button className="pill-btn" onClick={handleAddTag}>+ Tag</button>
      </div>
    </div>
  );
}
