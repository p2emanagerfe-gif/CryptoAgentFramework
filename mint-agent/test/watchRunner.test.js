import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pickTargetsToFire } from "../src/watchRunner.js";
import { loadFiredTargets, markFired } from "../src/watchState.js";

function run(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name} — ${err.message}`);
    process.exitCode = 1;
  }
}

// --- pickTargetsToFire: the core safety property (opt-in, fire-once) ---

run("target with watchEnabled:true and not yet fired is picked up", () => {
  const targets = { a: { watchEnabled: true } };
  assert.deepEqual(pickTargetsToFire(targets, {}), ["a"]);
});

run("target without watchEnabled is never picked up, even if present", () => {
  const targets = { a: { watchEnabled: false }, b: {}, c: { dryRun: true } };
  assert.deepEqual(pickTargetsToFire(targets, {}), []);
});

run("_comment key is never treated as a target", () => {
  const targets = { _comment: "notes", a: { watchEnabled: true } };
  assert.deepEqual(pickTargetsToFire(targets, {}), ["a"]);
});

run("already-fired target is excluded even if still watchEnabled:true", () => {
  const targets = { a: { watchEnabled: true } };
  assert.deepEqual(pickTargetsToFire(targets, { a: { firedAt: "2026-01-01T00:00:00Z" } }), []);
});

run("only new, unfired, opted-in targets are returned across a mixed set", () => {
  const targets = {
    _comment: "notes",
    alreadyFired: { watchEnabled: true },
    notOptedIn: { watchEnabled: false },
    newAndReady: { watchEnabled: true },
  };
  assert.deepEqual(pickTargetsToFire(targets, { alreadyFired: { firedAt: "x" } }), ["newAndReady"]);
});

// --- watchState: persistence must survive a fresh process (i.e. a restart) ---

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "watch-state-test-"));
const stateFile = path.join(tmpDir, "watch-state.json");

run("loadFiredTargets on a missing file returns {} rather than throwing", () => {
  assert.deepEqual(loadFiredTargets(stateFile), {});
});

run("markFired persists to disk and a later load (simulating a restart) sees it", () => {
  markFired("gogh-punks-robinhood", stateFile);
  assert.equal(existsSync(stateFile), true);
  const reloaded = loadFiredTargets(stateFile); // fresh read, as a restarted process would do
  assert.ok(reloaded["gogh-punks-robinhood"]);
  assert.ok(reloaded["gogh-punks-robinhood"].firedAt);
});

run("marking a second target preserves the first (no clobbering)", () => {
  markFired("second-target", stateFile);
  const reloaded = loadFiredTargets(stateFile);
  assert.ok(reloaded["gogh-punks-robinhood"]);
  assert.ok(reloaded["second-target"]);
});

run("a corrupt state file fails safe to {} instead of crashing the watcher", () => {
  const badFile = path.join(tmpDir, "corrupt.json");
  writeFileSync(badFile, "{ not valid json");
  assert.deepEqual(loadFiredTargets(badFile), {});
});

rmSync(tmpDir, { recursive: true, force: true });
