/**
 * Policy-as-code for bag-work content — the equivalent of mint-agent's
 * policyGuard.js, applied to public posts instead of transactions. The
 * single most important thing this enforces: every post discloses that
 * the poster holds a position in the project it's about. Undisclosed
 * promotion of something you're financially invested in is exactly the
 * "touting" pattern securities law (and basic honesty) requires
 * disclosure for — this file makes that disclosure structurally
 * impossible to skip, rather than trusting every draft to remember it.
 *
 * This is a deterministic first pass, not a substitute for the
 * marketing-compliance agent's (or a human's) actual judgment — the
 * banned-phrase list below is illustrative, not exhaustive. Treat a
 * clean result as "nothing obviously wrong," not "guaranteed fine."
 */

const PLATFORM_MAX_LENGTH = { x: 280, discord: 2000 };

// Illustrative, not exhaustive — patterns that turn "enthusiastic community
// content" into "undisclosed promotion of guaranteed/risk-free returns,"
// which is the specific thing disclosure + this guard exist to prevent.
const BANNED_PATTERNS = [
  { pattern: /guarantee[sd]?\s+(a\s+)?(profit|return|gain|win)/i, reason: "implies a guaranteed financial return" },
  { pattern: /\bcan'?t\s+lose\b/i, reason: "implies riskless investment, which no crypto asset is" },
  { pattern: /\brisk[- ]?free\b/i, reason: "implies riskless investment, which no crypto asset is" },
  { pattern: /\b\d+x\s+(guaranteed|guarantee|confirmed)\b/i, reason: "implies a guaranteed return multiple" },
  { pattern: /will\s+(definitely\s+)?(100x|1000x|moon|hit\s+\$)/i, reason: "states a future price outcome as certain fact" },
  { pattern: /\bthis\s+is\s+financial\s+advice\b/i, reason: "explicitly claims to be financial advice" },
  { pattern: /\bact\s+now\s+or\s+(miss\s+out|regret)/i, reason: "high-pressure urgency tactic paired with a financial ask" },
];

export function checkCompliance(item) {
  const violations = [];

  if (!item.body || typeof item.body !== "string" || item.body.trim().length === 0) {
    violations.push("body: must be a non-empty string");
  }

  if (!item.disclosure || typeof item.disclosure !== "string" || item.disclosure.trim().length === 0) {
    violations.push("disclosure: must be a non-empty string — every post must disclose the financial position being promoted");
  } else if (!/\b(hold|holds|holding|position|invested)\b/i.test(item.disclosure) && !/\b(we|i|team)\s+owns?\b/i.test(item.disclosure)) {
    violations.push(
      'disclosure: doesn\'t read like an actual disclosure of a financial position (expected language like "holds", "position", "invested") — check it says something concrete, not just a vague disclaimer'
    );
  }

  const assembled = [item.body, item.disclosure].filter(Boolean).join("\n\n");
  for (const { pattern, reason } of BANNED_PATTERNS) {
    if (pattern.test(assembled)) {
      violations.push(`content matches a banned pattern (${pattern}): ${reason}`);
    }
  }

  const maxLength = PLATFORM_MAX_LENGTH[item.platform];
  if (maxLength == null) {
    violations.push(`platform: must be one of ${Object.keys(PLATFORM_MAX_LENGTH).join(", ")}`);
  } else if (assembled.length > maxLength) {
    violations.push(`assembled post (body + disclosure) is ${assembled.length} chars, over the ${maxLength}-char limit for "${item.platform}"`);
  }

  return { violations, ok: violations.length === 0, assembled };
}

/**
 * The hard gate before anything is allowed to actually broadcast
 * (dryRun:false). Dry-run previews are allowed to show violations —
 * that's how you find out what to fix — but a real post is refused
 * outright if this throws.
 */
export function assertReadyToPost(item) {
  const { violations, ok } = checkCompliance(item);
  if (!ok) {
    throw new Error(`Content fails compliance check, refusing to post:\n  - ${violations.join("\n  - ")}`);
  }
  if (item.complianceApproved !== true) {
    throw new Error(
      "complianceApproved is not explicitly true — a human (or the marketing-compliance agent, with a human treating its sign-off as real review) must approve a draft before it can go live. This is separate from dryRun and isn't satisfied just by passing the automated checks above."
    );
  }
  if (typeof item.dryRun !== "boolean") {
    throw new Error("dryRun must be explicitly true or false, not left unset.");
  }
}
