const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "marin";

type SpeechPayload = {
  text?: string;
  voice?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as SpeechPayload;
  const text = payload.text?.trim();
  const voice = payload.voice?.trim() || DEFAULT_VOICE;

  if (!text) {
    return Response.json({ error: "Text is required." }, { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice,
      input: text,
      instructions:
        "Speak naturally in clear everyday English with warm intonation, accurate stress, and a comfortable learning pace.",
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return Response.json(
      { error: "Speech generation failed.", detail },
      { status: response.status },
    );
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "audio/mpeg",
    },
  });
}
