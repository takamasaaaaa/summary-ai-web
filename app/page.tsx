"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface NotionAuth {
  loggedIn: boolean;
  workspace_name?: string;
  has_database?: boolean;
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
  const [notionAuth, setNotionAuth] = useState<NotionAuth | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = chatInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [chatInput]);

  // Fetch Notion login status
  useEffect(() => {
    fetch("/api/notion/me")
      .then((r) => r.json())
      .then(setNotionAuth)
      .catch(() => setNotionAuth({ loggedIn: false }));
  }, []);

  // Handle OAuth return: check for error param or pending URL in sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("notion_error")) {
      setError("Notionログインに失敗しました。もう一度お試しください。");
      window.history.replaceState({}, "", "/");
    }

    const pendingUrl = sessionStorage.getItem("notion_pending_url");
    if (pendingUrl) {
      sessionStorage.removeItem("notion_pending_url");
      setUrl(pendingUrl);
      startSummarize(pendingUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setSummary("");
    setArticleTitle("");
    setPageContent("");
    setMessages([]);
    setError("");
    setNotionStatus("");
    setUrl("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function startSummarize(targetUrl: string) {
    const urlToFetch = targetUrl.trim();
    if (!urlToFetch) return;
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
        body: JSON.stringify({ url: urlToFetch }),
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

  function fetchAndSummarize() {
    startSummarize(url);
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

    if (!notionAuth?.loggedIn) {
      sessionStorage.setItem("notion_pending_url", url);
      window.location.href = "/api/notion/auth";
      return;
    }

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

  async function handleNotionLogout() {
    await fetch("/api/notion/logout", { method: "POST" });
    setNotionAuth({ loggedIn: false });
    setNotionStatus("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, action: () => void) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      action();
    }
  }

  /* ─── HERO ─── */
  if (!summary && !loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>
        {/* Nav */}
        <nav
          style={{
            padding: "0 40px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>S</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.3px", color: "#0a0a0a" }}>
              SummaryAI
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#737373", fontWeight: 500 }}>
            <span>⚡ 即時要約</span>
            <span style={{ margin: "0 4px", color: "#e5e5e5" }}>·</span>
            <span>💬 チャット</span>
            <span style={{ margin: "0 4px", color: "#e5e5e5" }}>·</span>
            <span>📋 Notion保存</span>
          </div>
        </nav>

        {/* Hero body */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 24px 80px",
          }}
        >
          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(36px, 6.5vw, 72px)",
              fontWeight: 900,
              textAlign: "center",
              lineHeight: 1.08,
              letterSpacing: "-2.5px",
              color: "#0a0a0a",
              marginBottom: 20,
              maxWidth: 720,
            }}
          >
            URLを貼るだけで、
            <br />
            <span className="gradient-text">記事を日本語で要約</span>
          </h1>

          <p
            style={{
              fontSize: 17,
              color: "#737373",
              textAlign: "center",
              marginBottom: 48,
              maxWidth: 440,
              lineHeight: 1.65,
              fontWeight: 400,
            }}
          >
            VC・投資家・スタートアップ関係者向けに、
            海外記事を即座に日本語で要約・翻訳します。
          </p>

          {/* Input */}
          <div style={{ width: "100%", maxWidth: 580 }}>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                background: "#fff",
                border: "2px solid #e5e5e5",
                borderRadius: 16,
                padding: "8px 8px 8px 18px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            >
              <span style={{ color: "#a3a3a3", fontSize: 16, flexShrink: 0 }}>🔗</span>
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, fetchAndSummarize)}
                placeholder="https://techcrunch.com/..."
                autoFocus
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: 15,
                  color: "#0a0a0a",
                  background: "transparent",
                  fontFamily: "inherit",
                  minWidth: 0,
                }}
              />
              <button
                className="btn-primary"
                onClick={fetchAndSummarize}
                disabled={!url.trim()}
                style={{ borderRadius: 10, padding: "10px 20px", fontSize: 14, flexShrink: 0 }}
              >
                要約する →
              </button>
            </div>
            <p style={{ marginTop: 12, fontSize: 12, color: "#a3a3a3", textAlign: "center" }}>
              例：techcrunch.com / wired.com / reuters.com などの記事URL
            </p>
          </div>

          {error && (
            <div className="error-banner" style={{ maxWidth: 580, width: "100%", marginTop: 16 }}>
              {error}
            </div>
          )}

          {/* Feature badges */}
          <div style={{ display: "flex", gap: 12, marginTop: 52, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { icon: "⚡", label: "Jina AIでページ取得" },
              { icon: "🤖", label: "Claude AIで日本語要約" },
              { icon: "💬", label: "そのままチャットで深掘り" },
              { icon: "📋", label: "Notionにワンクリック保存" },
            ].map(({ icon, label }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  background: "#fafafa",
                  border: "1px solid #e5e5e5",
                  borderRadius: 100,
                  fontSize: 12,
                  color: "#525252",
                  fontWeight: 500,
                }}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </main>
      </div>
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
          background: "#fff",
          gap: 20,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "3px solid #e5e5e5",
            borderTopColor: "#6366f1",
            animation: "spin 0.75s linear infinite",
          }}
        />
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#0a0a0a", letterSpacing: "-0.3px" }}>
            要約中...
          </p>
          <p style={{ fontSize: 13, color: "#a3a3a3", marginTop: 4 }}>
            ページを取得してAIが解析しています
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  /* ─── RESULTS ─── */
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      {/* Sticky header */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          padding: "0 32px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Logo — clickable, returns to home */}
        <div
          onClick={reset}
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>S</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.3px", color: "#0a0a0a" }}>
            SummaryAI
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Notion auth status */}
          {notionAuth?.loggedIn ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#737373" }}>
                Notion: <strong style={{ color: "#0a0a0a" }}>{notionAuth.workspace_name}</strong>
              </span>
              <button
                onClick={handleNotionLogout}
                style={{
                  fontSize: 11,
                  color: "#a3a3a3",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                ログアウト
              </button>
            </div>
          ) : (
            <a
              href="/api/notion/auth"
              style={{
                fontSize: 12,
                color: "#6366f1",
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid #e0e0ff",
                borderRadius: 6,
                padding: "4px 10px",
                background: "#f5f5ff",
              }}
            >
              Notionでログイン
            </a>
          )}

          <button className="btn-secondary" onClick={reset} style={{ fontSize: 13, padding: "7px 16px" }}>
            ＋ 新しい記事を要約する
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 740, margin: "0 auto", padding: "32px 20px 80px" }}>
        {/* Article title */}
        {articleTitle && (
          <h2
            style={{
              fontSize: "clamp(20px, 3vw, 28px)",
              fontWeight: 800,
              letterSpacing: "-0.7px",
              color: "#0a0a0a",
              lineHeight: 1.25,
              marginBottom: 8,
            }}
          >
            {articleTitle}
          </h2>
        )}

        {/* URL pill */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "#f5f5f5",
            border: "1px solid #e5e5e5",
            borderRadius: 100,
            padding: "4px 12px",
            fontSize: 12,
            color: "#737373",
            marginBottom: 28,
            maxWidth: "100%",
            overflow: "hidden",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
        >
          <span style={{ flexShrink: 0 }}>↗</span>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {url}
          </span>
        </a>

        {error && <div className="error-banner" style={{ marginBottom: 20 }}>{error}</div>}

        {/* Summary card */}
        <div className="card" style={{ padding: "28px 32px", marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <span className="section-label">AI 要約</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {notionStatus && (
                <span style={{ fontSize: 12, fontWeight: 600, color: notionStatus.includes("✓") ? "#16a34a" : "#e11d48" }}>
                  {notionStatus}
                </span>
              )}
              <button className="btn-notion" onClick={saveToNotion} disabled={notionLoading}>
                {notionLoading
                  ? "保存中..."
                  : notionAuth?.loggedIn
                  ? "📋 Notionに保存"
                  : "📋 Notionでログインして保存"}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.9, color: "#1a1a1a", whiteSpace: "pre-wrap" }}>
            {formatText(summary)}
          </div>
        </div>

        {/* Chat card */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="section-label">チャット</span>
            <span style={{ fontSize: 12, color: "#a3a3a3" }}>質問・全文翻訳など</span>
          </div>
          <div className="divider" />

          {messages.length > 0 && (
            <div
              style={{
                maxHeight: 480,
                overflowY: "auto",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div className={msg.role === "user" ? "bubble-user" : "bubble-ai"} style={{ whiteSpace: "pre-wrap" }}>
                    {msg.role === "assistant" ? formatText(msg.content) : msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div className="bubble-ai" style={{ color: "#a3a3a3" }}>考え中...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {messages.length === 0 && (
            <div style={{ padding: "14px 24px", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["全文翻訳してください", "著者と媒体を教えてください", "投資家視点でのポイントは？"].map((s) => (
                <button key={s} className="chip" onClick={() => setChatInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="divider" />

          <div style={{ padding: "14px 16px", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={chatInputRef}
              className="input-field"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendChat();
                }
              }}
              placeholder="質問を入力... (Enter で送信 / Shift+Enter で改行)"
              disabled={chatLoading}
              rows={1}
              style={{ resize: "none", overflow: "hidden", lineHeight: "1.5" }}
            />
            <button
              className="btn-primary"
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              style={{ padding: "10px 20px", flexShrink: 0 }}
            >
              送信
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
