import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notionApiKey, title, url, summary, date } = body;

    if (!notionApiKey) {
      return NextResponse.json({ error: "Notion API key is required" }, { status: 400 });
    }

    const DATABASE_ID = "356b15492e4180f48c16f2c95be37013";

    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties: {
          Title: {
            title: [{ text: { content: title || "無題" } }],
          },
          URL: {
            url: url || null,
          },
          Summary: {
            rich_text: [{ text: { content: summary || "" } }],
          },
          Date: {
            date: { start: date || new Date().toISOString().split("T")[0] },
          },
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
