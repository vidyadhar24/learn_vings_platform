import { useState, useEffect } from "react";
import { getPrepareQuestions, setFavourite, assignTag } from "./api";

export default function PreparePage({ filters, onExit }) {
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    getPrepareQuestions(filters).then(setQuestions);
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Prepare</h2>
      {questions.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}
      <button onClick={onExit}>Back to menu</button>
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
    <div style={{ margin: "12px 0", padding: 8, border: "1px solid #ccc" }}>
      <p><strong>{question.question}</strong></p>

      {!revealed ? (
        <button onClick={() => setRevealed(true)}>Show answer</button>
      ) : (
        <>
          <p>{question.answer}</p>
          {question.examples.length > 0 && (
            <ul>{question.examples.map((ex, i) => <li key={i}>{ex}</li>)}</ul>
          )}
          {question.code && <pre>{question.code}</pre>}
        </>
      )}

      <div style={{ marginTop: 8 }}>
        <button onClick={handleFavourite}>{isFavourite ? "★ Favourited" : "☆ Favourite"}</button>
        <input
          placeholder="Add tag..."
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
        />
        <button onClick={handleAddTag}>Tag</button>
      </div>
    </div>
  );
}
