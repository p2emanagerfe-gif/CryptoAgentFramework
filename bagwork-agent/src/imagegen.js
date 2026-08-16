import { writeFileSync } from "node:fs";

// Overridable only for tests — same pattern as poster.js's X_TWEETS_URL and
// media.js's X_MEDIA_UPLOAD_URL.
const XAI_IMAGE_URL = process.env.BAGWORK_TEST_XAI_URL || "https://api.x.ai/v1/images/generations";
const XAI_MODEL = "grok-imagine-image-2.0";

function requireXaiKey() {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    throw new Error("XAI_API_KEY is not set in .env — required to use Grok image generation. See .env.example.");
  }
  return key;
}

/**
 * Generates an image via xAI's Grok Imagine API (https://api.x.ai/v1/images/generations)
 * and writes it to `outputPath`. Uses response_format: "b64_json" so the
 * image comes back inline in the API response — no second fetch to a
 * temporary URL that could expire before it's saved.
 *
 * IMPORTANT — what `prompt` should and shouldn't contain: describe an
 * ORIGINAL composition (scene, characters-by-description, labels/text),
 * never a real copyrighted meme template by name ("Distracted Boyfriend"),
 * a real stock photo, or a real/trademarked person or character. This
 * mirrors the constraint the hand-drawn Gogh Punks illustration followed
 * before this hookup existed — an AI generator asked to reproduce a named
 * copyrighted template is just as much an IP risk as pasting the original
 * image would be. `bag-work-meme`'s system prompt enforces this at the
 * prompt-writing step; this function does no content filtering of its own
 * beyond surfacing xAI's own moderation flag if one comes back.
 */
export async function generateMemeImage({ prompt, outputPath, aspectRatio = "16:9" }) {
  const apiKey = requireXaiKey();

  const res = await fetch(XAI_IMAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      prompt,
      n: 1,
      response_format: "b64_json",
      aspect_ratio: aspectRatio,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Grok image generation returned ${res.status}: ${JSON.stringify(body)}`);
  }

  const first = body?.data?.[0];
  if (first?.moderation_reason || first?.flagged) {
    throw new Error(`Grok flagged this generation and refused to return a usable image: ${JSON.stringify(first)}`);
  }
  if (!first?.b64_json) {
    throw new Error(`Grok image generation response missing b64_json: ${JSON.stringify(body)}`);
  }

  const buffer = Buffer.from(first.b64_json, "base64");
  writeFileSync(outputPath, buffer);
  return { outputPath, bytes: buffer.length };
}
