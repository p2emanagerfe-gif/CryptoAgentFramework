import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildOAuth1Header } from "./oauth1.js";

// Overridable only for tests, same pattern as poster.js's X_TWEETS_URL.
const X_MEDIA_UPLOAD_URL = process.env.BAGWORK_TEST_X_MEDIA_URL || "https://upload.twitter.com/1.1/media/upload.json";

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

/**
 * Builds a raw multipart/form-data body by hand (no external dependency,
 * same minimal-footprint posture as the rest of this project). `fields`
 * is a plain object of text fields; `fileField` (optional) is
 * { name, filename, contentType, data: Buffer }.
 */
function buildMultipartBody(fields, fileField) {
  const boundary = "----bagworkBoundary" + crypto.randomBytes(16).toString("hex");
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }

  if (fileField) {
    const { name, filename, contentType, data } = fileField;
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
      )
    );
    parts.push(data);
    parts.push(Buffer.from("\r\n"));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), boundary };
}

/**
 * Uploads a local image file to X's v1.1 media endpoint — the v2 tweet
 * API has no upload endpoint of its own, so this legacy endpoint is
 * still required to get a media_id to attach to a v2 tweet. Uses the
 * simple, single-request multipart flow (fine for images/gifs under
 * X's ~5MB simple-upload limit). A real chunked INIT/APPEND/FINALIZE
 * flow would be needed for video, which this project doesn't post.
 *
 * Multipart bodies are NOT form-urlencoded, so — consistent with
 * oauth1.js's documented behavior for the JSON-bodied tweet endpoint —
 * body fields are correctly excluded from the OAuth1 signature base
 * string here too; only oauth_* params are signed.
 */
export async function uploadMediaToX(filePath, creds) {
  const data = readFileSync(filePath);
  const contentType = guessMimeType(filePath);
  const { body, boundary } = buildMultipartBody(
    {},
    { name: "media", filename: path.basename(filePath), contentType, data }
  );

  const authHeader = buildOAuth1Header({ method: "POST", url: X_MEDIA_UPLOAD_URL, ...creds });

  const res = await fetch(X_MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });

  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`X media upload returned ${res.status}: ${JSON.stringify(responseBody)}`);
  }
  if (!responseBody.media_id_string) {
    throw new Error(`X media upload response missing media_id_string: ${JSON.stringify(responseBody)}`);
  }
  return responseBody.media_id_string;
}

/**
 * Builds a multipart body for a Discord webhook post carrying both the
 * text payload and a file attachment, per Discord's documented
 * multipart webhook format: a `payload_json` field plus `files[n]`
 * fields for each attachment.
 */
export function buildDiscordMultipart(content, filePath) {
  const data = readFileSync(filePath);
  const contentType = guessMimeType(filePath);
  const filename = path.basename(filePath);
  const { body, boundary } = buildMultipartBody(
    { payload_json: JSON.stringify({ content }) },
    { name: "files[0]", filename, contentType, data }
  );
  return { body, boundary };
}
