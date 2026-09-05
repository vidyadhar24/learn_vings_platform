import { useState, useEffect } from "react";
import { getQuizQuestions, submitQuiz, setFavourite } from "./api";

// Three states this component can be in:
// "loading" -> "answering" (one question shown at a time) -> "results"
export default function QuizPage({ filters, onExit }) {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(""); // option id chosen for current question
  const [answers, setAnswers] = useState([]);   // collected {question_id, selected_option}
  const [result, setResult] = useState(null);   // set once /quiz/submit responds

  useEffect(() => {
    getQuizQuestions(filters).then((data) => setQuestions(data));
  }, []); // filters are fixed for the lifetime of one quiz run

  if (questions.length === 0) return <p>Loading questions...</p>;

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
    return (
      <div className="card-stack">
        <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>Score: {result.score} / {result.total}</h2>
        {result.review.map((r) => (
          <div key={r.question_id} style={{ margin: "16px 0", paddingBottom: 16, borderBottom: "1px solid #e4dfd0" }}>
            <p className="question-text">{r.question}</p>
            <p className={r.is_correct ? "correct" : "incorrect"}>
              Your answer: {r.selected_option} {r.is_correct ? "(correct)" : `(correct: ${r.correct_option})`}
            </p>
            {r.explanation && <p style={{ color: "var(--ink-muted)" }}><em>{r.explanation}</em></p>}
            <button className="btn-secondary" onClick={() => setFavourite(r.question_id, true)}>Favourite</button>
          </div>
        ))}
        <button className="btn" onClick={onExit}>Back to menu</button>
      </div>
    );
  }

  // Still answering — show the current question only.
  return (
    <div className="card-stack">
      <p className="counter">Question {index + 1} of {questions.length}</p>
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
