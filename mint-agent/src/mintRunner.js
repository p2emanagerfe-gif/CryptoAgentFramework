import { ethers } from "ethers";
import { loadWallets, getTarget } from "./config.js";
import { checkPolicy } from "./policyGuard.js";
import { computeGasParams } from "./gasStrategy.js";
import { waitForTrigger } from "./trigger.js";
import { logEvent, LOG_FILE_PATH } from "./logger.js";

function buildProvider(target) {
  const urls = target.rpcUrls?.length ? target.rpcUrls : [];
  if (urls.length === 0) {
    throw new Error("Target has no rpcUrls configured.");
  }
  // FallbackProvider races/falls back across multiple RPCs for reliability
  // under load — useful during high-traffic mint windows.
  if (urls.length === 1) {
    return new ethers.JsonRpcProvider(urls[0], target.chainId);
  }
  const providers = urls.map((url) => new ethers.JsonRpcProvider(url, target.chainId));
  return new ethers.FallbackProvider(providers.map((p) => ({ provider: p })));
}

async function mintFromWallet({ label, wallet, provider, target, targetName }) {
  const iface = new ethers.Interface([`function ${target.mintFunction}`]);
  const fnName = target.mintFunction.split("(")[0];
  const data = iface.encodeFunctionData(fnName, target.mintArgs ?? []);
  const value = target.valueEth ? ethers.parseEther(String(target.valueEth)) : 0n;

  const txRequest = {
    to: target.contractAddress,
    data,
    value,
  };

  // Pre-flight simulation — never send a transaction we haven't first
  // confirmed won't revert. Failed simulations cost nothing; failed
  // on-chain transactions cost real gas.
  try {
    await provider.call({ ...txRequest, from: wallet.address });
  } catch (err) {
    logEvent({
      level: "error",
      target: targetName,
      wallet: label,
      message: `Simulation reverted, skipping send: ${err.shortMessage ?? err.message}`,
    });
    return { label, status: "simulation-failed", error: err.shortMessage ?? err.message };
  }

  const gasParams = await computeGasParams(provider, target);
  let gasLimit;
  try {
    gasLimit = await provider.estimateGas({ ...txRequest, from: wallet.address });
  } catch (err) {
    logEvent({
      level: "error",
      target: targetName,
      wallet: label,
      message: `Gas estimation failed, skipping send: ${err.shortMessage ?? err.message}`,
    });
    return { label, status: "estimate-failed", error: err.shortMessage ?? err.message };
  }

  const serializableGasParams = Object.fromEntries(
    Object.entries(gasParams).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v])
  );

  if (target.dryRun) {
    logEvent({
      level: "info",
      target: targetName,
      wallet: label,
      message: `DRY RUN — would send tx (gasLimit=${gasLimit}, ${JSON.stringify(serializableGasParams)}). No transaction broadcast.`,
    });
    return { label, status: "dry-run-ok", gasLimit: gasLimit.toString(), gasParams: serializableGasParams };
  }

  const connectedWallet = wallet.connect(provider);
  try {
    const tx = await connectedWallet.sendTransaction({
      ...txRequest,
      gasLimit,
      ...gasParams,
    });
    logEvent({
      level: "info",
      target: targetName,
      wallet: label,
      message: `Sent tx ${tx.hash}, waiting for confirmation...`,
    });
    const receipt = await tx.wait();
    logEvent({
      level: "info",
      target: targetName,
      wallet: label,
      message: `Confirmed in block ${receipt.blockNumber}, status=${receipt.status}`,
    });
    return { label, status: receipt.status === 1 ? "success" : "reverted", txHash: tx.hash };
  } catch (err) {
    logEvent({
      level: "error",
      target: targetName,
      wallet: label,
      message: `Send failed: ${err.shortMessage ?? err.message}`,
    });
    return { label, status: "send-failed", error: err.shortMessage ?? err.message };
  }
}

export async function runMint(targetName) {
  const target = getTarget(targetName);
  const allWallets = loadWallets();
  const walletLabels = target.walletsToUse?.length ? target.walletsToUse : allWallets.map((w) => w.label);
  const resolvedWallets = allWallets.filter((w) => walletLabels.includes(w.label));

  const missing = walletLabels.filter((l) => !resolvedWallets.find((w) => w.label === l));
  if (missing.length > 0) {
    throw new Error(`walletsToUse references unknown wallet label(s): ${missing.join(", ")}`);
  }

  checkPolicy(targetName, target, resolvedWallets);

  logEvent({
    level: "info",
    target: targetName,
    message: `Starting ${target.dryRun ? "DRY RUN" : "LIVE"} run with ${resolvedWallets.length} wallet(s). Log: ${LOG_FILE_PATH}`,
  });

  const provider = buildProvider(target);
  await waitForTrigger(targetName, target, provider);

  const wallets = resolvedWallets.map((w) => ({ label: w.label, wallet: new ethers.Wallet(w.privateKey) }));

  // Parallel submission across wallets — independent nonces per wallet
  // means no coordination needed between them.
  const results = await Promise.allSettled(
    wallets.map(({ label, wallet }) =>
      mintFromWallet({ label, wallet, provider, target, targetName })
    )
  );

  const summary = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { label: wallets[i].label, status: "unhandled-error", error: r.reason?.message }
  );

  logEvent({
    level: "info",
    target: targetName,
    message: `Run complete. ${JSON.stringify(summary)}`,
  });

  return summary;
}
