/**
 * Policy checks run before ANY simulation or send. Throwing here means
 * nothing downstream ever touches the network for this target/run.
 *
 * These checks encode the mint-fairness posture from the mint-agent
 * README and the AOS's Anti-Wash-Trade / policy-first-execution
 * principles as actual code, not just documentation.
 */
export function checkPolicy(targetName, target, resolvedWallets) {
  const problems = [];

  if (!["public-fcfs", "allowlist"].includes(target.mintType)) {
    problems.push(
      `mintType must be "public-fcfs" or "allowlist" (got "${target.mintType}").`
    );
  }

  if (
    target.mintType === "allowlist" &&
    resolvedWallets.length > 1 &&
    target.acknowledgeMultiWalletAllowlist !== true
  ) {
    problems.push(
      `Target "${targetName}" is an allowlist mint (perWalletLimit likely exists to spread ` +
        `allocation across distinct community members) and is configured to use ` +
        `${resolvedWallets.length} wallets. Set "acknowledgeMultiWalletAllowlist": true on this ` +
        `target in approved-mints.json to confirm this is a deliberate, reviewed decision — ` +
        `not a default.`
    );
  }

  if (
    typeof target.perWalletLimit === "number" &&
    target.perWalletLimit === 1 &&
    Array.isArray(target.mintArgs) &&
    target.mintArgs[0] > 1
  ) {
    problems.push(
      `perWalletLimit is 1 but mintArgs requests a quantity > 1 in a single call — this would ` +
        `violate the stated per-wallet cap. Fix mintArgs or perWalletLimit.`
    );
  }

  if (typeof target.maxGasPriceGwei !== "number" || target.maxGasPriceGwei <= 0) {
    problems.push(`maxGasPriceGwei must be a positive number — no unbounded gas spend.`);
  }

  if (target.dryRun !== true && target.dryRun !== false) {
    problems.push(`dryRun must be explicitly true or false.`);
  }

  if (problems.length > 0) {
    throw new Error(
      `Policy check failed for target "${targetName}":\n - ${problems.join("\n - ")}`
    );
  }
}
