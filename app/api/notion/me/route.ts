import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get("notion_session");
  if (!sessionCookie) return NextResponse.json({ loggedIn: false });

  try {
    const session = JSON.parse(sessionCookie.value);
    return NextResponse.json({
      loggedIn: true,
      workspace_name: session.workspace_name,
      has_database: !!session.database_id,
    });
  } catch {
    return NextResponse.json({ loggedIn: false });
  }
}
