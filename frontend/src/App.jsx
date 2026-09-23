import { useState, useEffect } from "react";
import { getCategories, getSubcategories, getTopics, clearAuthToken } from "./api";
import QuizPage from "./QuizPage";
import PreparePage from "./PreparePage";
import BrowsePage from "./BrowsePage";
import AdminUploadPage from "./AdminUploadPage";
import StatsPage from "./StatsPage";
import LoginPage from "./LoginPage";

export default function App() {
  const [mode, setMode] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [topics, setTopics] = useState([]);

  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);

  const [started, setStarted] = useState(false);

  // Just checks whether a token exists — doesn't validate it against the
  // backend here; an expired/invalid token gets caught the moment a
  // protected route is actually called (authFetch handles that in api.js).
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("authToken"));

  useEffect(() => {
    if (mode === null) {
      getCategories().then((data) => setCategories(data.categories));
    }
  }, [mode]);

  useEffect(() => {
    if (!category) return;
    setSubcategory("");
    setTopic("");
    getSubcategories(category).then((data) => setSubcategories(data.subcategories));
  }, [category]);

  useEffect(() => {
    if (!category) return;
    setTopic("");
    getTopics(category, subcategory).then((data) => setTopics(data.topics));
  }, [category, subcategory]);

  const filters = { category, subcategory, topic, difficulty, limit: numQuestions };

  function handleLogout() {
    clearAuthToken();
    setLoggedIn(false);
  }

  if (started && mode === "quiz") {
    return <QuizPage filters={filters} onExit={() => setStarted(false)} />;
  }
  if (started && mode === "prepare") {
    return <PreparePage filters={filters} onExit={() => setStarted(false)} />;
  }
  if (mode === "browse") {
    return <BrowsePage onExit={() => setMode(null)} />;
  }
  if (mode === "admin") {
    return <AdminUploadPage onExit={() => setMode(null)} />;
  }
  if (mode === "stats") {
    return <StatsPage onExit={() => setMode(null)} />;
  }
  if (mode === "login") {
    return (
      <LoginPage
        onExit={() => setMode(null)}
        onSuccess={() => {
          setLoggedIn(true);
          setMode(null);
        }}
      />
    );
  }

  return (
    <div className="card-stack">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        {loggedIn ? (
          <button className="btn-secondary" onClick={handleLogout}>Log out</button>
        ) : (
          <button className="btn-secondary" onClick={() => setMode("login")}>Log in / Sign up</button>
        )}
      </div>

      <h1 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>Learning Platform</h1>

      <div>
        <button className="btn" onClick={() => setMode("quiz")} disabled={mode === "quiz"}>Quiz</button>{" "}
        <button className="btn" onClick={() => setMode("prepare")} disabled={mode === "prepare"}>Prepare</button>{" "}
        <button className="btn" onClick={() => setMode("browse")}>Browse</button>{" "}
        <button className="btn" onClick={() => setMode("admin")}>Load Data</button>{" "}
        <button className="btn" onClick={() => setMode("stats")}>Stats</button>
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