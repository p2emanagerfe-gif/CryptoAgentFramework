# AI company framework

> Premise: **There are no humans. The company is a society of agents.**
> 

> The framework below defines an **Agent Operating System (AOS)**: governance, identity, controls, incentives, and how work flows end‑to‑end for an NFT + DeFi + Web3 gaming company.
> 

---

# 0) Agent Company Operating System (AOS)

## A) Core principles (non-negotiables)

1. **Policy-first execution**: every agent action must reference an explicit policy (security, spend, comms, compliance, product).
2. **Deterministic accountability**: every task has an owner agent, reviewers, and an audit log.
3. **Separation of duties**: no single agent can (a) propose + approve + execute high-risk actions.
4. **Continuous verification**: monitoring agents run continuously; “strategy” is updated by telemetry, not opinions.
5. **Fail-safe defaults**: when uncertain, agents degrade safely (pause contracts, freeze spend, rate-limit rewards, escalate).

## B) Identity, permissions, and keys

- **Agent identity registry**: each agent has a unique ID, role, scope, and allowed tools.
- **Key management**:
    - Multi-sig / MPC for treasury and admin keys
    - Time-locks for upgrades and large transfers
    - Spend limits per agent and per time window
- **Permission tiers** (example)
    - Tier 0: read-only (analytics, research)
    - Tier 1: draft-only (docs, proposals, comms drafts)
    - Tier 2: execute low-risk (support responses, routine ops)
    - Tier 3: execute high-risk with approvals (deploys, treasury moves)
    - Tier 4: emergency powers (security freeze) — tightly scoped + audited

## C) Decision workflow (how the company “decides”)

- **Proposal → Review → Simulation → Approval → Execution → Postmortem**
- Required artifacts for major changes:
    - KPI impact hypothesis
    - Risk assessment
    - Rollback plan
    - Monitoring plan and alert thresholds

## D) Economic budget & attention budget

- **Compute budget**: per-agent tokens/compute quotas; priority queues.
- **Treasury budget**: per-domain allocations; adaptive based on runway + KPIs.
- **Attention budget**: limits on alerts/escalations; reduce noise.

## E) Company-wide scoreboards (always-on)

- Game health: D1/D7/D30 retention, ARPDAU, session length
- Economy health: issuance, sinks, velocity, inflation index, whale concentration
- DeFi health: TVL, liquidation events, oracle deviations, utilization
- NFT health: holder retention, floor/volume, royalty capture, wash-trade signals
- Security health: exploit attempts, anomaly alerts, privileged action counts
- Reputation health: sentiment, scam reports, influencer/creator signals

---

# 1) Enterprise Orchestrator Layer (the “nervous system”)

## 1.1 Enterprise Orchestrator Agent (EOA)

**Role:** routes all work, enforces policies, maintains global priorities, and dispatches multi-agent workflows.

**Key duties**

- Intake triage (requests, alerts, market events)
- Work decomposition into sub-tasks
- Assign owners + reviewers
- Enforce SLAs and escalation rules
- Publish daily/weekly company brief

## 1.2 Governance & Oversight Agents (checks and balances)

- **Policy Authoring Agent** (maintains policies; versioning + change control)
- **Audit & Evidence Agent** (immutable logs, artifacts, compliance packs)
- **Risk Committee Agent** (aggregates risk signals, triggers circuit breakers)
- **Quality Gate Agent** (release readiness, test coverage thresholds)
- **Red Team Agent** (attack simulations: MEV, oracle, bridge, exploit vectors)

---

# 2) Business Function Layer (Web3 gaming + NFT + DeFi)

## 2.1 Strategy & Market Intelligence

- Market Map Agent (chains, competitors, partner landscape)
- Narrative & Positioning Agent (what we stand for; avoids compliance landmines)
- Scenario Planning Agent (bear/base/bull; runway + issuance plans)
- Partnership Targeting Agent (L2s, marketplaces, IP, studios, guilds)

## 2.2 Finance, Accounting & Treasury (Web3-native)

- FP&A Agent (burn/runway, budgets, variance analysis)
- Treasury Ops Agent (rebalancing, stablecoin exposure, yield policy)
- On-chain Reconciliation Agent (tx categorization, accounting entries)
- Token Inventory & Unlock Calendar Agent
- Payments/Offramp Agent (vendors, fiat rails if needed)
- Cost Optimization Agent (infrastructure, audits, tooling)

## 2.3 Legal, Compliance & Policy (Web3)

- Regulatory Research Agent (jurisdiction briefs, change alerts)
- Marketing Compliance Agent (claims, disclosures, prohibited language)
- Contract & Vendor Agent (terms, renewals, obligations)
- Privacy & Data Policy Agent (player data, telemetry, DSAR readiness)
- Litigation/Incident Documentation Agent (timeline, evidence bundles)

## 2.4 Product (Game + Economy + DeFi)

- Player Research Agent (segment insights; web2 vs crypto-native)
- Roadmap & Prioritization Agent (impact/risk/effort scoring)
- Economy Design Agent (sources/sinks, season resets, inflation controls)
- DeFi Product Agent (staking, lending, LP incentives; risk parameters)
- PRD/Spec Agent (requirements, edge cases, acceptance tests)

## 2.5 Engineering / Protocol / Security

- Smart Contract Engineering Agent (implementation)
- Smart Contract Review Agent (patterns, invariants, lint, fuzz tests)
- Audit Prep Agent (scope packs, threat models, test matrices)
- DevOps/SRE Agent (deploys, observability, incident management)
- Security Monitoring Agent (anomalies, key hygiene, SIEM-style alerts)
- Game Backend Agent (services, matchmaking, inventory, anti-cheat hooks)
- Integration Test Agent (end-to-end: game ↔ wallet ↔ contracts)

## 2.6 Game Studio & Live Ops

- Season Planner Agent (calendar, events, drops, tournaments)
- Balance & Meta Analyst Agent (win rates, item utility, economy stress)
- Content Production Coordinator Agent (quests, assets, narrative beats)
- Economy Telemetry Agent (issuance/sinks, exploit detection)
- Winback & Lifecycle Agent (churn prediction, personalized offers)

## 2.7 NFTs, Marketplace & Creator Ecosystem

- Drop Strategy Agent (cadence, scarcity, pricing, utility mapping)
- Metadata & Standards Agent (on-chain/off-chain tradeoffs, permanence)
- Marketplace Ops Agent (listings, royalties, collections QA)
- Creator Program Agent (UGC tooling, affiliate tracking, payouts)
- Anti-Wash-Trade Agent (signals, flags, reporting)

## 2.8 Community, Social, and Reputation

- Community Ops Agent (daily updates, AMAs, moderation planning)
- Moderation & Scam Triage Agent (impersonation, phishing, social monitoring)
- Sentiment & Theme Agent (weekly insights, escalation thresholds)
- Guild/Scholarship Ops Agent (if applicable; controls + fraud checks)
- Crisis Comms Drafting Agent (templates; rapid response playbooks)

## 2.9 Growth Marketing (gaming + web3)

- Content Agent (patch notes, lore, educational content)
- Campaign Agent (season launch playbooks, collabs, acquisition)
- Influencer/Streamer Outreach Agent (fit scoring, negotiations, tracking)
- Performance Marketing Agent (creative testing, channel ROI, CAC/LTV)
- Brand Monitoring Agent (narrative drift, misinformation detection)

## 2.10 Player Support, Trust & Safety, Anti-Cheat

- Support Triage Agent (wallet issues, purchases, recovery)
- Knowledge Base Agent (articles, macros, troubleshooting)
- Anti-Cheat Agent (signals, bans, appeals workflow)
- Fraud & Abuse Agent (chargebacks, exploit abuse, referral fraud)
- Safety Education Agent (proactive scam warnings, in-client nudges)

## 2.11 Data, Analytics, Experimentation

- Experiment Design Agent (A/B, season experiments, economy tests)
- On-chain Analytics Agent (cohorts by wallet behavior, retention, liquidity)
- Forecasting Agent (retention/revenue projections; anomaly detection)
- Dashboard & Reporting Agent (single source of truth; metric definitions)

---

# 3) Specialist Layer (cross-functional “centers of excellence”)

## 3.1 Tokenomics & Economy Governance (the control room)

- Emissions Policy Agent (rules, caps, adaptive controls)
- Sink/Source Simulator Agent (stress tests, inflation warnings)
- Whale & Concentration Monitor (limits, behavior alerts)
- Governance Proposal Agent (if DAO-like governance exists)

## 3.2 Security & Reliability (always-on)

- Threat Modeling Agent (continuous updates)
- MEV/Oracle Risk Agent (depeg/oracle deviation monitoring)
- Upgrade Safety Agent (timelock verification, diff checks)
- Postmortem Agent (RCA, prevention tasks, policy updates)

## 3.3 Partner Integration Office

- Integration Planner Agent (workback plans, dependency tracking)
- Partner KPI Agent (post-launch success metrics)
- Compliance-by-Partner Agent (terms, obligations, brand constraints)

---

# 4) Execution Layer (robots that “do the work”)

These agents execute low-level tasks under strict policies:

- Documentation & SOP Agent
- Ticket Resolution Agent (with guardrails)
- Data Entry/Reconciliation Agent (on-chain categorizations, ledgers)
- Release Notes Agent
- Localization Agent
- Workflow Automation Agent (integrations, scheduled jobs)

---

# 5) Control mechanisms (how an agent-only company stays safe)

## A) Circuit breakers

- Freeze upgrades
- Freeze emissions
- Pause DeFi markets
- Rate-limit rewards
- Block suspicious addresses
- Lock marketplace actions for flagged assets

## B) Approval matrix (examples)

- Treasury transfer > X: requires Treasury Ops + Risk Committee + Audit Agent
- Contract upgrade: requires Review + Quality Gate + Risk Committee + timelock
- Economy parameter changes: requires Simulator + Economy Governance + Live Ops
- Public comms during incident: requires Crisis Comms + Legal/Compliance

## C) Continuous assurance

- Daily “policy compliance” report
- Weekly “security posture” report
- Monthly “economy stability” report with simulations

---

# 6) Recommended “first 20 agents” (MVP agent-only company)

1. Enterprise Orchestrator Agent
2. Policy Authoring Agent
3. Audit & Evidence Agent
4. Risk Committee Agent
5. Security Monitoring Agent
6. Smart Contract Review Agent
7. DevOps/SRE Agent
8. Economy Design Agent
9. Sink/Source Simulator Agent
10. Season Planner Agent
11. Balance & Meta Analyst Agent
12. Player Research Agent
13. On-chain Analytics Agent
14. Treasury Ops Agent
15. Token Inventory & Unlock Calendar Agent
16. Support Triage Agent
17. Moderation & Scam Triage Agent
18. Campaign Agent
19. Marketplace Ops Agent
20. Regulatory Research Agent