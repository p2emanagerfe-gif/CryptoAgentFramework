/**
 * Competitive-but-bounded gas pricing. We prioritize getting into the
 * next block quickly, but never exceed the operator-configured ceiling.
 */
export async function computeGasParams(provider, target) {
  const feeData = await provider.getFeeData();
  const maxGasPriceWei = BigInt(Math.round(target.maxGasPriceGwei * 1e9));
  const multiplier = target.priorityFeeMultiplier ?? 1.2;

  if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
    const boostedPriority = BigInt(
      Math.round(Number(feeData.maxPriorityFeePerGas) * multiplier)
    );
    let maxFeePerGas = feeData.maxFeePerGas + boostedPriority;
    if (maxFeePerGas > maxGasPriceWei) maxFeePerGas = maxGasPriceWei;
    const maxPriorityFeePerGas =
      boostedPriority > maxFeePerGas ? maxFeePerGas : boostedPriority;
    return { type: 2, maxFeePerGas, maxPriorityFeePerGas };
  }

  // Legacy gas market fallback.
  let gasPrice = feeData.gasPrice ?? maxGasPriceWei;
  if (gasPrice > maxGasPriceWei) gasPrice = maxGasPriceWei;
  return { type: 0, gasPrice };
}
