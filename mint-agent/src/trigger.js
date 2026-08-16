import { logEvent } from "./logger.js";

/**
 * Resolves when the mint attempt should actually fire, based on
 * target.trigger. Returns a promise that resolves once it's time to go.
 */
export async function waitForTrigger(targetName, target, provider) {
  const trigger = target.trigger ?? { mode: "immediate" };

  switch (trigger.mode) {
    case "immediate":
      return;

    case "blockNumber": {
      logEvent({
        level: "info",
        target: targetName,
        message: `Waiting for block ${trigger.value}...`,
      });
      return new Promise((resolve) => {
        const check = async () => {
          const current = await provider.getBlockNumber();
          if (current >= trigger.value) {
            resolve();
          } else {
            setTimeout(check, trigger.intervalMs ?? 500);
          }
        };
        check();
      });
    }

    case "timestamp": {
      const targetMs = trigger.value * 1000;
      const waitMs = targetMs - Date.now();
      logEvent({
        level: "info",
        target: targetName,
        message: `Waiting ${Math.max(0, Math.round(waitMs / 1000))}s for timestamp ${trigger.value}...`,
      });
      if (waitMs <= 0) return;
      return new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    case "pollContract": {
      logEvent({
        level: "info",
        target: targetName,
        message: `Polling ${trigger.method} until it returns true...`,
      });
      const iface = new (await import("ethers")).Interface([`function ${trigger.method} view returns (bool)`]);
      const fnName = trigger.method.split("(")[0];
      return new Promise((resolve) => {
        const check = async () => {
          try {
            const data = iface.encodeFunctionData(fnName, []);
            const result = await provider.call({ to: target.contractAddress, data });
            const [isActive] = iface.decodeFunctionResult(fnName, result);
            if (isActive) {
              resolve();
              return;
            }
          } catch (err) {
            logEvent({
              level: "warn",
              target: targetName,
              message: `pollContract check failed: ${err.message}`,
            });
          }
          setTimeout(check, trigger.intervalMs ?? 500);
        };
        check();
      });
    }

    default:
      throw new Error(`Unknown trigger mode: ${trigger.mode}`);
  }
}
