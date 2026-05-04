"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUMMARY_SYSTEM_PROMPT = `あなたはプロの翻訳者兼編集者です。以下のWebページを読み、VC・投資家・スタートアップ関係者向けに日本語で要約してください。

出力フォーマットは以下を厳守：
*[記事タイトル]*

[4〜5行の散文サマリー]

*ポイント*
- [ポイント1]
- [ポイント2]
...

Markdownは使用禁止。太字は*テキスト*、箇条書きは・を使用。`;

const CHAT_SYSTEM_PROMPT = `あなたはプロの翻訳者兼リサーチアシスタントです。VC・投資家・スタートアップ関係者向けに日本語で回答してください。
- 「全文翻訳」を求められた場合：元記事を漏れなく自然な日本語で全文翻訳する
- 質問された場合：会話履歴と記事内容を踏まえて正確に回答する
- Markdownは使用禁止。太字は*テキスト*、箇条書きは•を使用`;

function formatText(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*[^*]+\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) => {
          if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return <strong key={j}>{part.slice(1, -1)}</strong>;
          }
          return <span key={j}>{part}</span>;
        })}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    );
  });
}

export default function Home() {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [notionKey, setNotionKey] = useState("");
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
  const [showApiKeys, setShowApiKeys] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function fetchAndSummarize() {
    if (!url.trim()) return;
    if (!anthropicKey.trim()) {
      setError("Anthropic APIキーを入力してください");
      return;
    }

    setLoading(true);
    setError("");
    setSummary("");
    setArticleTitle("");
    setMessages([]);
    setNotionStatus("");

    try {
      const jinaUrl = `https://r.jina.ai/${url.trim()}`;
      const jinaRes = await fetch(jinaUrl, {
        headers: { Accept: "text/plain" },
      });
      if (!jinaRes.ok) throw new Error("ページの取得に失敗しました");
      const content = await jinaRes.text();
      setPageContent(content);

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "anthropic-dangerous-allow-browser": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: SUMMARY_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `以下のWebページ内容を要約してください:\n\nURL: ${url}\n\n${content}`,
            },
          ],
        }),
      });

      if (!anthropicRes.ok) {
        const errData = await anthropicRes.json();
        throw new Error(errData.error?.message || "Anthropic APIエラー");
      }

      const data = await anthropicRes.json();
      const summaryText = data.content[0].text;
      setSummary(summaryText);

      const titleMatch = summaryText.match(/^\*(.+?)\*/);
      if (titleMatch) setArticleTitle(titleMatch[1]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || !pageContent) return;
    if (!anthropicKey.trim()) {
      setError("Anthropic APIキーを入力してください");
      return;
    }

    const userMessage: Message = { role: "user", content: chatInput.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    setError("");

    try {
      const contextualMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const firstUserIdx = contextualMessages.findIndex((m) => m.role === "user");
      if (firstUserIdx !== -1) {
        contextualMessages[firstUserIdx] = {
          role: "user",
          content: `記事URL: ${url}\n\n記事内容:\n${pageContent}\n\n要約:\n${summary}\n\n質問: ${contextualMessages[firstUserIdx].content}`,
        };
      }

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "anthropic-dangerous-allow-browser": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: CHAT_SYSTEM_PROMPT,
          messages: contextualMessages,
        }),
      });

      if (!anthropicRes.ok) {
        const errData = await anthropicRes.json();
        throw new Error(errData.error?.message || "Anthropic APIエラー");
      }

      const data = await anthropicRes.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.content[0].text,
      };
      setMessages([...newMessages, assistantMessage]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "チャットエラーが発生しました");
    } finally {
      setChatLoading(false);
    }
  }

  async function saveToNotion() {
    if (!summary || !notionKey.trim()) {
      setNotionStatus("Notion APIキーと要約が必要です");
      return;
    }

    setNotionLoading(true);
    setNotionStatus("");

    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notionApiKey: notionKey,
          title: articleTitle || url,
          url: url,
          summary: summary,
          date: new Date().toISOString().split("T")[0],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Notion保存エラー");
      setNotionStatus("Notionに保存しました！");
    } catch (e: unknown) {
      setNotionStatus(e instanceof Error ? e.message : "Notion保存に失敗しました");
    } finally {
      setNotionLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, action: () => void) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      action();
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      {/* Header */}
      <header
        style={{
          background: "#161b2e",
          borderBottom: "1px solid #2a3050",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "8px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            ✦
          </div>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "#e2e8f0" }}>SummaryAI</span>
        </div>
        <button
          onClick={() => setShowApiKeys(!showApiKeys)}
          style={{
            background: "#1e2a45",
            border: "1px solid #2a3a5e",
            borderRadius: "6px",
            color: "#94a3b8",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          {showApiKeys ? "APIキーを隠す" : "APIキーを表示"}
        </button>
      </header>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "24px 16px" }}>
        {/* API Keys Section */}
        {showApiKeys && (
          <div
            style={{
              background: "#161b2e",
              border: "1px solid #2a3050",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "20px",
            }}
          >
            <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              APIキー設定
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  style={{
                    width: "100%",
                    background: "#0f1117",
                    border: "1px solid #2a3050",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Notion API Key
                </label>
                <input
                  type="password"
                  value={notionKey}
                  onChange={(e) => setNotionKey(e.target.value)}
                  placeholder="secret_..."
                  style={{
                    width: "100%",
                    background: "#0f1117",
                    border: "1px solid #2a3050",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* URL Input */}
        <div
          style={{
            background: "#161b2e",
            border: "1px solid #2a3050",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "8px" }}>
            要約するURLを入力
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, fetchAndSummarize)}
              placeholder="https://example.com/article"
              style={{
                flex: 1,
                background: "#0f1117",
                border: "1px solid #2a3050",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#e2e8f0",
                fontSize: "14px",
                outline: "none",
              }}
            />
            <button
              onClick={fetchAndSummarize}
              disabled={loading || !url.trim()}
              style={{
                background: loading || !url.trim() ? "#1e2a45" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: "8px",
                padding: "10px 24px",
                color: loading || !url.trim() ? "#4a5568" : "#fff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: loading || !url.trim() ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              {loading ? "処理中..." : "要約する"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#2d1b1b",
              border: "1px solid #5c2626",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "#fc8181",
              fontSize: "14px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div
            style={{
              background: "#161b2e",
              border: "1px solid #2a3050",
              borderRadius: "12px",
              padding: "40px",
              textAlign: "center",
              marginBottom: "20px",
            }}
          >
            <div style={{ color: "#6366f1", fontSize: "24px", marginBottom: "12px" }}>⟳</div>
            <p style={{ color: "#94a3b8", fontSize: "14px" }}>ページを取得して要約中...</p>
          </div>
        )}

        {/* Summary Section */}
        {summary && !loading && (
          <div
            style={{
              background: "#161b2e",
              border: "1px solid #2a3050",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#6366f1", fontSize: "16px" }}>✦</span>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  AI要約
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {notionStatus && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: notionStatus.includes("保存しました") ? "#68d391" : "#fc8181",
                    }}
                  >
                    {notionStatus}
                  </span>
                )}
                <button
                  onClick={saveToNotion}
                  disabled={notionLoading || !notionKey.trim()}
                  title={!notionKey.trim() ? "Notion APIキーを入力してください" : ""}
                  style={{
                    background: notionLoading || !notionKey.trim() ? "#1e2a45" : "#1e3a5f",
                    border: "1px solid " + (notionLoading || !notionKey.trim() ? "#2a3a5e" : "#2d5a8e"),
                    borderRadius: "6px",
                    padding: "6px 14px",
                    color: notionLoading || !notionKey.trim() ? "#4a5568" : "#90cdf4",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: notionLoading || !notionKey.trim() ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {notionLoading ? "保存中..." : "Notionに保存"}
                </button>
              </div>
            </div>
            <div
              style={{
                color: "#e2e8f0",
                fontSize: "15px",
                lineHeight: "1.8",
                whiteSpace: "pre-wrap",
              }}
            >
              {formatText(summary)}
            </div>
          </div>
        )}

        {/* Chat Section */}
        {summary && !loading && (
          <div
            style={{
              background: "#161b2e",
              border: "1px solid #2a3050",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #2a3050",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ color: "#6366f1", fontSize: "16px" }}>💬</span>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                チャット
              </span>
              <span style={{ fontSize: "12px", color: "#4a5568", marginLeft: "8px" }}>
                質問・全文翻訳など
              </span>
            </div>

            {/* Messages */}
            {messages.length > 0 && (
              <div
                ref={chatContainerRef}
                style={{
                  maxHeight: "400px",
                  overflowY: "auto",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "80%",
                        background: msg.role === "user" ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : "#1e2a45",
                        borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        padding: "12px 16px",
                        color: "#e2e8f0",
                        fontSize: "14px",
                        lineHeight: "1.7",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.role === "assistant" ? formatText(msg.content) : msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div
                      style={{
                        background: "#1e2a45",
                        borderRadius: "16px 16px 16px 4px",
                        padding: "12px 16px",
                        color: "#94a3b8",
                        fontSize: "14px",
                      }}
                    >
                      考え中...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Quick Actions */}
            {messages.length === 0 && (
              <div style={{ padding: "12px 16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["全文翻訳してください", "この記事の著者は誰ですか？", "投資家視点でのポイントを教えてください"].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setChatInput(suggestion);
                      }}
                      style={{
                        background: "#1e2a45",
                        border: "1px solid #2a3a5e",
                        borderRadius: "20px",
                        padding: "6px 14px",
                        color: "#94a3b8",
                        fontSize: "12px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {suggestion}
                    </button>
                  )
                )}
              </div>
            )}

            {/* Chat Input */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: messages.length > 0 ? "1px solid #2a3050" : "none",
                display: "flex",
                gap: "8px",
              }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, sendChat)}
                placeholder="質問を入力... (Enter で送信)"
                disabled={chatLoading}
                style={{
                  flex: 1,
                  background: "#0f1117",
                  border: "1px solid #2a3050",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#e2e8f0",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  background: chatLoading || !chatInput.trim() ? "#1e2a45" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  color: chatLoading || !chatInput.trim() ? "#4a5568" : "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                送信
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!summary && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#4a5568",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✦</div>
            <p style={{ fontSize: "16px", color: "#64748b" }}>URLを入力して要約を開始してください</p>
            <p style={{ fontSize: "13px", color: "#4a5568", marginTop: "8px" }}>
              Jina AIでページ内容を取得し、Claude AIで日本語要約を生成します
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
