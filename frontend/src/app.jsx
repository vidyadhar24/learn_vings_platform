import { useState, useEffect } from "react";
import { getCategories, getSubcategories, getTopics } from "./api";
import QuizPage from "./QuizPage";
import PreparePage from "./PreparePage";

// This component owns the filter selection UI, shared by both modes.
// Once the user hits "Start", we hand the chosen filters + mode down
// to whichever page component takes over.
export default function App() {
  const [mode, setMode] = useState(null); // "quiz" | "prepare" | null
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [topics, setTopics] = useState([]);

  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);

  const [started, setStarted] = useState(false);

  // Load categories once, on first render.
  useEffect(() => {
    getCategories().then((data) => setCategories(data.categories));
  }, []);

  // Re-fetch subcategories whenever the chosen category changes.
  useEffect(() => {
    if (!category) return;
    setSubcategory(""); // reset downstream selections
    setTopic("");
    getSubcategories(category).then((data) => setSubcategories(data.subcategories));
  }, [category]);

  // Re-fetch topics whenever category or subcategory changes.
  useEffect(() => {
    if (!category) return;
    setTopic("");
    getTopics(category, subcategory).then((data) => setTopics(data.topics));
  }, [category, subcategory]);

  const filters = { category, subcategory, topic, difficulty, limit: numQuestions };

  if (started && mode === "quiz") {
    return <QuizPage filters={filters} onExit={() => setStarted(false)} />;
  }
  if (started && mode === "prepare") {
    return <PreparePage filters={filters} onExit={() => setStarted(false)} />;
  }

  return (
    <div className="card-stack">
      <h1 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>Learning Platform</h1>

      <div>
        <button className="btn" onClick={() => setMode("quiz")} disabled={mode === "quiz"}>Quiz</button>{" "}
        <button className="btn" onClick={() => setMode("prepare")} disabled={mode === "prepare"}>Prepare</button>
      </div>

      {mode && (
        <div style={{ marginTop: 24 }}>
          <div>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={!category}>
              <option value="">Any subcategory</option>
              {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={topic} onChange={(e) => setTopic(e.target.value)} disabled={!category}>
              <option value="">Any topic</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ marginTop: 8 }}>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Any difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>

            <input
              type="number"
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              min={1}
              max={50}
              style={{ width: 60 }}
            />
          </div>

          <button className="btn" style={{ marginTop: 16 }} onClick={() => setStarted(true)} disabled={!category}>
            Start
          </button>
        </div>
      )}
    </div>
  );
}
