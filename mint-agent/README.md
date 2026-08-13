# Mint Execution Agent

A fast, multi-wallet NFT minting engine for EVM chains (built/tested for Abstract, works on any EVM chain). This is the working implementation behind the `mint-execution` subagent in `.claude/agents/`.

## What this is — and isn't

This tool is built for **speed and reliability**, using wallets your company already owns: competitive gas pricing, transaction pre-simulation, multi-RPC fallback, and parallel submission across your configured wallets so you're not manually clicking mint buttons and losing to bots that aren't.

It is deliberately **not** built to:

- Generate throwaway/anonymous wallets to impersonate multiple distinct community members on an allowlist. Every wallet it uses must already exist in `wallets.json`, mapped to a real, funded, company-held address.
- Solve CAPTCHAs, spoof proof-of-humanity checks, or otherwise defeat anti-bot/anti-abuse mechanisms a project has put in place. Those exist specifically to keep tools like this out — if a mint is gated that way, this tool isn't the right fit for it, full stop.
- Run "live" (i.e. actually broadcast transactions) against any target until a human has explicitly flipped `dryRun: false` in `approved-mints.json` for that specific target. Nothing spends real gas or mints anything until that file says so.

## Why it asks about "mint type"

`approved-mints.json` requires you to declare each target as `"public-fcfs"` or `"allowlist"`:

- **`public-fcfs`** — open mints, gas auctions, first-come-first-served. Multiple company wallets racing here isn't taking anything from anyone; it's the same game everyone else is playing, just executed well.
- **`allowlist`** — mints capped at one-per-approved-wallet, where the cap exists specifically to spread allocation across distinct community members. Using more than one company wallet here works mechanically, but goes against the spirit of the limit. If you configure more than one wallet against an allowlist target, the tool requires you to set `"acknowledgeMultiWalletAllowlist": true` on that target — a deliberate speed bump, not a technical restriction, so this is always a conscious call, logged in the audit trail.

This mirrors the AOS's Anti-Wash-Trade / fairness posture elsewhere in the framework — same instinct, applied to mint mechanics.

## Setup

```bash
cd mint-agent
npm install
cp .env.example .env          # fill in real values — never commit this file
cp wallets.example.json wallets.json
cp approved-mints.example.json approved-mints.json
```

### Wallets — how keys are handled

`wallets.json` never contains a private key directly. Each entry maps a human-readable label to the **name of an environment variable** that holds the key:

```json
[
  { "label": "treasury-mint-01", "privateKeyEnvVar": "PK_TREASURY_MINT_01" },
  { "label": "treasury-mint-02", "privateKeyEnvVar": "PK_TREASURY_MINT_02" }
]
```

You then set `PK_TREASURY_MINT_01=0x...` etc. in `.env` (gitignored) or in your OS-level secret manager — never in a file that gets committed, never pasted into a chat session with any agent. The tool refuses to start if a referenced env var is missing.

### Approving a target

Nothing runs until you add an entry to `approved-mints.json`:

```json
{
  "example-drop": {
    "chainId": 2741,
    "rpcUrls": ["https://api.mainnet.abs.xyz"],
    "contractAddress": "0xYourTargetContract",
    "mintFunction": "mint(uint256)",
    "mintArgs": [1],
    "valueEth": "0.01",
    "mintType": "public-fcfs",
    "perWalletLimit": 1,
    "walletsToUse": ["treasury-mint-01", "treasury-mint-02"],
    "acknowledgeMultiWalletAllowlist": false,
    "maxGasPriceGwei": 50,
    "priorityFeeMultiplier": 1.5,
    "trigger": { "mode": "immediate" },
    "dryRun": true
  }
}
```

Run a dry run first — always:

```bash
node src/index.js run example-drop
```

With `dryRun: true`, it connects, loads wallets, simulates the transaction via `estimateGas`/`call`, and logs exactly what it *would* have sent, without broadcasting anything. Review `logs/mint-log.jsonl`, confirm it looks right, then flip `dryRun` to `false` to go live.

## Trigger modes

- `"immediate"` — fires as soon as you run the command.
- `"blockNumber"` — waits for a specific block height (`{ "mode": "blockNumber", "value": 1234567 }`).
- `"timestamp"` — waits for a Unix timestamp (`{ "mode": "timestamp", "value": 1755000000 }`).
- `"pollContract"` — polls a read-only view function until it returns true (`{ "mode": "pollContract", "method": "isMintActive()", "intervalMs": 500 }`).

## Audit trail

Every run — dry or live — appends a structured entry to `logs/mint-log.jsonl`: target, wallet, timestamp, simulated/sent, tx hash if sent, gas used, and outcome. This is the Audit & Evidence Agent's raw material; don't delete or hand-edit this file.

## Cost/risk controls

- `maxGasPriceGwei` is a hard ceiling — the tool will skip a wallet's transaction rather than send above it.
- `valueEth` × number of wallets is your total capital at risk for that run; there's no company-wide spend cap enforced by this tool alone, so size `walletsToUse` deliberately. A future version should read a per-run cap from the Treasury Ops Agent's approved budget rather than trusting the config file alone — noted as a next step, not yet built.
