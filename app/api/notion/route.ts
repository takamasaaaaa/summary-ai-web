import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";

export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get("notion_session");
  if (!sessionCookie) {
    return NextResponse.json({ error: "Notionにログインしてください" }, { status: 401 });
  }

  let session: { access_token: string; database_id: string | null };
  try {
    session = JSON.parse(sessionCookie.value);
  } catch {
    return NextResponse.json({ error: "セッションが無効です" }, { status: 401 });
  }

  if (!session.database_id) {
    return NextResponse.json(
      { error: "Notionデータベースが見つかりません。再ログインしてデータベースを選択してください。" },
      { status: 400 }
    );
  }

  try {
    const { title, url, summary, date } = await request.json();

    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: session.database_id },
        properties: {
          Title: { title: [{ text: { content: title || "無題" } }] },
          URL: { url: url || null },
          Summary: { rich_text: [{ text: { content: (summary || "").slice(0, 2000) } }] },
          Date: { date: { start: date || new Date().toISOString().split("T")[0] } },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.message || "Notion API error" }, { status: response.status });
    }
    return NextResponse.json({ success: true, page: data });
  } catch (error) {
    console.error("Notion proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
