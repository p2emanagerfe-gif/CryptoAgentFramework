import { loadTargets } from "./config.js";
import { runMint } from "./mintRunner.js";
import { logEvent } from "./logger.js";
import { loadFiredTargets, markFired, STATE_FILE_PATH } from "./watchState.js";

const POLL_INTERVAL_MS = 15_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pure selection logic, split out from the polling loop so it's testable
 * without spinning up timers, a chain, or the filesystem. This is the
 * function actually responsible for the safety property that matters:
 * a target only ever gets returned once across any number of calls with
 * an updated `fired` map, and only if it explicitly opted in.
 */
export function pickTargetsToFire(targets, fired) {
  return Object.entries(targets)
    .filter(([name, target]) => name !== "_comment" && target.watchEnabled === true && !fired[name])
    .map(([name]) => name);
}

/**
 * Unattended mode: stays running, re-reads approved-mints.json on a
 * timer, and launches any target that opts in via `watchEnabled: true`
 * exactly once. This is what lets you set up a target ahead of time and
 * walk away — you don't need a PowerShell window open at the exact
 * trigger moment.
 *
 * Deliberately opt-in per target rather than "watch everything in the
 * file": approved-mints.json can accumulate drafts, examples, and
 * targets you're still reviewing, and this loop should never surprise
 * you by launching one of those just because it happened to be present
 * when the watcher polled. Set `"watchEnabled": true` on a target only
 * once you've actually reviewed it — the same deliberate-step spirit as
 * `acknowledgeMultiWalletAllowlist`, just for "let this run without me."
 *
 * Actual timing (immediate / timestamp / blockNumber / pollContract) is
 * still handled inside runMint -> waitForTrigger exactly as it is for a
 * manual `run` — this loop's only job is deciding WHICH targets to hand
 * off to that machinery, and making sure each one is handed off exactly
 * once even across restarts.
 */
export async function watch() {
  const fired = loadFiredTargets();
  logEvent({
    level: "info",
    message: `Watch mode started. Polling approved-mints.json every ${POLL_INTERVAL_MS / 1000}s. State file: ${STATE_FILE_PATH}`,
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let targets;
    try {
      targets = loadTargets();
    } catch (err) {
      logEvent({ level: "error", message: `Watch: could not load approved-mints.json (${err.message}). Will retry.` });
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    for (const name of pickTargetsToFire(targets, fired)) {
      const target = targets[name];

      // Mark fired BEFORE awaiting anything — two polls must never both
      // decide to launch the same target because the first launch hadn't
      // finished (or even started waiting on its trigger) yet.
      fired[name] = true;
      markFired(name);

      logEvent({
        level: "info",
        target: name,
        message: `Watch: launching (watchEnabled target picked up). ${target.dryRun ? "DRY RUN" : "LIVE — real funds at risk"}.`,
      });

      runMint(name).catch((err) => {
        logEvent({ level: "error", target: name, message: `Watch: run failed to complete: ${err.message}` });
      });
    }

    await sleep(POLL_INTERVAL_MS);
  }
}
