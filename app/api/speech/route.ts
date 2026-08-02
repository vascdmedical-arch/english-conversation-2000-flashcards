const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "marin";
const SUPPORTED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "fable",
  "marin",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
]);
const ALLOWED_ORIGINS = new Set([
  "https://vascdmedical-arch.github.io",
  "https://english-conversation-2000.keisuke7777.chatgpt.site",
]);
const SPEECH_INSTRUCTIONS =
  "Speak like a natural native English conversation partner. Use clear but relaxed pronunciation, natural connected speech, accurate word stress, subtle emotion, and short natural pauses. Keep a friendly tone and a comfortable learner-friendly pace without sounding robotic or overly slow.";

type SpeechPayload = {
  text?: string;
  voice?: string;
};

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const headers = new Headers();

  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  return headers;
}

export function OPTIONS(request: Request) {
  const headers = getCorsHeaders(request);
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return new Response(null, { status: 204, headers });
}

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 503, headers: corsHeaders },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as SpeechPayload;
  const text = payload.text?.trim();
  const requestedVoice = payload.voice?.trim() || DEFAULT_VOICE;
  const voice = SUPPORTED_VOICES.has(requestedVoice) ? requestedVoice : DEFAULT_VOICE;
  const model = process.env.OPENAI_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;

  if (!text) {
    return Response.json({ error: "Text is required." }, { status: 400, headers: corsHeaders });
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      instructions: SPEECH_INSTRUCTIONS,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return Response.json(
      { error: "Speech generation failed.", detail },
      { status: response.status, headers: corsHeaders },
    );
  }

  corsHeaders.set("Cache-Control", "no-store");
  corsHeaders.set("Content-Type", "audio/mpeg");

  return new Response(await response.arrayBuffer(), {
    headers: corsHeaders,
  });
}
