import { ethers } from "ethers";
import { getTarget } from "./config.js";

/**
 * Reads a SeaDrop-style target's live public-drop parameters directly
 * from the chain — the same authoritative source mint-intelligence
 * couldn't reach (this sandbox's network is blocked from chain RPCs;
 * yours isn't). Use this whenever a simulation reverts and you need to
 * know WHY rather than guess.
 *
 * NOTE on the PublicDrop struct: field order/types below is SeaDrop
 * v1.0's known layout (mintPrice, startTime, endTime,
 * maxTotalMintableByWallet, feeBps, restrictFeeRecipients) — this is
 * general protocol knowledge, not something re-confirmed field-by-field
 * against this specific contract's source. The script also prints the
 * raw return hex so you can cross-check against Blockscout's own
 * decoded "Read Contract" output for getPublicDrop if anything here
 * looks wrong.
 *
 * Usage: node src/inspectDrop.js <target-name>
 */

const SEADROP_ABI = [
  "function getPublicDrop(address nftContract) view returns (uint80 mintPrice, uint48 startTime, uint48 endTime, uint16 maxTotalMintableByWallet, uint16 feeBps, bool restrictFeeRecipients)",
  "function getFeeRecipientIsAllowed(address nftContract, address feeRecipient) view returns (bool)",
];

async function main() {
  const [, , targetName] = process.argv;
  if (!targetName) {
    console.log("Usage: node src/inspectDrop.js <target-name>");
    process.exit(1);
  }

  const target = getTarget(targetName);
  const nftContract = target.nftContractAddress ?? target.contractAddress;
  const seaDropAddress = target.contractAddress;

  if (!nftContract) {
    console.error(`Target "${targetName}" has no nftContractAddress or contractAddress set.`);
    process.exit(1);
  }

  console.log(`Reading live drop params for ${targetName}`);
  console.log(`  SeaDrop contract: ${seaDropAddress}`);
  console.log(`  NFT contract:     ${nftContract}\n`);

  const provider = new ethers.JsonRpcProvider(target.rpcUrls[0], target.chainId);
  const seaDrop = new ethers.Contract(seaDropAddress, SEADROP_ABI, provider);

  try {
    const drop = await seaDrop.getPublicDrop(nftContract);
    const now = Math.floor(Date.now() / 1000);
    const startTime = Number(drop.startTime);
    const endTime = Number(drop.endTime);

    console.log("=== Live PublicDrop (decoded — verify against Blockscout if in doubt) ===");
    console.log(`  mintPrice:                ${ethers.formatEther(drop.mintPrice)} ETH (raw: ${drop.mintPrice})`);
    console.log(`  startTime:                ${new Date(startTime * 1000).toISOString()} (${startTime})`);
    console.log(`  endTime:                  ${new Date(endTime * 1000).toISOString()} (${endTime})`);
    console.log(`  maxTotalMintableByWallet: ${drop.maxTotalMintableByWallet}`);
    console.log(`  feeBps:                   ${drop.feeBps}`);
    console.log(`  restrictFeeRecipients:    ${drop.restrictFeeRecipients}`);
    console.log();
    console.log("=== Sanity checks against your approved-mints.json entry ===");
    console.log(`  Is mint currently open (now between startTime/endTime)? ${now >= startTime && now <= endTime ? "YES" : "NO"}`);
    if (now < startTime) {
      console.log(`    -> Opens in ${Math.round((startTime - now) / 60)} minute(s).`);
    }
    console.log(`  Your configured valueEth (${target.valueEth}) matches live mintPrice? ${
      target.valueEth && ethers.parseEther(String(target.valueEth)) === drop.mintPrice ? "YES" : "NO — MISMATCH"
    }`);

    if (target.mintArgs?.[1]) {
      const feeRecipient = target.mintArgs[1];
      const isAllowed = await seaDrop.getFeeRecipientIsAllowed(nftContract, feeRecipient);
      console.log(`  Your configured feeRecipient (${feeRecipient}) is allowed? ${isAllowed ? "YES" : "NO — NOT ALLOWED"}`);
    }
  } catch (err) {
    console.error("Could not read getPublicDrop — this itself is useful information:");
    console.error(`  ${err.shortMessage ?? err.message}`);
    console.error(
      "This could mean the nftContract has never been registered with this SeaDrop contract, the ABI/struct " +
        "assumed above doesn't match this deployment, or there's a network/RPC issue. Cross-check by reading " +
        "getPublicDrop manually on Blockscout's Read Contract tab for the SeaDrop address."
    );
    process.exitCode = 1;
  }
}

main();
