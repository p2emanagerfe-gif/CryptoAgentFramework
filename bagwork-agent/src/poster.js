import { existsSync } from "node:fs";
import { loadPlatformCredentials } from "./config.js";
import { checkCompliance, assertReadyToPost } from "./complianceGuard.js";
import { buildOAuth1Header } from "./oauth1.js";
import { uploadMediaToX, buildDiscordMultipart } from "./media.js";
import { logEvent } from "./logger.js";

// Overridable only for tests (test/poster.test.js points this at a local
// mock server) — never something a content item or .env should need to
// set for real use, so it's not documented in .env.example.
const X_TWEETS_URL = process.env.BAGWORK_TEST_X_API_URL || "https://api.twitter.com/2/tweets";

async function postToX(assembledText, mediaFile) {
  const creds = loadPlatformCredentials("x");

  let mediaIds;
  if (mediaFile) {
    const mediaId = await uploadMediaToX(mediaFile, creds);
    mediaIds = [mediaId];
  }

  const authHeader = buildOAuth1Header({ method: "POST", url: X_TWEETS_URL, ...creds });
  const payload = { text: assembledText };
  if (mediaIds) payload.media = { media_ids: mediaIds };

  const res = await fetch(X_TWEETS_URL, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`X API returned ${res.status}: ${JSON.stringify(body)}`);
  }
  return { platform: "x", id: body?.data?.id, mediaId: mediaIds?.[0], raw: body };
}

async function postToDiscord(assembledText, mediaFile) {
  const { webhookUrl } = loadPlatformCredentials("discord");

  let res;
  if (mediaFile) {
    const { body, boundary } = buildDiscordMultipart(assembledText, mediaFile);
    res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
  } else {
    res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: assembledText }),
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord webhook returned ${res.status}: ${body}`);
  }
  // Discord webhooks return 204 No Content on success — nothing to parse.
  return { platform: "discord", raw: null };
}

/**
 * The single entry point every posting path goes through — CLI, watcher,
 * anything future. Dry run always runs the compliance check and reports
 * violations (that's how a draft gets fixed) but never calls a real API.
 * A real post additionally requires assertReadyToPost to not throw, and
 * — if an item declares a mediaFile — that the file actually exists on
 * disk before any network call is made.
 */
export async function postItem(id, item) {
  const { violations, ok, assembled } = checkCompliance(item);
  const mediaFile = item.mediaFile;
  const mediaExists = mediaFile ? existsSync(mediaFile) : null;
  const mediaNote = !mediaFile
    ? " Media: none attached."
    : mediaExists
      ? ` Media: ${mediaFile} (found).`
      : ` Media: ${mediaFile} (WARNING: file not found — a real post would fail).`;

  if (item.dryRun) {
    logEvent({
      level: ok ? "info" : "warn",
      item: id,
      message: `DRY RUN — would post to ${item.platform}: "${assembled}".${mediaNote} ${
        ok ? "Compliance check: clean." : `Compliance check FAILED: ${violations.join("; ")}`
      } No request sent.`,
    });
    return { id, status: "dry-run-ok", ok, violations, assembled, mediaFile: mediaFile ?? null };
  }

  try {
    assertReadyToPost(item);
  } catch (err) {
    logEvent({ level: "error", item: id, message: `Refusing to post: ${err.message}` });
    return { id, status: "refused", error: err.message };
  }

  if (mediaFile && !mediaExists) {
    const message = `Refusing to post: mediaFile "${mediaFile}" is set but the file doesn't exist on disk.`;
    logEvent({ level: "error", item: id, message });
    return { id, status: "refused", error: message };
  }

  try {
    const result = item.platform === "x" ? await postToX(assembled, mediaFile) : await postToDiscord(assembled, mediaFile);
    logEvent({ level: "info", item: id, message: `Posted to ${item.platform}. ${JSON.stringify(result)}` });
    return { id, status: "posted", ...result };
  } catch (err) {
    logEvent({ level: "error", item: id, message: `Post failed: ${err.message}` });
    return { id, status: "post-failed", error: err.message };
  }
}
