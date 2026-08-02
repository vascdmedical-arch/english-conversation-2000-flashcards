# 英会話フラッシュカード

重複を整理した日常英会話を、`1-1000` と `1001-2000` の章に分けて練習できるブラウザアプリです。B面は英語、日本語、メモ、全部のタブで切り替えられます。

## Quick Start

```bash
pnpm install
pnpm run dev
pnpm run build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Speech

GPT speech uses `OPENAI_API_KEY` on the server with OpenAI's current text-to-speech model, `gpt-4o-mini-tts`. The app defaults to the recommended `marin` voice and uses natural conversation instructions. If the key is not configured, the app falls back to browser speech synthesis.
