import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  const reqUrl = new URL(req.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${reqUrl.protocol}//${reqUrl.host}`;
  const redirectUri = `${baseUrl}/api/notion/callback`;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}?notion_error=cancelled`);
  }

  const clientId = process.env.NOTION_CLIENT_ID!;
  const clientSecret = process.env.NOTION_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  // Exchange authorization code for access token
  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}?notion_error=auth_failed`);
  }

  const accessToken = tokenData.access_token as string;
  const workspaceName = (tokenData.workspace_name as string) || "Notion";

  const notionHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  // Search for databases the user shared during OAuth
  const dbSearchRes = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: notionHeaders,
    body: JSON.stringify({ filter: { property: "object", value: "database" } }),
  });
  const dbSearchData = await dbSearchRes.json();
  const databases: Array<{ id: string }> = dbSearchData.results || [];
  let databaseId = databases[0]?.id?.replace(/-/g, "") || null;

  // If no database found, create a SummaryAI database under the first available page
  if (!databaseId) {
    const pageSearchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: notionHeaders,
      body: JSON.stringify({ filter: { property: "object", value: "page" }, page_size: 1 }),
    });
    const pageData = await pageSearchRes.json();
    const parentPageId: string | undefined = pageData.results?.[0]?.id;

    if (parentPageId) {
      const createRes = await fetch("https://api.notion.com/v1/databases", {
        method: "POST",
        headers: notionHeaders,
        body: JSON.stringify({
          parent: { type: "page_id", page_id: parentPageId },
          title: [{ type: "text", text: { content: "SummaryAI" } }],
          properties: {
            Title: { title: {} },
            URL: { url: {} },
            Summary: { rich_text: {} },
            Date: { date: {} },
          },
        }),
      });
      const createData = await createRes.json();
      if (createRes.ok) {
        databaseId = (createData.id as string)?.replace(/-/g, "");
      }
    }
  }

  const session = JSON.stringify({ access_token: accessToken, workspace_name: workspaceName, database_id: databaseId });

  const response = NextResponse.redirect(baseUrl);
  response.cookies.set("notion_session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return response;
}
