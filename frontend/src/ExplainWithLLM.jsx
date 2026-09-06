import { useState } from "react";
import { explainQuestion } from "./api";
import MarkdownText from "./MarkdownText";

// One component so Quiz results, Prepare, and Browse all get identical
// behavior instead of three separate copies of the same state logic.
export default function ExplainWithLLM({ questionId }) {
  const [open, setOpen] = useState(false);       // instruction box visible?
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState(null);

  function handleGetExplanation() {
    setLoading(true);
    explainQuestion(questionId, instruction)
      .then((res) => setExplanation(res.explanation))
      .finally(() => setLoading(false));
  }

  if (!open) {
    return (
      <button className="pill-btn" onClick={() => setOpen(true)}>
        Explain with LLM
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <input
        className="pill-input"
        placeholder="Optional: 'explain with examples'..."
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        style={{ width: 220 }}
      />
      <button className="pill-btn" onClick={handleGetExplanation} disabled={loading}>
        {loading ? "Thinking..." : "Get explanation"}
      </button>

      {explanation && (
        <div style={{ marginTop: 12, padding: 12, background: "#EFEAD9", borderRadius: 4 }}>
          <MarkdownText>{explanation}</MarkdownText>
        </div>
      )}
    </div>
  );
}
