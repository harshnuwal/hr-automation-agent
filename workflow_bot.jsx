import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are a Workflow Automation Bot that processes operational queries. For EVERY message, you must respond in valid JSON only, with this exact structure:

{
  "intent": "one of: PROCESS_REQUEST | DATA_QUERY | STATUS_CHECK | ESCALATE | FALLBACK",
  "entities": { "key": "value" },
  "confidence": 0.0 to 1.0,
  "response": "your friendly response to the user",
  "action": "one of: AUTO_RESOLVED | QUEUED | ESCALATED | INFO_PROVIDED",
  "automation_triggered": true or false
}

Intent rules:
- PROCESS_REQUEST: user wants to do/submit/process something
- DATA_QUERY: user wants info or data
- STATUS_CHECK: user wants to know status of something
- ESCALATE: complex issue needing human
- FALLBACK: unclear or out-of-scope

Entity examples: {"department":"Finance", "ticket_id":"T-1234", "employee":"John", "date":"today"}

Keep response friendly and under 2 sentences. No markdown in response field.`;

const SAMPLE_QUERIES = [
  "Process invoice #INV-2024 for Finance team",
  "What is the status of ticket T-1089?",
  "I need the Q3 sales report for Mumbai region",
  "Submit leave request for 3 days starting Monday",
  "Escalate payroll issue for employee ID 4521",
];

const INTENT_COLORS = {
  PROCESS_REQUEST: { bg: "#E1F5EE", text: "#0F6E56", label: "Process Request" },
  DATA_QUERY: { bg: "#E6F1FB", text: "#185FA5", label: "Data Query" },
  STATUS_CHECK: { bg: "#FAEEDA", text: "#854F0B", label: "Status Check" },
  ESCALATE: { bg: "#FCEBEB", text: "#A32D2D", label: "Escalate" },
  FALLBACK: { bg: "#F1EFE8", text: "#444441", label: "Fallback" },
};

const ACTION_ICONS = {
  AUTO_RESOLVED: "✅",
  QUEUED: "🔄",
  ESCALATED: "⚠️",
  INFO_PROVIDED: "ℹ️",
};

export default function WorkflowBot() {
  const [logs, setLogs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ total: 0, auto: 0, escalated: 0, queued: 0 });
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, loading]);

  async function processQuery(text) {
    if (!text.trim() || loading) return;
    setInput("");
    setLoading(true);
    const userMsg = { role: "user", content: text };
    const newHistory = [...history, userMsg];

    const logEntry = { query: text, timestamp: new Date().toLocaleTimeString(), result: null };
    setLogs((prev) => [...prev, logEntry]);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: newHistory,
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      } catch {
        parsed = { intent: "FALLBACK", entities: {}, confidence: 0.5, response: raw, action: "INFO_PROVIDED", automation_triggered: false };
      }

      const assistantMsg = { role: "assistant", content: JSON.stringify(parsed) };
      setHistory([...newHistory, assistantMsg]);

      setLogs((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], result: parsed };
        return updated;
      });

      setStats((prev) => ({
        total: prev.total + 1,
        auto: prev.auto + (parsed.action === "AUTO_RESOLVED" ? 1 : 0),
        escalated: prev.escalated + (parsed.action === "ESCALATED" ? 1 : 0),
        queued: prev.queued + (parsed.action === "QUEUED" ? 1 : 0),
      }));
    } catch {
      setLogs((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], result: { intent: "FALLBACK", response: "Error processing query.", action: "ESCALATED", automation_triggered: false, confidence: 0, entities: {} } };
        return updated;
      });
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter") { e.preventDefault(); processQuery(input); }
  }

  return (
    <div style={{ fontFamily: "var(--font-sans)", maxWidth: 720, margin: "0 auto", padding: "1rem 0" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "0.5px solid var(--color-border-tertiary)" }}>⚡</div>
        <div>
          <div style={{ fontWeight: 500, fontSize: 15, color: "var(--color-text-primary)" }}>Workflow Automation Bot</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Intent Recognition · Entity Extraction · Fallback Handling · Auto-Resolution</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Total Queries", value: stats.total, color: "var(--color-text-primary)" },
          { label: "Auto Resolved", value: stats.auto, color: "#1D9E75" },
          { label: "Escalated", value: stats.escalated, color: "#A32D2D" },
          { label: "Queued", value: stats.queued, color: "#854F0B" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sample Queries */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {SAMPLE_QUERIES.map((q) => (
          <button key={q} onClick={() => processQuery(q)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 16, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", cursor: "pointer" }}>
            {q}
          </button>
        ))}
      </div>

      {/* Log Window */}
      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", background: "var(--color-background-primary)", height: 340, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {logs.length === 0 && (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
            Submit a query to see intent classification, entity extraction, and automation results
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "10px 12px" }}>
            {/* Query */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{log.timestamp}</span>
              <span style={{ fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>"{log.query}"</span>
            </div>

            {log.result ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Intent + Action row */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: INTENT_COLORS[log.result.intent]?.bg || "#F1EFE8", color: INTENT_COLORS[log.result.intent]?.text || "#444441", fontWeight: 500 }}>
                    {INTENT_COLORS[log.result.intent]?.label || log.result.intent}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    {ACTION_ICONS[log.result.action]} {log.result.action?.replace(/_/g, " ")}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                    Confidence: {Math.round((log.result.confidence || 0) * 100)}%
                  </span>
                  {log.result.automation_triggered && (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#E1F5EE", color: "#0F6E56" }}>⚡ Automation Triggered</span>
                  )}
                </div>

                {/* Entities */}
                {log.result.entities && Object.keys(log.result.entities).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Object.entries(log.result.entities).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }}>
                        <span style={{ color: "var(--color-text-tertiary)" }}>{k}:</span> {v}
                      </span>
                    ))}
                  </div>
                )}

                {/* Response */}
                <div style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5, padding: "6px 10px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)" }}>
                  {log.result.response}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Processing...</div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter a workflow query to process..."
          style={{ flex: 1, fontSize: 14, padding: "10px 14px", borderRadius: "var(--border-radius-md)" }}
          disabled={loading}
        />
        <button
          onClick={() => processQuery(input)}
          disabled={loading || !input.trim()}
          style={{ padding: "10px 18px", borderRadius: "var(--border-radius-md)", fontSize: 14, fontWeight: 500, cursor: loading || !input.trim() ? "not-allowed" : "pointer" }}
        >
          {loading ? "Processing..." : "Run ↗"}
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center" }}>
        Built by Harsh Nuwal · Intent Recognition · Entity Extraction · Fallback Handling · Power Automate Concepts
      </div>
    </div>
  );
}
