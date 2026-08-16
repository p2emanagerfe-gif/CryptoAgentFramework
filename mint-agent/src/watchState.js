import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, "..", "state");
const STATE_FILE = path.join(STATE_DIR, "watch-state.json");

/**
 * Tracks which targets the unattended watcher has already launched, so a
 * restart (crash, laptop sleep, Task Scheduler re-trigger) never re-fires
 * a target that already ran. This matters most for "immediate" triggers
 * and for anything with dryRun:false — a duplicate live fire means a
 * second real transaction, not just a redundant log line.
 *
 * Deliberately a flat on-disk file, not in-memory only: the whole point
 * of watch mode is that no human is necessarily watching when it restarts.
 */
export function loadFiredTargets(stateFile = STATE_FILE) {
  if (!existsSync(stateFile)) return {};
  try {
    return JSON.parse(readFileSync(stateFile, "utf-8"));
  } catch {
    // Corrupt state file — fail safe by treating it as empty rather than
    // crashing the watcher, but this is worth a human's attention.
    return {};
  }
}

export function markFired(targetName, stateFile = STATE_FILE) {
  const dir = path.dirname(stateFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const state = loadFiredTargets(stateFile);
  state[targetName] = { firedAt: new Date().toISOString() };
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

export const STATE_FILE_PATH = STATE_FILE;
