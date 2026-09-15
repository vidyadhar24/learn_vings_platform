import { useState, useEffect } from "react";
import { getSessionStats, getStatsOverview } from "./api";

export default function StatsPage({ onExit }) {
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    getStatsOverview().then(setOverview);
    getSessionStats().then(setSessions);
  }, []);

  return (
    <div className="card-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="pill-btn" onClick={onExit}>Home</button>
        <h2 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>Your Stats</h2>
      </div>

      <h3 style={{ marginTop: 24, fontFamily: "var(--font-serif)" }}>By category</h3>
      {overview === null && <p>Loading...</p>}
      {overview?.length === 0 && <p style={{ color: "var(--ink-muted)" }}>No quiz attempts yet.</p>}

      {overview?.length > 0 && (() => {
        // Grand total across every category — computed here rather than
        // fetched separately, since the per-category rows already contain
        // everything needed to sum it up.
        const totalAttempts = overview.reduce((sum, c) => sum + c.attempts, 0);
        const totalQuestions = overview.reduce((sum, c) => sum + c.total_questions, 0);
        const totalCorrect = overview.reduce((sum, c) => sum + c.total_correct, 0);
        const overallPercentage = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 1000) / 10 : 0;

        return (
          <div style={{ margin: "12px 0", padding: 14, borderRadius: 4, background: "var(--accent)" }}>
            <p style={{ fontWeight: 600, margin: 0 }}>Overall</p>
            <p style={{ margin: "4px 0 0" }}>
              {totalAttempts} session{totalAttempts !== 1 ? "s" : ""} · {totalCorrect}/{totalQuestions} correct · {overallPercentage}% average
            </p>
          </div>
        );
      })()}
      {overview?.map((c) => (
        <div key={c.category} style={{ margin: "12px 0", padding: 14, borderRadius: 4, background: "#EFEAD9" }}>
          <p style={{ fontWeight: 600, margin: 0 }}>{c.category}</p>
          <p style={{ margin: "4px 0 0", color: "var(--ink-muted)" }}>
            {c.attempts} session{c.attempts !== 1 ? "s" : ""} · {c.total_correct}/{c.total_questions} correct overall ·{" "}
            <span className={c.average_percentage >= 70 ? "correct" : "incorrect"}>
              {c.average_percentage}% average
            </span>
          </p>
        </div>
      ))}

      <h3 style={{ marginTop: 24, fontFamily: "var(--font-serif)" }}>Session history</h3>
      {sessions === null && <p>Loading...</p>}
      {sessions?.length === 0 && <p style={{ color: "var(--ink-muted)" }}>Nothing here yet.</p>}
      {sessions?.map((s) => (
        <div key={s.attempt_id} style={{ margin: "8px 0", padding: 10, borderBottom: "1px solid #e4dfd0" }}>
          <p style={{ margin: 0 }}>
            {s.category}{s.subcategory ? ` · ${s.subcategory}` : ""}{s.topic ? ` · ${s.topic}` : ""}
          </p>
          <p style={{ margin: "2px 0 0", color: "var(--ink-muted)", fontSize: "0.9rem" }}>
            {new Date(s.started_at).toLocaleString()} — {s.score}/{s.total_questions} ({s.percentage}%)
          </p>
        </div>
      ))}
    </div>
  );
}
