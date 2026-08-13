import assert from "node:assert/strict";
import { checkPolicy } from "../src/policyGuard.js";

function run(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name} — ${err.message}`);
    process.exitCode = 1;
  }
}

const baseTarget = {
  mintType: "public-fcfs",
  maxGasPriceGwei: 50,
  dryRun: true,
};

run("public-fcfs with multiple wallets passes with no acknowledgement needed", () => {
  checkPolicy("t1", baseTarget, [{ label: "a" }, { label: "b" }]);
});

run("allowlist with 1 wallet passes without acknowledgement", () => {
  checkPolicy("t2", { ...baseTarget, mintType: "allowlist", perWalletLimit: 1 }, [{ label: "a" }]);
});

run("allowlist with >1 wallet and no acknowledgement throws", () => {
  assert.throws(
    () =>
      checkPolicy(
        "t3",
        { ...baseTarget, mintType: "allowlist", perWalletLimit: 1, acknowledgeMultiWalletAllowlist: false },
        [{ label: "a" }, { label: "b" }]
      ),
    /acknowledgeMultiWalletAllowlist/
  );
});

run("allowlist with >1 wallet and explicit acknowledgement passes", () => {
  checkPolicy(
    "t4",
    { ...baseTarget, mintType: "allowlist", perWalletLimit: 1, acknowledgeMultiWalletAllowlist: true },
    [{ label: "a" }, { label: "b" }]
  );
});

run("missing/zero maxGasPriceGwei throws", () => {
  assert.throws(() => checkPolicy("t5", { ...baseTarget, maxGasPriceGwei: 0 }, [{ label: "a" }]), /maxGasPriceGwei/);
});

run("dryRun not explicitly boolean throws", () => {
  assert.throws(() => checkPolicy("t6", { ...baseTarget, dryRun: undefined }, [{ label: "a" }]), /dryRun/);
});

run("invalid mintType throws", () => {
  assert.throws(() => checkPolicy("t7", { ...baseTarget, mintType: "whatever" }, [{ label: "a" }]), /mintType/);
});

run("perWalletLimit=1 with mintArgs quantity>1 throws", () => {
  assert.throws(
    () =>
      checkPolicy(
        "t8",
        { ...baseTarget, mintType: "allowlist", perWalletLimit: 1, mintArgs: [3], acknowledgeMultiWalletAllowlist: true },
        [{ label: "a" }]
      ),
    /violate the stated per-wallet cap/
  );
});
