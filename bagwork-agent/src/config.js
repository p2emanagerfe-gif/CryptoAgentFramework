import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadJson(filename, exampleFilename) {
  const filePath = path.join(ROOT, filename);
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${filename}. Copy ${exampleFilename} to ${filename} and fill it in before running.`);
  }
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

export function loadQueue() {
  return loadJson("content-queue.json", "content-queue.example.json");
}

export function getItem(id) {
  const queue = loadQueue();
  const item = queue[id];
  if (!item) {
    const available = Object.keys(queue).filter((k) => k !== "_comment");
    throw new Error(`No content item "${id}" in content-queue.json. Available: ${available.join(", ") || "(none configured)"}`);
  }
  return item;
}

/**
 * Writes the full queue back to content-queue.json, pretty-printed. Used
 * only by the `generate-image` CLI command to record the resulting
 * mediaFile path onto an item — never by a content-drafting agent
 * directly (they write via their own file tools, same as always); this
 * exists so the CLI's own generation step can persist its own result
 * without a human manually copying a path into the JSON afterward.
 */
export function saveQueue(queue) {
  const filePath = path.join(ROOT, "content-queue.json");
  writeFileSync(filePath, JSON.stringify(queue, null, 2) + "\n");
}

/**
 * Credentials live only in .env (gitignored), never in content-queue.json,
 * and content-creating agents (bag-work-meme, bag-work-narrative) never
 * import this function — only poster.js does. Same separation as
 * mint-agent's wallets.json/.env split.
 */
export function loadPlatformCredentials(platform) {
  if (platform === "x") {
    const required = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`Missing X (Twitter) credentials in .env: ${missing.join(", ")}`);
    }
    return {
      consumerKey: process.env.X_API_KEY,
      consumerSecret: process.env.X_API_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
    };
  }
  if (platform === "discord") {
    if (!process.env.DISCORD_WEBHOOK_URL) {
      throw new Error("Missing DISCORD_WEBHOOK_URL in .env");
    }
    return { webhookUrl: process.env.DISCORD_WEBHOOK_URL };
  }
  throw new Error(`Unknown platform "${platform}"`);
}
