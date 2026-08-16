# Mint Execution Agent

A fast, multi-wallet NFT minting engine for EVM chains (built/tested for Abstract, works on any EVM chain). This is the working implementation behind the `mint-execution` subagent in `.claude/agents/`.

## Finding and scoping new mint targets

Don't hand-fill `approved-mints.json` entries from memory or a single tweet. The `mint-intelligence` subagent (`.claude/agents/mint-intelligence.md`) researches a target mint across multiple independent sources — the project's own site, the chain's official docs, its block explorer, NFT drop calendars, launchpads — and drafts a confidence-graded entry into `approved-mints.example.json` with a `_verification` block documenting exactly what it confirmed, what it didn't, and what a human needs to check before the entry is trustworthy. It never sets `dryRun: false`, never touches `wallets.json`, and never guesses a truncated contract address or an unconfirmed mint function — those come back explicitly flagged as unresolved rather than filled in with a plausible guess.

Run `node src/validateTarget.js approved-mints.example.json` after any new draft — it checks structure (valid address format, required fields, `dryRun` still `true`) and warns on anything under-documented, before a human even opens the file to review it.

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

## Unattended mode (`watch`)

`node src/index.js run <target>` requires a PowerShell window open at the moment you want it running — fine for one drop you're watching live, tedious if you want to set something up ahead of time and walk away. `watch` mode fixes that:

```bash
node src/index.js watch
```

This stays running indefinitely, re-reading `approved-mints.json` every 15 seconds, and automatically launches any target that has `"watchEnabled": true` set — exactly once, ever, even across restarts (it tracks what's already fired in `state/watch-state.json`, so a crash, a reboot, or Task Scheduler re-launching it doesn't cause a duplicate mint attempt). Once a target is picked up, its own `trigger` still governs exactly when it actually fires — `watch` just removes the need for you to be the one who types the command at the right moment.

**`watchEnabled` is a separate, deliberate opt-in per target** — it does not bypass `dryRun` or `acknowledgeMultiWalletAllowlist`, which still work exactly as documented above. Setting `watchEnabled: true` means "launch this without me being here"; it does not mean "skip the other safety checks." Set it only once you've actually reviewed a target, the same way you'd treat `acknowledgeMultiWalletAllowlist`.

To keep it running unattended on Windows without a PowerShell window staying open:

1. Open Task Scheduler → Create Task.
2. **General** tab: name it (e.g. "Mint Agent Watcher"), and check "Run whether user is logged on or not" if you want it to survive a logout — otherwise "Run only when user is logged on" is simpler and sufficient for staying alive across screen lock/sleep.
3. **Triggers** tab: "At log on" (or "At startup" for the logged-on-or-not option above).
4. **Actions** tab: Action = "Start a program". Program: `node`. Arguments: `src/index.js watch`. Start in: the full path to your `mint-agent` folder (e.g. `C:\Users\Bomani's PC\Documents\Claude Cowork\OUTPUTS\AI agent Crypto company\mint-agent`).
5. Save. It'll launch automatically next time you log in, or start it once by hand from PowerShell to begin immediately.

Check `logs/mint-log.jsonl` any time to see what the watcher has done — every launch it makes logs an explicit "Watch: launching..." line before that target's own run output, so the audit trail makes clear a run was watcher-initiated rather than manually triggered.

## Diagnostic bridge (optional)

Claude's own sandbox and the device-bridge VM it can reach on your machine both have restricted network access — neither can call a live RPC endpoint directly. `bridge/watch-bridge.ps1` closes that gap for read-only diagnostics only, so Claude can hand you a result (e.g. "here's what `inspectDrop.js` says about this target right now") without you typing the command yourself.

How it works: you start the watcher once —

```powershell
powershell -ExecutionPolicy Bypass -File bridge\watch-bridge.ps1
```

— and it polls `bridge/requests/` for small JSON request files, runs the named script, and writes the result to `bridge/responses/`. Claude drops the request file and reads the response file, both through the same file-delivery mechanism used everywhere else in this project; it never gets a shell on your machine.

**Hard safety boundary, enforced in the script itself, not just described here:** it will only ever run a script from a fixed allowlist — currently `inspectDrop.js` and `validateTarget.js`, both read-only. `index.js` (`run`/`watch`) is permanently excluded, so nothing reachable through this bridge can ever broadcast a transaction, touch `wallets.json`, or flip `dryRun`, no matter what a request file asks for. Every request and response is appended to `bridge/bridge-log.jsonl` for a full record. Stop it any time with Ctrl+C — nothing is lost, and it picks back up wherever it left off next time you start it.

This is entirely optional — everything in this repo works the same without it. Skip it if you'd rather just run diagnostic commands yourself when asked.

## Audit trail

Every run — dry or live — appends a structured entry to `logs/mint-log.jsonl`: target, wallet, timestamp, simulated/sent, tx hash if sent, gas used, and outcome. This is the Audit & Evidence Agent's raw material; don't delete or hand-edit this file.

## Cost/risk controls

- `maxGasPriceGwei` is a hard ceiling — the tool will skip a wallet's transaction rather than send above it.
- `valueEth` × number of wallets is your total capital at risk for that run; there's no company-wide spend cap enforced by this tool alone, so size `walletsToUse` deliberately. A future version should read a per-run cap from the Treasury Ops Agent's approved budget rather than trusting the config file alone — noted as a next step, not yet built.
