import { existsSync } from "node:fs";
import { checkCompliance } from "./complianceGuard.js";

/**
 * Structural/sanity validation for a content-queue draft — the bag-work
 * equivalent of mint-agent's validateTarget.js. Run this against any new
 * draft (from bag-work-meme, bag-work-narrative, or hand-written) before
 * treating it as reviewable by marketing-compliance.
 *
 * Usage: node src/validateContent.js <path-to-content-queue.json> <item-key>
 */
export function validateContentShape(itemKey, item) {
  const errors = [];
  const warnings = [];

  const requireField = (field, predicate, message) => {
    if (!predicate(item[field])) errors.push(`${field}: ${message}`);
  };

  requireField("project", (v) => typeof v === "string" && v.trim().length > 0, "must be a non-empty string");
  requireField("type", (v) => v === "meme" || v === "narrative", 'must be "meme" or "narrative"');
  requireField("platform", (v) => v === "x" || v === "discord", 'must be "x" or "discord"');
  requireField("body", (v) => typeof v === "string" && v.trim().length > 0, "must be a non-empty string");
  requireField("disclosure", (v) => typeof v === "string" && v.trim().length > 0, "must be a non-empty string");
  requireField("dryRun", (v) => v === true, "must be true for any newly-drafted item — flipping to false is a separate, deliberate human step");
  requireField("complianceApproved", (v) => v === false, "must be false for any newly-drafted item — only a human/marketing-compliance sign-off sets this true, never the content-drafting agent itself");

  const { violations } = checkCompliance(item);
  violations.forEach((v) => warnings.push(`compliance check: ${v}`));

  if (item.type === "meme" && !item.mediaFile) {
    warnings.push(
      "mediaFile: no image attached — a meme with no image is just a caption; add a mediaFile path once art exists, or confirm this is intentionally text-only"
    );
  }
  if (item.mediaFile && typeof item.mediaFile === "string" && !existsSync(item.mediaFile)) {
    warnings.push(`mediaFile: "${item.mediaFile}" does not exist on disk relative to the current working directory — a real post would refuse to send`);
  }

  if (item.createdBy === "marketing-compliance") {
    errors.push('createdBy: marketing-compliance is a reviewer, not a content author — it should never be the "createdBy" of a draft it\'s supposed to be independently checking');
  }

  return { itemKey, errors, warnings, valid: errors.length === 0 };
}

async function main() {
  const [, , filePath, itemKey] = process.argv;
  if (!filePath) {
    console.log("Usage: node src/validateContent.js <path-to-content-queue.json> [item-key]");
    process.exit(1);
  }
  const fs = await import("node:fs");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const keys = itemKey ? [itemKey] : Object.keys(data).filter((k) => k !== "_comment");

  let anyInvalid = false;
  for (const key of keys) {
    const result = validateContentShape(key, data[key]);
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
