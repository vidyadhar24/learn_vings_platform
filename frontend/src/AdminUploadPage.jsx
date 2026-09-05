import { useState } from "react";
import { uploadJsonl } from "./api";

export default function AdminUploadPage({ onExit }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // { loaded, failed, errors }

  function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    uploadJsonl(file)
      .then(setResult)
      .finally(() => setUploading(false));
  }

  return (
    <div className="card-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="pill-btn" onClick={onExit}>Home</button>
        <h2 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>Load Data</h2>
      </div>

      <p style={{ color: "var(--ink-muted)", marginTop: 16 }}>
        Upload a .jsonl file (MCQ or Q&amp;A format) to load it into the database.
      </p>

      <input
        type="file"
        accept=".jsonl"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 24 }}>
          <p>
            <strong>{result.loaded}</strong> loaded, <strong>{result.failed}</strong> failed.
          </p>

          {result.errors.length > 0 && (
            <div>
              {result.errors.map((err) => (
                <div
                  key={err.line}
                  style={{ margin: "8px 0", padding: 10, borderRadius: 4, background: "#f3ded6" }}
                >
                  <span className="incorrect">Line {err.line}:</span> {err.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
