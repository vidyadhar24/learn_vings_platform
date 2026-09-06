import ReactMarkdown from "react-markdown";

// One shared renderer so both the Q&A "answer" field and the "Explain with
// LLM" output look consistent — real bullet lists, real code blocks, instead
// of raw "- " and "```" characters sitting in a plain paragraph.
export default function MarkdownText({ children }) {
  return (
    <div className="question-text">
      <ReactMarkdown
        components={{
          // <pre> only ever wraps real fenced (```) code blocks — inline
          // `code` never appears inside one. Styling based on that structural
          // fact is reliable across react-markdown versions, unlike the
          // "inline" prop some versions used to pass to the code renderer.
          pre: ({ children }) => (
            <pre style={{ background: "#EFEAD9", padding: 12, overflowX: "auto", borderRadius: 4 }}>
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code style={{ fontFamily: "monospace", fontSize: "0.95em", background: "#e4dfc8", padding: "1px 5px", borderRadius: 3 }}>
              {children}
            </code>
          ),
          ul: ({ children }) => <ul style={{ paddingLeft: 20 }}>{children}</ul>,
          p: ({ children }) => <p style={{ margin: "8px 0" }}>{children}</p>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
