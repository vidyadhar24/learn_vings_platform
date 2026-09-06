import { useState, useEffect } from "react";
import { getFavourites, getAllTags, getQuestionsByTag, setFavourite, assignTag } from "./api";
import MarkdownText from "./MarkdownText";
import ExplainWithLLM from "./ExplainWithLLM";

// Two tabs sharing one layout: "Favourites" needs no extra input, "By tag"
// needs a tag picked first. Both end up rendering the same BrowseItem list.
export default function BrowsePage({ onExit }) {
  const [tab, setTab] = useState(null); // null = nothing chosen yet | "favourites" | "tag"
  const [tags, setTags] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [items, setItems] = useState(null); // null = not loaded yet for this view

  useEffect(() => {
    getAllTags().then((data) => setTags(data));
  }, []);

  function handleTabClick(nextTab) {
    setTab(nextTab);
    setItems(null);
    setSelectedTagId("");
    if (nextTab === "favourites") {
      getFavourites().then(setItems);
    }
    // "tag" tab waits for a tag to actually be picked before fetching
  }

  function handleTagPick(tagId) {
    setSelectedTagId(tagId);
    if (tagId) getQuestionsByTag(tagId).then(setItems);
  }

  return (
    <div className="card-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="pill-btn" onClick={onExit}>Home</button>
        <h2 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>Browse</h2>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className={`pill-btn ${tab === "favourites" ? "active" : ""}`} onClick={() => handleTabClick("favourites")}>
          Favourites
        </button>{" "}
        <button className={`pill-btn ${tab === "tag" ? "active" : ""}`} onClick={() => handleTabClick("tag")}>
          By tag
        </button>
      </div>

      {tab === "tag" && (
        <select value={selectedTagId} onChange={(e) => handleTagPick(e.target.value)} style={{ marginTop: 8 }}>
          <option value="">Select a tag</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      {tab === null && <p style={{ color: "var(--ink-muted)", marginTop: 16 }}>Choose Favourites or By tag to begin.</p>}
      {tab && items === null && <p style={{ marginTop: 16 }}>Loading...</p>}
      {items !== null && items.length === 0 && <p style={{ color: "var(--ink-muted)" }}>Nothing here yet.</p>}
      {items && items.map((q) => <BrowseItem key={q.id} question={q} />)}
    </div>
  );
}

// Renders one card, adapting to mcq vs qna since /questions/favourites and
// /questions/by-tag can return either type mixed together.
function BrowseItem({ question }) {
  const [revealed, setRevealed] = useState(false);
  const [isFavourite, setIsFavourite] = useState(question.favourite);
  const [tagInput, setTagInput] = useState("");

  function handleFavourite() {
    const next = !isFavourite;
    setFavourite(question.id, next).then(() => setIsFavourite(next));
  }

  function handleAddTag() {
    if (!tagInput.trim()) return;
    assignTag(question.id, tagInput.trim()).then(() => setTagInput(""));
  }

  return (
    <div style={{ margin: "16px 0", padding: 16, borderRadius: 4, background: "#EFEAD9" }}>
      <p className="question-text" style={{ fontWeight: 600 }}>{question.question}</p>

      {!revealed ? (
        <button className="pill-btn" onClick={() => setRevealed(true)}>Show answer</button>
      ) : question.type === "mcq" ? (
        <ul>
          {question.payload.options.map((opt) => (
            <li key={opt.id} style={{ fontWeight: opt.id === question.payload.correct_option ? 600 : 400 }}>
              {opt.text} {opt.id === question.payload.correct_option && "(correct)"}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <MarkdownText>{question.payload.answer}</MarkdownText>
          {question.payload.code && (
            <pre style={{ background: "#EFEAD9", padding: 12, overflowX: "auto" }}>{question.payload.code}</pre>
          )}
        </>
      )}

      {revealed && <ExplainWithLLM questionId={question.id} />}

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
