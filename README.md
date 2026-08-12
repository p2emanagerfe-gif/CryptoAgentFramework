# AI Agent Crypto Company

An agent-run company (no humans in the operating loop) for the NFT + DeFi + Web3 gaming space, built on the **AOS (Agent Operating System)** — see [`docs/AOS_Agent_Network_v1.md`](docs/AOS_Agent_Network_v1.md) for the full framework: org chart, permission tiers, threat model, and eval requirements.

## What's in this repo right now

- **`.claude/agents/`** — 21 deployable Claude Code subagents covering orchestration, governance, finance, product, engineering/security, live ops, NFT/marketplace, community/trust & safety, growth, data/analytics, and agent QA. Drop-in compatible with [Claude Code](https://docs.claude.com/en/docs/claude-code) — it loads them automatically from this folder.
- **`docs/`** — the full agent-network specification, including a worked live-demo transcript of two of the agents actually collaborating on a real research task.
- **`CLAUDE.md`** — project-level instructions Claude Code reads automatically; defines the non-negotiables and working conventions for this repo.

## Using the agents

With [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and this repo open:

```bash
claude
```

Claude Code will pick up `CLAUDE.md` and the subagents in `.claude/agents/` automatically. Ask for work in plain language and let Claude route it — or address a specific agent by name for domain work (e.g. "have smart-contract-review look at this PR" or "have on-chain-analytics pull ApeChain volume trends").

## Status

Framework/design phase complete for the first 21 agents (MVP). No production code yet — `contracts/`, `backend/`, and `analytics/` are placeholders to be built out next. See Section 6 of the spec doc for the next batch of agents planned (Quality Gate, Red Team, FP&A, Marketing Compliance).
