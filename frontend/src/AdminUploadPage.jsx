import { useState, useEffect } from "react";
import { uploadJsonl, generateQuestions, commitGenerated, getContentOverview } from "./api";

export default function AdminUploadPage({ onExit }) {
  const [tab, setTab] = useState("file"); // "file" | "generate" | "content"

  return (
    <div className="card-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="pill-btn" onClick={onExit}>Home</button>
        <h2 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>Load Data</h2>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className={`pill-btn ${tab === "file" ? "active" : ""}`} onClick={() => setTab("file")}>
          Upload file
        </button>{" "}
        <button className={`pill-btn ${tab === "generate" ? "active" : ""}`} onClick={() => setTab("generate")}>
          Generate with LLM
        </button>{" "}
        <button className={`pill-btn ${tab === "content" ? "active" : ""}`} onClick={() => setTab("content")}>
          Content Overview
        </button>
      </div>

      {tab === "file" && <FileUploadTab />}
      {tab === "generate" && <GenerateTab />}
      {tab === "content" && <ContentOverviewTab />}
    </div>
  );
}

// The original file-upload flow, unchanged — just extracted into its own
// component now that it shares the page with the generate tab.
function FileUploadTab() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    uploadJsonl(file).then(setResult).finally(() => setUploading(false));
  }

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ color: "var(--ink-muted)" }}>
        Upload a .jsonl file (MCQ or Q&amp;A format) to load it into the database.
      </p>
      <input type="file" accept=".jsonl" onChange={(e) => setFile(e.target.files[0])} />
      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
      <UploadResult result={result} />
    </div>
  );
}

// Shared between the two tabs — both /admin/load and /admin/commit
// return the same {loaded/inserted, failed, errors} shape.
function UploadResult({ result, mode = "load" }) {
  if (!result) return null;
  const successCount = result.loaded ?? result.inserted;
  const successLabel = mode === "load" ? "loaded" : "generated successfully";
  return (
    <div style={{ marginTop: 24 }}>
      <p><strong>{successCount}</strong> {successLabel}{result.failed != null && <>, <strong>{result.failed}</strong> failed to parse</>}.</p>
      {result.errors?.map((err) => (
        <div key={err.line} style={{ margin: "8px 0", padding: 10, borderRadius: 4, background: "#f3ded6" }}>
          <span className="incorrect">Line {err.line}:</span> {err.error}
        </div>
      ))}
    </div>
  );
}

// The new flow: fill in the 5 fields (+ optional instruction) -> generate
// a PREVIEW (nothing in the DB yet) -> review it -> commit if it looks good.
function GenerateTab() {
  const [form, setForm] = useState({
    question_type: "mcq",
    category: "",
    subcategory: "",
    topic: "",
    num_questions: 10,
    difficulty: "mixed",
    custom_instruction: "",
  });
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null); // { items, errors } from /admin/generate
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);

  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  function handleGenerate() {
    setGenerating(true);
    setPreview(null);
    setCommitResult(null);
    generateQuestions(form).then(setPreview).finally(() => setGenerating(false));
  }

  function handleCommit() {
    setCommitting(true);
    commitGenerated(preview.items)
      .then((res) => {
        setCommitResult(res);
        setPreview(null); // once committed, the preview is stale — clear it
      })
      .finally(() => setCommitting(false));
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="field-group">
        <label className="field-label">Question type</label>
        <select value={form.question_type} onChange={(e) => updateField("question_type", e.target.value)} style={{ width: 160 }}>
          <option value="mcq">MCQ</option>
          <option value="qna">Q&amp;A</option>
        </select>
      </div>

      <div className="field-row">
        <div className="field-group" style={{ flex: 1 }}>
          <label className="field-label">Category</label>
          <input
            placeholder="e.g. Data Engineering"
            value={form.category}
            onChange={(e) => updateField("category", e.target.value)}
          />
        </div>
        <div className="field-group" style={{ flex: 1 }}>
          <label className="field-label">Subcategory</label>
          <input
            placeholder="Optional"
            value={form.subcategory}
            onChange={(e) => updateField("subcategory", e.target.value)}
          />
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Topic</label>
        <input
          placeholder="Optional"
          value={form.topic}
          onChange={(e) => updateField("topic", e.target.value)}
        />
      </div>

      <div className="field-row">
        <div className="field-group">
          <label className="field-label">Difficulty</label>
          <select value={form.difficulty} onChange={(e) => updateField("difficulty", e.target.value)}>
            <option value="mixed">Mixed</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="field-group">
          <label className="field-label">Number of questions</label>
          <input
            type="number"
            value={form.num_questions}
            onChange={(e) => updateField("num_questions", Number(e.target.value))}
            min={1}
            max={50}
            style={{ width: 80 }}
          />
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Custom instruction</label>
        <textarea
          placeholder="Optional — e.g. 'focus on real-world scenarios'"
          value={form.custom_instruction}
          onChange={(e) => updateField("custom_instruction", e.target.value)}
          style={{ width: "100%" }}
          rows={2}
        />
      </div>

      <button className="btn" onClick={handleGenerate} disabled={!form.category || generating}>
        {generating ? "Generating..." : "Generate"}
      </button>

      {preview && (
        <div style={{ marginTop: 24 }}>
          <p>{preview.items.length} question(s) generated. Review before inserting:</p>
          {preview.items.map((item) => (
            <div key={item.id} style={{ margin: "12px 0", padding: 12, borderRadius: 4, background: "#EFEAD9" }}>
              <p className="question-text">{item.question}</p>
            </div>
          ))}
          {preview.errors.length > 0 && (
            <UploadResult mode="generate" result={{ loaded: preview.items.length, failed: preview.errors.length, errors: preview.errors }} />
          )}
          <button className="btn" onClick={handleCommit} disabled={committing || preview.items.length === 0}>
            {committing ? "Inserting..." : `Insert ${preview.items.length} into DB`}
          </button>
        </div>
      )}

      <UploadResult result={commitResult} />
    </div>
  );
}

// Rolls the flat category/subcategory/topic/type/count list into a nested
// tree, client-side — no backend change needed since /admin/content-overview
// already returns full granularity. Nothing below category level renders
// until the user actually expands it, so this stays readable at any scale.
function buildTree(rows) {
  const tree = {};
  for (const row of rows) {
    const cat = row.category;
    const sub = row.subcategory || "(no subcategory)";
    const topic = row.topic || "(no topic)";

    tree[cat] ??= { total: 0, mcq: 0, qna: 0, subcategories: {} };
    tree[cat].total += row.count;
    tree[cat][row.type] += row.count;

    tree[cat].subcategories[sub] ??= { total: 0, mcq: 0, qna: 0, topics: {} };
    tree[cat].subcategories[sub].total += row.count;
    tree[cat].subcategories[sub][row.type] += row.count;

    tree[cat].subcategories[sub].topics[topic] ??= { mcq: 0, qna: 0, total: 0 };
    tree[cat].subcategories[sub].topics[topic][row.type] += row.count;
    tree[cat].subcategories[sub].topics[topic].total += row.count;
  }
  return tree;
}

function ContentOverviewTab() {
  const [rows, setRows] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [expandedSubcats, setExpandedSubcats] = useState(new Set());

  useEffect(() => {
    getContentOverview().then(setRows);
  }, []);

  if (rows === null) return <p style={{ marginTop: 16 }}>Loading...</p>;

  const tree = buildTree(rows);

  function toggleCategory(cat) {
    const next = new Set(expandedCategories);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    setExpandedCategories(next);
  }

  function toggleSubcat(key) {
    const next = new Set(expandedSubcats);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedSubcats(next);
  }

  return (
    <div style={{ marginTop: 16 }}>
      {Object.entries(tree).map(([cat, catData]) => (
        <div key={cat} style={{ marginBottom: 8 }}>
          <div
            onClick={() => toggleCategory(cat)}
            style={{ display: "flex", justifyContent: "space-between", padding: 10, background: "#EFEAD9", borderRadius: 4, cursor: "pointer" }}
          >
            <span>{expandedCategories.has(cat) ? "▾" : "▸"} <strong>{cat}</strong></span>
            <span style={{ color: "var(--ink-muted)" }}><strong>{catData.mcq}</strong> mcq, <strong>{catData.qna}</strong> qna</span>
          </div>

          {expandedCategories.has(cat) && (
            <div style={{ paddingLeft: 20, marginTop: 4 }}>
              {Object.entries(catData.subcategories).map(([sub, subData]) => {
                const subKey = `${cat}::${sub}`;
                return (
                  <div key={subKey} style={{ marginBottom: 4 }}>
                    <div
                      onClick={() => toggleSubcat(subKey)}
                      style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", cursor: "pointer" }}
                    >
                      <span>{expandedSubcats.has(subKey) ? "▾" : "▸"} {sub}</span>
                      <span style={{ color: "var(--ink-muted)" }}><strong>{subData.mcq}</strong> mcq, <strong>{subData.qna}</strong> qna</span>
                    </div>

                    {expandedSubcats.has(subKey) && (
                      <div style={{ paddingLeft: 20 }}>
                        {Object.entries(subData.topics).map(([topic, counts]) => (
                          <div key={topic} style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", color: "var(--ink-muted)", fontSize: "0.9rem" }}>
                            <span>{topic}</span>
                            <span><strong>{counts.mcq}</strong> mcq, <strong>{counts.qna}</strong> qna</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
