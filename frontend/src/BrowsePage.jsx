import { useState, useEffect } from "react";
import { getFavourites, getAllTags, getQuestionsByTag, setFavourite, assignTag } from "./api";

// Two tabs sharing one layout: "Favourites" needs no extra input, "By tag"
// needs a tag picked first. Both end up rendering the same BrowseItem list.
export default function BrowsePage({ onExit }) {
  const [tab, setTab] = useState("favourites"); // "favourites" | "tag"
  const [tags, setTags] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [items, setItems] = useState(null); // null = not loaded yet for this view

  useEffect(() => {
    getAllTags().then((data) => setTags(data));
  }, []);

  useEffect(() => {
    if (tab === "favourites") {
      getFavourites().then(setItems);
    } else {
      setItems(null); // wait for a tag to be picked before fetching
    }
  }, [tab]);

  function handleTagPick(tagId) {
    setSelectedTagId(tagId);
    if (tagId) getQuestionsByTag(tagId).then(setItems);
  }

  return (
    <div className="card-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn-secondary" onClick={onExit}>Home</button>
        <h2 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>Browse</h2>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn-secondary" onClick={() => setTab("favourites")} disabled={tab === "favourites"}>
          Favourites
        </button>{" "}
        <button className="btn-secondary" onClick={() => setTab("tag")} disabled={tab === "tag"}>
          By tag
        </button>
      </div>

      {tab === "tag" && (
        <select value={selectedTagId} onChange={(e) => handleTagPick(e.target.value)} style={{ marginTop: 8 }}>
          <option value="">Select a tag</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      {items === null && tab === "favourites" && <p>Loading...</p>}
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
    <div style={{ margin: "16px 0", paddingBottom: 16, borderBottom: "1px solid #e4dfd0" }}>
      <p className="question-text" style={{ fontWeight: 600 }}>{question.question}</p>

      {!revealed ? (
        <button className="btn-secondary" onClick={() => setRevealed(true)}>Show answer</button>
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
          <p className="question-text">{question.payload.answer}</p>
          {question.payload.code && (
            <pre style={{ background: "#EFEAD9", padding: 12, overflowX: "auto" }}>{question.payload.code}</pre>
          )}
        </>
      )}

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
