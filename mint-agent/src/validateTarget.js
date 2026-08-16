import { ethers } from "ethers";

/**
 * Structural/sanity validation for a mint-target draft — distinct from
 * policyGuard.js, which runs at execution time and needs a resolved
 * wallet list. This runs at research/draft time, right after the
 * mint-intelligence agent (or a human) writes a new entry, to catch
 * mistakes before anyone even opens approved-mints.json to review it.
 *
 * Usage: node src/validateTarget.js <path-to-json> <target-key>
 */
export function validateTargetShape(targetName, target) {
  const errors = [];
  const warnings = [];

  const requireField = (field, predicate, message) => {
    if (!predicate(target[field])) errors.push(`${field}: ${message}`);
  };

  requireField("chainId", (v) => typeof v === "number" && v > 0, "must be a positive number");
  requireField("rpcUrls", (v) => Array.isArray(v) && v.length > 0, "must be a non-empty array");
  requireField(
    "contractAddress",
    (v) => typeof v === "string" && ethers.isAddress(v),
    "must be a valid checksummable address (not a placeholder or truncated value)"
  );
  requireField(
    "mintType",
    (v) => v === "public-fcfs" || v === "allowlist",
    'must be "public-fcfs" or "allowlist"'
  );
  requireField("maxGasPriceGwei", (v) => typeof v === "number" && v > 0, "must be a positive number");
  requireField("dryRun", (v) => v === true, "must be true for any newly-drafted target — flipping to false is a separate, deliberate human step");

  if (target.mintFunction != null && typeof target.mintFunction !== "string") {
    errors.push("mintFunction: if set, must be a string — or leave it null if unconfirmed");
  }
  if (target.mintFunction == null) {
    warnings.push("mintFunction is unset — confirm the real function signature from verified contract source before this target can run, even in dry-run mode.");
  }

  if (target.mintType === "allowlist" && target.acknowledgeMultiWalletAllowlist === true) {
    warnings.push(
      "acknowledgeMultiWalletAllowlist is already true on a freshly-drafted allowlist target — confirm a human actually set this, research agents should never set it themselves."
    );
  }

  if (target.watchEnabled === true) {
    warnings.push(
      "watchEnabled is true — the unattended watcher will launch this target on its own once its trigger fires, with no human present at that moment. Confirm the trigger, dryRun, and mintArgs are all exactly what you want before leaving this set."
    );
    if ((target.trigger?.mode ?? "immediate") === "immediate") {
      warnings.push(
        "watchEnabled + trigger.mode \"immediate\" means the watcher fires this the instant it next polls approved-mints.json — effectively as soon as you save the file with the watcher already running. Consider a \"timestamp\" trigger instead if that's not what you intend."
      );
    }
  }

  if (!target._verification) {
    warnings.push("No _verification block — confidence and sources should be documented for any researched (non-hand-authored) target.");
  } else {
    const v = target._verification;
    if (v.humanVerificationRequired === true && !(Array.isArray(v.blankFields) && v.blankFields.length > 0)) {
      warnings.push(
        "_verification.humanVerificationRequired is true but blankFields is empty — if everything's actually filled in and just a guess rather than blank, this should be false (guesses are the dry run's job to catch, not a human's)."
      );
    }
    if (v.humanVerificationRequired !== true && Array.isArray(v.blankFields) && v.blankFields.length > 0) {
      warnings.push(
        `_verification.blankFields is non-empty (${v.blankFields.join("; ")}) but humanVerificationRequired isn't true — a genuinely blank field should block, not just warn.`
      );
    }
    // Field names vary (contractAddressSources for simple targets;
    // nftContractAddressSources/seaDropRouterSources for router-style
    // mints where contractAddress isn't the collection itself) — accept
    // any *Sources array as long as at least one is actually populated.
    const sourceArrays = Object.entries(v)
      .filter(([key]) => key.toLowerCase().endsWith("sources"))
      .map(([, val]) => val);
    const hasAnySources = sourceArrays.some((arr) => Array.isArray(arr) && arr.length > 0);
    if (!hasAnySources) {
      warnings.push("_verification has no populated *Sources array — a contract address with no cited source shouldn't be trusted.");
    }
  }

  return { targetName, errors, warnings, valid: errors.length === 0 };
}

async function main() {
  const [, , filePath, targetName] = process.argv;
  if (!filePath) {
    console.log("Usage: node src/validateTarget.js <path-to-approved-mints.json> [target-key]");
    process.exit(1);
  }
  const fs = await import("node:fs");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const keys = targetName ? [targetName] : Object.keys(data).filter((k) => k !== "_comment");

  let anyInvalid = false;
  for (const key of keys) {
    const result = validateTargetShape(key, data[key]);
    console.log(`\n=== ${key} ===`);
    if (result.errors.length === 0) {
      console.log("  No structural errors.");
    } else {
      anyInvalid = true;
      result.errors.forEach((e) => console.log(`  ERROR: ${e}`));
    }
    result.warnings.forEach((w) => console.log(`  warn:  ${w}`));
  }
  process.exitCode = anyInvalid ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
