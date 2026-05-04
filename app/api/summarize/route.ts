import { NextRequest, NextResponse } from "next/server";

const SUMMARY_SYSTEM_PROMPT = `あなたはプロの翻訳者兼編集者です。以下のWebページを読み、VC・投資家・スタートアップ関係者向けに日本語で要約してください。

出力フォーマットは以下を厳守：
*[記事タイトル]*

[4〜5行の散文サマリー]

*ポイント*
- [ポイント1]
- [ポイント2]
...

Markdownは使用禁止。太字は*テキスト*、箇条書きは・を使用。`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
  }

  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
    });
    if (!jinaRes.ok) throw new Error("ページの取得に失敗しました");
    const content = await jinaRes.text();

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
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
    return NextResponse.json({
      summary: data.content[0].text,
      pageContent: content,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "エラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
