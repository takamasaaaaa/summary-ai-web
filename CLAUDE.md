@AGENTS.md

# SummaryAI プロジェクト引き継ぎ情報

## 概要
URLを入力するとJina AIでページ内容を取得し、Anthropic APIで日本語要約・チャットQ&A・Notion保存ができるWebアプリ。

## デプロイ
- **Vercel URL**: https://summary-ai-web.vercel.app
- **GitHubリポジトリ**: https://github.com/takamasaaaaa/summary-ai-web
- **開発ブランチ**: `claude/build-summaryai-app-O3qmG`（mainへのPRは未作成）

## 技術スタック
- Next.js 16.2.4 + TypeScript + Tailwind CSS v4
- フォント: Inter（Google Fonts, `next/font/google`）
- デプロイ: Vercel

## ファイル構成
```
app/
├── page.tsx                  # メインUI（ヒーロー / ローディング / 結果画面）
├── layout.tsx                # Interフォント設定
├── globals.css               # ライトテーマ・ボタン・カード等のCSSクラス
└── api/
    ├── summarize/route.ts    # Jina AIでページ取得 → Anthropic要約（サーバーサイド）
    ├── chat/route.ts         # Anthropicチャット（サーバーサイド）
    └── notion/route.ts       # Notion保存プロキシ（CORS回避）
```

## 環境変数（Vercelに設定済み）
| 変数名 | 用途 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API認証 |
| `NOTION_API_KEY` | Notion API認証 |

## Notion設定
- データベースID: `356b15492e4180f48c16f2c95be37013`
- 保存プロパティ: Title / URL / Summary / Date

## 使用APIモデル
- `claude-sonnet-4-20250514`（要約・チャット共通）

## デザイン方針
- Nstock（nstock.co.jp）風：白背景・黒テキスト・極太タイポグラフィ・大きな余白
- アクセントカラー: 紫グラデーション（`#6366f1` → `#8b5cf6`）
- 全ボタンに `cursor: pointer` + hover時 `scale(1.02)` + shadow

## git push方法
このリポジトリはgitプロキシ経由のpushが403になるため、PATを使用する:
```bash
# <YOUR_PAT> にGitHub Personal Access Tokenを入れる
git remote set-url origin https://<YOUR_PAT>@github.com/takamasaaaaa/summary-ai-web.git
git push origin claude/build-summaryai-app-O3qmG
# push後はURLを戻す
git remote set-url origin http://local_proxy@127.0.0.1:34065/git/takamasaaaaa/summary-ai-web
```

## 既知の実装済み修正
- 日本語IME変換中のEnterキー誤送信: `e.nativeEvent.isComposing` チェックで対応済み
