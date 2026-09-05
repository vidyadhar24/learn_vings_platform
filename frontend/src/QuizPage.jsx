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
      <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
        <h2>Score: {result.score} / {result.total}</h2>
        {result.review.map((r) => (
          <div key={r.question_id} style={{ margin: "12px 0", padding: 8, border: "1px solid #ccc" }}>
            <p>{r.question}</p>
            <p style={{ color: r.is_correct ? "green" : "red" }}>
              Your answer: {r.selected_option} {r.is_correct ? "(correct)" : `(correct: ${r.correct_option})`}
            </p>
            {r.explanation && <p><em>{r.explanation}</em></p>}
            <button onClick={() => setFavourite(r.question_id, true)}>Favourite</button>
          </div>
        ))}
        <button onClick={onExit}>Back to menu</button>
      </div>
    );
  }

  // Still answering — show the current question only.
  return (
    <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <p>Question {index + 1} of {questions.length}</p>
      <h3>{current.question}</h3>
      {current.options.map((opt) => (
        <div key={opt.id}>
          <label>
            <input
              type="radio"
              name="option"
              checked={selected === opt.id}
              onChange={() => setSelected(opt.id)}
            />
            {opt.text}
          </label>
        </div>
      ))}
      <button onClick={handleNext} disabled={!selected}>
        {isLastQuestion ? "Finish" : "Next"}
      </button>
    </div>
  );
}

