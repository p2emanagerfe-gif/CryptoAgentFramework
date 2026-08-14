# AI Agent Crypto Company — Claude Code project instructions

This repo is the codebase for an autonomous, agent-run company operating in the NFT + DeFi + Web3 gaming space, built on the **AOS (Agent Operating System)** defined in `docs/AOS_Agent_Network_v1.md`. Read that file for the full org chart, permission tiers, and threat model before making structural changes.

## Non-negotiables (apply to every change in this repo)

1. **Policy-first execution** — every non-trivial change should be traceable to an explicit rationale (what problem, what risk).
2. **Separation of duties** — the agent/person who writes a change should not be the only one who reviews it, especially for anything touching contracts, treasury logic, or economy parameters.
3. **Fail-safe defaults** — when uncertain, prefer the safer/reversible option; don't ship one-way-door changes without flagging them explicitly.
4. **No credentials in agent context** — never put private keys, signer credentials, or `.env` secrets in a prompt, commit, or file an agent reads as "content." `.env` is gitignored; keep it that way.

## Subagents

`.claude/agents/` contains 22 role-scoped subagents (Enterprise Orchestrator, Risk Committee, Smart Contract Review, On-chain Analytics, Regulatory Research, Mint Execution, etc.), each with a defined permission tier and tool allowlist. Claude Code loads these automatically. Use them by name for domain-specific work rather than one general prompt — e.g. route contract-review requests to `smart-contract-review`, treasury questions to `treasury-ops` (proposal-only — it has no signing rights), minting work to `mint-execution`, and anything ambiguous through `enterprise-orchestrator` first.

Two agents (`treasury-ops`, `devops-sre`) are intentionally scoped to draft/propose-only because they don't yet have real signer or deploy credentials wired in. Don't expand their tool access without updating their permission tier and adding the corresponding real integration — see docs/AOS_Agent_Network_v1.md Section 5.

`mint-execution` is different from those two: it does have real, working execution code (`mint-agent/`), gated by `approved-mints.json` and defaulting to dry-run. Never generate wallets on the fly for it, never help it route around CAPTCHA/anti-bot checks, and never flip a target to `dryRun: false` without that being a deliberate, reviewed decision — see docs/AOS_Agent_Network_v1.md Section 8 and `mint-agent/README.md`.

`mint-intelligence` researches new mint targets and drafts entries into `approved-mints.example.json` — it never sets `dryRun: false`, never fabricates a contract address or mint function it couldn't verify from multiple independent sources, and never treats X/Twitter alone as verification. Run `mint-agent/src/validateTarget.js` on any new draft before treating it as reviewable. See docs/AOS_Agent_Network_v1.md Section 9.

## Repo structure (grows as the codebase does)

- `.claude/agents/` — subagent definitions (the AOS agent network)
- `docs/` — AOS framework and agent-network spec
- `mint-agent/` — working NFT minting engine (see Section 8 of the spec doc)
- `contracts/` — smart contracts (to be added)
- `backend/` — game/economy backend services (to be added)
- `analytics/` — on-chain analytics and Dune query definitions (to be added)

## Working conventions

- Solidity/contract changes always go through `smart-contract-review` before merge — different reasoning path than whoever wrote the change.
- Economy or tokenomics parameter changes go through `sink-source-simulator` for independent recomputation before `risk-committee` sign-off.
- Regulatory-sensitive claims (token marketing, compliance language) go through `regulatory-research` and `policy-authoring`, never shipped from a first draft.
