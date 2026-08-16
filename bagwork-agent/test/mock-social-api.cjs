// Minimal mock servers standing in for the X (Twitter) API v2 tweets
// endpoint, the X v1.1 media upload endpoint, a Discord webhook, and
// xAI's Grok image-generation endpoint — just enough surface to drive
// poster.js/imagegen.js end-to-end without needing real credentials or
// actually posting/generating anything public. Records every request it
// receives so a test can assert on exactly what would have been sent,
// including parsed multipart fields/files.
const http = require("node:http");

// A real, tiny (68-byte) 1x1 PNG, base64-encoded — same fixture used for
// media-upload tests, reused here as the mock "generated" image so tests
// can decode the response and verify it's genuinely image bytes.
const TEST_IMAGE_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const receivedX = [];
const receivedXMedia = [];
const receivedDiscord = [];
const receivedXai = [];

/**
 * Very small multipart/form-data parser — enough to split a body built
 * by bagwork-agent's own media.js into named fields/files for test
 * assertions. Not a general-purpose parser; trusts the boundary it's
 * given and the well-formed structure our own client produces.
 */
function parseMultipart(buffer, boundary) {
  const boundaryMarker = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(boundaryMarker);
  while (start !== -1) {
    const next = buffer.indexOf(boundaryMarker, start + boundaryMarker.length);
    if (next === -1) break;
    let chunk = buffer.slice(start + boundaryMarker.length, next);
    // Strip leading \r\n and trailing \r\n-- (before the next boundary marker)
    if (chunk.slice(0, 2).toString() === "\r\n") chunk = chunk.slice(2);
    if (chunk.slice(-2).toString() === "\r\n") chunk = chunk.slice(0, -2);
    if (chunk.length > 0) {
      const headerEnd = chunk.indexOf("\r\n\r\n");
      if (headerEnd !== -1) {
        const headerText = chunk.slice(0, headerEnd).toString("utf-8");
        const data = chunk.slice(headerEnd + 4);
        const nameMatch = headerText.match(/name="([^"]+)"/);
        const filenameMatch = headerText.match(/filename="([^"]+)"/);
        const contentTypeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
        parts.push({
          name: nameMatch ? nameMatch[1] : null,
          filename: filenameMatch ? filenameMatch[1] : null,
          contentType: contentTypeMatch ? contentTypeMatch[1] : null,
          data,
        });
      }
    }
    start = next;
  }
  return parts;
}

function getBoundary(contentType) {
  const match = /boundary=(.+)$/.exec(contentType || "");
  return match ? match[1] : null;
}

const xServer = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf-8");
    const parsed = JSON.parse(body || "{}");
    receivedX.push({ method: req.method, url: req.url, headers: req.headers, body: parsed });
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: { id: "mock-tweet-id-123", text: parsed.text } }));
  });
});

const xMediaServer = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const buffer = Buffer.concat(chunks);
    const boundary = getBoundary(req.headers["content-type"]);
    const parts = boundary ? parseMultipart(buffer, boundary) : [];
    receivedXMedia.push({ method: req.method, url: req.url, headers: req.headers, parts: parts.map((p) => ({ ...p, data: undefined, dataLength: p.data.length })) });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ media_id_string: "mock-media-id-456", media_id: 456 }));
  });
});

const discordServer = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const buffer = Buffer.concat(chunks);
    const contentType = req.headers["content-type"] || "";
    if (contentType.startsWith("multipart/form-data")) {
      const boundary = getBoundary(contentType);
      const parts = boundary ? parseMultipart(buffer, boundary) : [];
      const payloadPart = parts.find((p) => p.name === "payload_json");
      const filePart = parts.find((p) => p.name && p.name.startsWith("files"));
      receivedDiscord.push({
        method: req.method,
        url: req.url,
        multipart: true,
        body: payloadPart ? JSON.parse(payloadPart.data.toString("utf-8")) : {},
        file: filePart ? { name: filePart.name, filename: filePart.filename, contentType: filePart.contentType, dataLength: filePart.data.length } : null,
      });
    } else {
      receivedDiscord.push({ method: req.method, url: req.url, multipart: false, body: JSON.parse(buffer.toString("utf-8") || "{}") });
    }
    res.writeHead(204);
    res.end();
  });
});

const xaiServer = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
    receivedXai.push({ method: req.method, url: req.url, headers: req.headers, body: parsed });

    if (parsed.prompt && parsed.prompt.includes("TRIGGER_500")) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "mock server-side failure" }));
      return;
    }
    if (parsed.prompt && parsed.prompt.includes("TRIGGER_MODERATION")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ flagged: true, moderation_reason: "mock moderation block" }] }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ b64_json: TEST_IMAGE_B64 }] }));
  });
});

const X_PORT = 8601;
const DISCORD_PORT = 8602;
const X_MEDIA_PORT = 8604;
const XAI_PORT = 8606;

xServer.listen(X_PORT, () => console.log(`mock-x-api listening on http://127.0.0.1:${X_PORT}`));
discordServer.listen(DISCORD_PORT, () => console.log(`mock-discord-webhook listening on http://127.0.0.1:${DISCORD_PORT}`));
xMediaServer.listen(X_MEDIA_PORT, () => console.log(`mock-x-media-upload listening on http://127.0.0.1:${X_MEDIA_PORT}`));
xaiServer.listen(XAI_PORT, () => console.log(`mock-xai-images listening on http://127.0.0.1:${XAI_PORT}`));

// Tiny inspection endpoint so a test process can pull what was received
// without sharing memory (this runs as a separate child process).
const inspectServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ x: receivedX, xMedia: receivedXMedia, discord: receivedDiscord, xai: receivedXai }));
});
inspectServer.listen(8603, () => console.log("mock-inspect listening on http://127.0.0.1:8603"));
