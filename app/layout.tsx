import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SummaryAI",
  description: "URLを入力してWebページをAIで要約",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "#0f1117", color: "#e2e8f0" }}>
        {children}
      </body>
    </html>
  );
}
