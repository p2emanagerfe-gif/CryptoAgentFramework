import assert from "node:assert/strict";
import { checkCompliance, assertReadyToPost } from "../src/complianceGuard.js";

function run(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name} — ${err.message}`);
    process.exitCode = 1;
  }
}

const clean = {
  project: "gogh-punks",
  type: "meme",
  platform: "x",
  body: "me refreshing the mint page every 30 seconds",
  disclosure: "Disclosure: we hold Gogh Punks NFTs. Not financial advice.",
  complianceApproved: true,
  dryRun: false,
};

run("clean item with real disclosure passes", () => {
  const { ok, violations } = checkCompliance(clean);
  assert.equal(ok, true, violations.join("; "));
});

run("missing body fails", () => {
  const { ok, violations } = checkCompliance({ ...clean, body: "" });
  assert.equal(ok, false);
  assert.ok(violations.some((v) => v.startsWith("body:")));
});

run("missing disclosure fails", () => {
  const { ok, violations } = checkCompliance({ ...clean, disclosure: "" });
  assert.equal(ok, false);
  assert.ok(violations.some((v) => v.startsWith("disclosure:")));
});

run("vague disclosure that doesn't actually disclose a position fails", () => {
  const { ok, violations } = checkCompliance({ ...clean, disclosure: "Do your own research!" });
  assert.equal(ok, false);
  assert.ok(violations.some((v) => v.includes("doesn't read like an actual disclosure")));
});

run("guaranteed-return language is blocked", () => {
  const { ok, violations } = checkCompliance({ ...clean, body: "this guarantees a profit for everyone who mints" });
  assert.equal(ok, false);
  assert.ok(violations.some((v) => v.includes("guaranteed")));
});

run("'can't lose' language is blocked", () => {
  const { ok } = checkCompliance({ ...clean, body: "you literally can't lose on this one" });
  assert.equal(ok, false);
});

run("risk-free language is blocked", () => {
  const { ok } = checkCompliance({ ...clean, body: "a totally risk-free way to get in early" });
  assert.equal(ok, false);
});

run("certain future price claim is blocked", () => {
  const { ok } = checkCompliance({ ...clean, body: "this will definitely 100x by next month" });
  assert.equal(ok, false);
});

run("high-pressure urgency + financial ask is blocked", () => {
  const { ok } = checkCompliance({ ...clean, body: "act now or miss out on the mint forever" });
  assert.equal(ok, false);
});

run("over-length post for platform fails", () => {
  const { ok, violations } = checkCompliance({ ...clean, body: "x".repeat(400) });
  assert.equal(ok, false);
  assert.ok(violations.some((v) => v.includes("char limit")));
});

run("unknown platform fails", () => {
  const { ok, violations } = checkCompliance({ ...clean, platform: "myspace" });
  assert.equal(ok, false);
  assert.ok(violations.some((v) => v.startsWith("platform:")));
});

run("assertReadyToPost throws on compliance violation even if complianceApproved is true", () => {
  assert.throws(() => assertReadyToPost({ ...clean, body: "guaranteed profit for all" }), /fails compliance check/);
});

run("assertReadyToPost throws if complianceApproved is not true, even with clean content", () => {
  assert.throws(() => assertReadyToPost({ ...clean, complianceApproved: false }), /complianceApproved is not explicitly true/);
});

run("assertReadyToPost throws if dryRun is not a boolean", () => {
  assert.throws(() => assertReadyToPost({ ...clean, dryRun: undefined }), /dryRun must be explicitly/);
});

run("assertReadyToPost passes for a clean, approved, non-dry-run item", () => {
  assertReadyToPost(clean);
});
