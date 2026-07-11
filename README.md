# 英会話 2000 フラッシュカード

日常英会話2000文を、`1-1000` と `1001-2000` の章に分けて練習できるブラウザアプリです。B面は英語、日本語、メモ、全部のタブで切り替えられます。

## Quick Start

```bash
pnpm install
pnpm run dev
pnpm run build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Speech

GPT speech uses `OPENAI_API_KEY` on the server with `gpt-4o-mini-tts`. If the key is not configured, the app falls back to browser speech synthesis.
