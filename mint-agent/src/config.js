import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadJson(filename, exampleFilename) {
  const filePath = path.join(ROOT, filename);
  if (!existsSync(filePath)) {
    throw new Error(
      `Missing ${filename}. Copy ${exampleFilename} to ${filename} and fill it in before running.`
    );
  }
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

export function loadWallets() {
  const wallets = loadJson("wallets.json", "wallets.example.json");
  return wallets.map((w) => {
    const privateKey = process.env[w.privateKeyEnvVar];
    if (!privateKey) {
      throw new Error(
        `Wallet "${w.label}" references env var ${w.privateKeyEnvVar}, which is not set. ` +
          `Set it in .env or your secret manager — never in wallets.json.`
      );
    }
    return { label: w.label, privateKey };
  });
}

export function loadTargets() {
  return loadJson("approved-mints.json", "approved-mints.example.json");
}

export function getTarget(name) {
  const targets = loadTargets();
  const target = targets[name];
  if (!target) {
    const available = Object.keys(targets).filter((k) => k !== "_comment");
    throw new Error(
      `No target "${name}" in approved-mints.json. Available: ${available.join(", ") || "(none configured)"}`
    );
  }
  return target;
}
