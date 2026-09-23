import { useState } from "react";
import { login, signup } from "./api";

// Single form that toggles between login and signup — same fields,
// different API call and button label.
export default function LoginPage({ onSuccess, onExit }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const action = isSignup ? signup : login;
      await action(email, password);   // stores the token internally (see api.js)
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="pill-btn" onClick={onExit}>Home</button>
        <h2 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>
          {isSignup ? "Create account" : "Log in"}
        </h2>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field-group">
          <label className="field-label">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field-group">
          <label className="field-label">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {error && <p className="admin-error">{error}</p>}

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "..." : isSignup ? "Sign up" : "Log in"}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        <button className="btn-secondary" onClick={() => setIsSignup(!isSignup)}>
          {isSignup ? "Already have an account? Log in" : "New here? Sign up"}
        </button>
      </p>
    </div>
  );
}