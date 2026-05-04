import { NextRequest, NextResponse } from "next/server";

const DATABASE_ID = "356b15492e4180f48c16f2c95be37013";

export async function POST(request: NextRequest) {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Notion API key not configured" }, { status: 500 });
  }

  try {
    const { title, url, summary, date } = await request.json();

    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties: {
          Title: { title: [{ text: { content: title || "無題" } }] },
          URL: { url: url || null },
          Summary: { rich_text: [{ text: { content: summary || "" } }] },
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
