import { useState, useEffect } from "react";
import { getPrepareQuestions, setFavourite, assignTag } from "./api";

export default function PreparePage({ filters, onExit }) {
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    getPrepareQuestions(filters).then(setQuestions);
  }, []);

  return (
    <div className="card-stack">
      <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>Prepare</h2>
      {questions.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}
      <button className="btn" onClick={onExit}>Back to menu</button>
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
        <button className="btn-secondary" onClick={() => setRevealed(true)}>Show answer</button>
      ) : (
        <>
          <p className="question-text">{question.answer}</p>
          {question.examples.length > 0 && (
            <ul style={{ color: "var(--ink-muted)" }}>{question.examples.map((ex, i) => <li key={i}>{ex}</li>)}</ul>
          )}
          {question.code && (
            <pre style={{ background: "#EFEAD9", padding: 12, overflowX: "auto" }}>{question.code}</pre>
          )}
        </>
      )}

      <div style={{ marginTop: 8 }}>
        <button className="btn-secondary" onClick={handleFavourite}>
          {isFavourite ? "★ Favourited" : "☆ Favourite"}
        </button>{" "}
        <input
          placeholder="Add tag..."
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          style={{ width: 120 }}
        />
        <button className="btn-secondary" onClick={handleAddTag}>Tag</button>
      </div>
    </div>
  );
}
