import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the flashcard app shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>英会話フラッシュカード<\/title>/i);
  assert.match(html, /英会話カード/);
  assert.match(html, /1-1000/);
  assert.match(html, /1001-2000/);
  assert.match(html, /B面/);
  assert.match(html, /スマホ音声/);
  assert.doesNotMatch(html, /GPT自然音声|api\/speech|codex-preview|react-loading-skeleton/i);
});

test("uses device speech without the hosted GPT speech route", async () => {
  const [reactApp, staticApp, staticHtml, serviceWorker, readme] = await Promise.all([
    readFile(new URL("../app/FlashcardApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/app.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
    readFile(new URL("../docs/service-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(reactApp, /SpeechSynthesisUtterance/);
  assert.match(reactApp, /スマホ音声/);
  assert.doesNotMatch(reactApp, /fetch\(["']\/api\/speech|OPENAI_API_KEY|gpt-4o-mini-tts|GPT自然音声/);

  assert.match(staticApp, /SpeechSynthesisUtterance/);
  assert.match(staticApp, /スマホ音声/);
  assert.doesNotMatch(staticApp, /GPT_SPEECH_ENDPOINT|fetch\(GPT_SPEECH_ENDPOINT|api\/speech|GPT自然音声/);

  assert.match(staticHtml, /スマホ音声/);
  assert.match(serviceWorker, /english-conversation-2000-v9/);
  assert.match(readme, /device browser's English speech synthesis/);

  await assert.rejects(access(new URL("../app/api/speech/route.ts", import.meta.url)));
});
