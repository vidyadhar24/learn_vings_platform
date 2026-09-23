import { useState } from "react";
import { setRating } from "./api";

// 4-button difficulty rating: 1=Again, 2=Hard, 3=Good, 4=Easy.
// Shared across QuizPage/BrowsePage/PreparePage wherever an answer is
// already revealed — rating requires login, so failures (not logged in,
// expired token) surface as a small inline message rather than breaking
// the rest of the question card.
const RATING_LABELS = [
  { value: 1, label: "Again" },
  { value: 2, label: "Hard" },
  { value: 3, label: "Good" },
  { value: 4, label: "Easy" },
];

export default function RatingWidget({ questionId }) {
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  function handleRate(value) {
    setError(null);
    setRating(questionId, value)
      .then(() => setSelected(value))
      .catch((err) => setError(err.message));
  }

  return (
    <div className="card-actions">
      <span style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>How well did you know this?</span>
      {RATING_LABELS.map(({ value, label }) => (
        <button
          key={value}
          className={`pill-btn ${selected === value ? "active" : ""}`}
          onClick={() => handleRate(value)}
        >
          {label}
        </button>
      ))}
      {error && <p className="admin-error" style={{ margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}