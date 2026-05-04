"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function formatText(text: string) {
  return text.split("\n").map((line, i, arr) => {
    const parts = line.split(/(\*[^*]+\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
            <strong key={j}>{part.slice(1, -1)}</strong>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

const SAMPLE_URLS = [
  "techcrunch.com", "wired.com", "reuters.com",
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [pageContent, setPageContent] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [notionLoading, setNotionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notionStatus, setNotionStatus] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function reset() {
    setSummary("");
    setArticleTitle("");
    setPageContent("");
    setMessages([]);
    setError("");
    setNotionStatus("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function fetchAndSummarize() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setSummary("");
    setArticleTitle("");
    setMessages([]);
    setNotionStatus("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "要約に失敗しました");
      setSummary(data.summary);
      setPageContent(data.pageContent);
      const m = data.summary.match(/^\*(.+?)\*/);
      if (m) setArticleTitle(m[1]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || !pageContent) return;
    const userMsg: Message = { role: "user", content: chatInput.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setChatInput("");
    setChatLoading(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, url, pageContent, summary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "チャットエラーが発生しました");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "チャットエラーが発生しました");
    } finally {
      setChatLoading(false);
    }
  }

  async function saveToNotion() {
    if (!summary) return;
    setNotionLoading(true);
    setNotionStatus("");
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: articleTitle || url,
          url,
          summary,
          date: new Date().toISOString().split("T")[0],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Notion保存エラー");
      setNotionStatus("保存しました ✓");
    } catch (e: unknown) {
      setNotionStatus(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setNotionLoading(false);
    }
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    action: () => void
  ) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      action();
    }
  }

  /* ─── HERO (no summary) ─── */
  if (!summary && !loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          background: "linear-gradient(160deg, #fafafa 0%, #f5f3ff 100%)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
            }}
          >
            <span style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>S</span>
          </div>
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", color: "#111" }}>
            SummaryAI
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 46px)",
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.2,
            letterSpacing: "-1px",
            color: "#111",
            marginBottom: 14,
            maxWidth: 600,
          }}
        >
          URLを貼るだけで、<br />
          <span className="gradient-text">記事を日本語で要約</span>します
        </h1>

        <p
          style={{
            fontSize: 16,
            color: "#6b7280",
            textAlign: "center",
            marginBottom: 36,
            maxWidth: 420,
            lineHeight: 1.6,
          }}
        >
          VC・投資家・スタートアップ関係者向けに、
          海外記事を即座に日本語で要約・翻訳します。
        </p>

        {/* URL Input card */}
        <div
          className="card"
          style={{ width: "100%", maxWidth: 600, padding: "20px 20px 16px", marginBottom: 12 }}
        >
          <div
            className="hero-input-row"
            style={{ display: "flex", gap: 10, alignItems: "center" }}
          >
            <input
              ref={inputRef}
              type="url"
              className="hero-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, fetchAndSummarize)}
              placeholder="https://techcrunch.com/..."
              autoFocus
            />
            <button
              className="btn-primary"
              onClick={fetchAndSummarize}
              disabled={!url.trim()}
              style={{ padding: "12px 24px", fontSize: 15, borderRadius: 10 }}
            >
              要約する
            </button>
          </div>
          <p style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
            例：{SAMPLE_URLS.join(" / ")} などのURL
          </p>
        </div>

        {error && <div className="error-banner" style={{ maxWidth: 600, width: "100%", marginTop: 8 }}>{error}</div>}

        {/* Features */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 40,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            { icon: "⚡", label: "即時要約" },
            { icon: "💬", label: "チャットで深掘り" },
            { icon: "📋", label: "Notionに保存" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 20,
                fontSize: 13,
                color: "#374151",
                fontWeight: 500,
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </main>
    );
  }

  /* ─── LOADING ─── */
  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "3px solid #e5e7eb",
            borderTopColor: "#6366f1",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ fontSize: 15, color: "#6b7280", fontWeight: 500 }}>
          ページを取得して要約中...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  /* ─── RESULTS ─── */
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      {/* Top bar */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>S</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>SummaryAI</span>
        </div>
        <button className="btn-secondary" onClick={reset} style={{ padding: "7px 16px", fontSize: 13 }}>
          ＋ 新しい記事を要約する
        </button>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 60px" }}>
        {/* URL pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            borderRadius: 20,
            padding: "5px 12px",
            fontSize: 12,
            color: "#6b7280",
            marginBottom: 20,
            maxWidth: "100%",
            overflow: "hidden",
          }}
        >
          <span style={{ flexShrink: 0 }}>🔗</span>
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {url}
          </span>
        </div>

        {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Summary card */}
        <div className="card" style={{ padding: "24px", marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <span className="section-label">AI 要約</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {notionStatus && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: notionStatus.includes("✓") ? "#16a34a" : "#dc2626",
                  }}
                >
                  {notionStatus}
                </span>
              )}
              <button
                className="btn-notion"
                onClick={saveToNotion}
                disabled={notionLoading}
              >
                {notionLoading ? "保存中..." : "📋 Notionに保存"}
              </button>
            </div>
          </div>
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.85,
              color: "#1f2937",
              whiteSpace: "pre-wrap",
            }}
          >
            {formatText(summary)}
          </div>
        </div>

        {/* Chat card */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 15 }}>💬</span>
            <span className="section-label">チャット</span>
            <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 4 }}>
              質問・全文翻訳など
            </span>
          </div>
          <div className="divider" />

          {/* Messages */}
          {messages.length > 0 && (
            <div
              style={{
                maxHeight: 440,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    className={msg.role === "user" ? "bubble-user" : "bubble-ai"}
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {msg.role === "assistant" ? formatText(msg.content) : msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div className="bubble-ai" style={{ color: "#9ca3af" }}>考え中...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Quick chips */}
          {messages.length === 0 && (
            <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                "全文翻訳してください",
                "著者と媒体を教えてください",
                "投資家視点でのポイントは？",
              ].map((s) => (
                <button key={s} className="chip" onClick={() => setChatInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="divider" />

          {/* Input row */}
          <div style={{ padding: "12px 16px", display: "flex", gap: 8 }}>
            <input
              type="text"
              className="input-field"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, sendChat)}
              placeholder="質問を入力... (Enter で送信)"
              disabled={chatLoading}
            />
            <button
              className="btn-primary"
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              style={{ padding: "10px 18px" }}
            >
              送信
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
