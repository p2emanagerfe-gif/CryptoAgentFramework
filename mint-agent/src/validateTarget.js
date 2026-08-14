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

  if (!target._verification) {
    warnings.push("No _verification block — confidence and sources should be documented for any researched (non-hand-authored) target.");
  } else {
    const v = target._verification;
    if (v.humanVerificationRequired !== true) {
      warnings.push("_verification.humanVerificationRequired should be true for any drafted-not-yet-confirmed target.");
    }
    if (!Array.isArray(v.contractAddressSources) || v.contractAddressSources.length === 0) {
      warnings.push("_verification.contractAddressSources is empty — a contract address with no cited source shouldn't be trusted.");
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
