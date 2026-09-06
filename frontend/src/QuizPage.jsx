import { useState, useEffect } from "react";
import { getQuizQuestions, submitQuiz, setFavourite, assignTag } from "./api";
import ExplainWithLLM from "./ExplainWithLLM";

// Three states this component can be in:
// "loading" -> "answering" (one question shown at a time) -> "results"
export default function QuizPage({ filters, onExit }) {
  const [questions, setQuestions] = useState(null); // null = still loading, [] = loaded but empty
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(""); // option id chosen for current question
  const [answers, setAnswers] = useState([]);   // collected {question_id, selected_option}
  const [result, setResult] = useState(null);   // set once /quiz/submit responds

  useEffect(() => {
    getQuizQuestions(filters).then(setQuestions);
  }, []); // filters are fixed for the lifetime of one quiz run

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
  const isLastQuestion = index === questions.length - 1;

  function handleNext() {
    const updatedAnswers = [...answers, { question_id: current.id, selected_option: selected }];
    setSelected("");

    if (isLastQuestion) {
      // Submit only once, after the final question is answered.
      submitQuiz({ ...filters, answers: updatedAnswers }).then(setResult);
    } else {
      setAnswers(updatedAnswers);
      setIndex(index + 1);
    }
  }

  if (result) {
    const percentage = Math.round((result.score / result.total) * 100);
    return (
      <div className="card-stack">
        <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>
          Score: {result.score} / {result.total} ({percentage}%)
        </h2>
        {result.review.map((r) => (
          <ReviewItem key={r.question_id} review={r} />
        ))}
        <button className="btn" onClick={onExit}>Home</button>
      </div>
    );
  }

  // Still answering — show the current question only.
  return (
    <div className="card-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn-secondary" onClick={onExit}>Home</button>
        <p className="counter" style={{ margin: 0 }}>Question {index + 1} of {questions.length}</p>
      </div>
      <div className="progress-line">
        <div className="progress-fill" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>
      <h3 className="question-text">{current.question}</h3>
      {current.options.map((opt) => (
        <div key={opt.id} style={{ margin: "6px 0" }}>
          <label>
            <input
              type="radio"
              name="option"
              checked={selected === opt.id}
              onChange={() => setSelected(opt.id)}
            />{" "}
            {opt.text}
          </label>
        </div>
      ))}
      <button className="btn" style={{ marginTop: 16 }} onClick={handleNext} disabled={!selected}>
        {isLastQuestion ? "Finish" : "Next"}
      </button>
    </div>
  );
}

// One card per graded question on the results screen. Own local state
// (like PreparePage's QuestionCard) so favouriting/tagging one question
// doesn't re-render or affect the others.
function ReviewItem({ review: r }) {
  const [isFavourite, setIsFavourite] = useState(false);
  const [tagInput, setTagInput] = useState("");

  function handleFavourite() {
    const next = !isFavourite;
    setFavourite(r.question_id, next).then(() => setIsFavourite(next));
  }

  function handleAddTag() {
    if (!tagInput.trim()) return;
    assignTag(r.question_id, tagInput.trim()).then(() => setTagInput(""));
  }

  return (
    <div
      style={{
        margin: "16px 0",
        padding: 16,
        borderRadius: 4,
        background: r.is_correct ? "#e3ecd3" : "#f3ded6", // light green vs light orange
      }}
    >
      <p className="question-text">{r.question}</p>
      <p className={r.is_correct ? "correct" : "incorrect"}>
        Your answer: {r.selected_text} {r.is_correct ? "(correct)" : `(correct: ${r.correct_text})`}
      </p>
      {r.explanation && <p style={{ color: "var(--ink-muted)" }}><em>{r.explanation}</em></p>}

      <ExplainWithLLM questionId={r.question_id} />

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
