import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "mint-log.jsonl");

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

/**
 * Append-only structured audit log — one JSON object per line.
 * Never overwrite or rewrite this file; it's the audit trail an
 * Audit & Evidence Agent would consume downstream.
 */
export function logEvent(event) {
  const record = { ts: new Date().toISOString(), ...event };
  appendFileSync(LOG_FILE, JSON.stringify(record) + "\n");
  const summary = `[${record.ts}] ${event.level ?? "info"} ${event.target ?? ""} ${event.wallet ?? ""} ${event.message ?? ""}`;
  // eslint-disable-next-line no-console
  console.log(summary.trim());
  return record;
}

export const LOG_FILE_PATH = LOG_FILE;
