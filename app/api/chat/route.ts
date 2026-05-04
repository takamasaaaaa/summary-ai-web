import { NextRequest, NextResponse } from "next/server";

const CHAT_SYSTEM_PROMPT = `あなたはプロの翻訳者兼リサーチアシスタントです。VC・投資家・スタートアップ関係者向けに日本語で回答してください。
- 「全文翻訳」を求められた場合：元記事を漏れなく自然な日本語で全文翻訳する
- 質問された場合：会話履歴と記事内容を踏まえて正確に回答する
- Markdownは使用禁止。太字は*テキスト*、箇条書きは•を使用`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
  }

  try {
    const { messages, url, pageContent, summary } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const contextualMessages = messages.map((m: { role: string; content: string }) => ({
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
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
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
    return NextResponse.json({ reply: data.content[0].text });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "エラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
