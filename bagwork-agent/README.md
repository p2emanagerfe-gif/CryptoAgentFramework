# Bag-Work Content Agent

Content-creation and real-posting engine for "bag work" — memes and narrative content about projects the company holds a position in. This is the working implementation behind three AOS subagents: `bag-work-meme` and `bag-work-narrative` (draft content), and `marketing-compliance` (reviews it) in `.claude/agents/`.

## Why it's built this way

Promoting something you're financially invested in without saying so is undisclosed touting — the exact pattern securities regulators (and basic honesty) require disclosure for. This tool makes that structurally hard to skip rather than trusting every draft to remember it:

- Every content item requires a non-empty, substantive `disclosure` field (checked against actual disclosure language, not just any non-empty string), and it's concatenated into the literal text that gets posted — the disclosure ships with the post, not just in internal metadata.
- `complianceGuard.js` runs a deterministic pass for guaranteed-return language, "can't lose"/"risk-free" claims, certain-future-price claims, and high-pressure urgency — illustrative, not exhaustive; treat a clean result as "nothing obviously wrong," not "guaranteed fine."
- Nothing posts live until **both** `dryRun: false` **and** `complianceApproved: true` are explicitly set on that item — two independent gates, same spirit as mint-agent's `dryRun` + `acknowledgeMultiWalletAllowlist`. `bag-work-meme` and `bag-work-narrative` never set either themselves; only a human (or `marketing-compliance`, treated as real review) sets `complianceApproved`.

## Setup

```bash
cd bagwork-agent
npm install
cp .env.example .env                          # fill in real values — never commit this file
cp content-queue.example.json content-queue.json
```

### Credentials

- **X (Twitter):** needs a developer app with OAuth 1.0a "Read and Write" permission and Elevated/paid write access, plus an access token + secret for the account you want posting. Set `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` in `.env`.
- **Discord:** a channel webhook URL (Channel Settings → Integrations → Webhooks → New Webhook). Deliberately lower-privilege than a full bot token — it can only post to that one channel. Set `DISCORD_WEBHOOK_URL` in `.env`.

Same rule as mint-agent's wallet keys: these never go in a prompt, a commit, or any file an agent reads as content. `content-queue.json` never holds credentials, only `bagwork-agent/src/poster.js` reads them, and content-drafting agents never import `config.js`'s credential loader.

## Workflow

1. `bag-work-meme` or `bag-work-narrative` drafts an item into `content-queue.json` — `dryRun: true`, `complianceApproved: false`, always.
2. `node src/validateContent.js content-queue.json <item-id>` — structural check, same role as mint-agent's `validateTarget.js`.
3. `node src/index.js check <item-id>` — runs the compliance guard and prints the assembled post + any violations, no posting.
4. `marketing-compliance` (or you) reviews the draft. If it's genuinely fine, a human sets `complianceApproved: true` in `content-queue.json`.
5. `node src/index.js post <item-id>` — with `dryRun` still `true`, this only logs what *would* post. Flip `dryRun` to `false` when you actually want it to go out, and run again.

```bash
node src/index.js list                # every item's project/type/platform + gate status
node src/index.js check gogh-punks-mint-day-meme
node src/index.js post gogh-punks-mint-day-meme
```

## What this is — and isn't

Built for real, working posting — not a mockup. It genuinely calls the X API v2 and a Discord webhook once both gates are open. It's deliberately **not** built to auto-approve its own content, fabricate engagement (no bot accounts, no fake replies, no coordinated amplification — every post goes out as your actual, disclosed account), or post anything a human hasn't had the chance to read first. `complianceApproved` has no "set by agent" path in any of the three system prompts — that boundary is enforced in the prompts, not just in code, the same layered way mint-agent keeps `dryRun`/`acknowledgeMultiWalletAllowlist` as human-only decisions.

## Images

An item can carry an optional `mediaFile` field — a local path to an image (PNG/JPEG/GIF/WebP) to attach to the post, alongside `mediaConcept`'s text description of the idea. If set:

- **X:** the image is uploaded first via X's v1.1 media endpoint (still required — v2 has no upload endpoint of its own; see `src/media.js`), then attached to the v2 tweet by `media_id`.
- **Discord:** the webhook POST switches from plain JSON to multipart, with the image attached as a real file.
- **Dry run** reports whether the file exists on disk (`found` / `WARNING: file not found`) without uploading anything.
- **A real post refuses outright**, before any network call, if `mediaFile` is set but the file doesn't exist — same fail-closed posture as every other gate here.

### Producing an image: Grok (xAI) hookup, or your own

`node src/index.js generate-image <item-id> [prompt]` generates an image via xAI's Grok Imagine API (`https://api.x.ai/v1/images/generations`, model `grok-imagine-image-2.0`) and sets the result as that item's `mediaFile` automatically. If no `prompt` is given on the command line, it uses the item's own `mediaConcept` field as the prompt. Requires `XAI_API_KEY` in `.env` — get one from [console.x.ai](https://console.x.ai) (a paid xAI account with API access; xAI's published starting price is $0.02/image as of 2026-08, billed to your xAI account, not covered by X or Discord credentials).

```bash
node src/index.js generate-image gogh-punks-mint-day-meme
# or override the prompt directly:
node src/index.js generate-image gogh-punks-mint-day-meme "an original flat-illustration meme about..."
```

Implementation: `src/imagegen.js` — a single POST with `response_format: "b64_json"` so the image comes back inline (no second fetch to a temporary URL that could expire before it's saved), decoded and written straight to `media/<item-id>.png`. If xAI's own moderation flags the generation, `generateMemeImage` throws instead of silently returning a partial/blocked result.

**The prompt matters for the same reason the hand-drawn image did.** Never name a real copyrighted meme template ("Distracted Boyfriend"), a real stock photo, or ask for a real/trademarked person or character — describe the scene, characters, and labels generically instead, the same approach `scripts/make_gogh_punks_meme.py` (still in the repo, still usable with no API key or cost) took by hand for the first Gogh Punks image. `bag-work-meme`'s system prompt carries this constraint when it writes a `mediaConcept`/prompt; nothing in `imagegen.js` itself filters prompt content beyond surfacing xAI's own moderation response.

`mediaFile` still just has to point at an image that exists — the Grok hookup is one way to produce that file, not the only one. Attach any other image you already have the rights to use the same way.

## Audit trail

Every check and post — dry or real — appends to `logs/bagwork-log.jsonl`: item id, platform, compliance result, and (for real posts) the platform's response. Don't hand-edit this file.

## Testing

`test/complianceGuard.test.js` — 15 unit tests, no network needed.

`test/poster.test.js` — end-to-end against local mock X/Discord/media servers (`test/mock-social-api.cjs`), covering: dry run never hits the network; a real post is refused if either gate (`complianceApproved`, the compliance check itself) isn't satisfied, even if the other is; a clean, fully-approved item actually posts, with the disclosure verifiably present in what was sent, and the OAuth1 `Authorization` header verifiably attached; a `mediaFile` is uploaded to X and its `media_id` referenced on the tweet, or attached as a real multipart file to Discord; a real post with a missing `mediaFile` is refused before any network call.

`test/imagegen.test.js` — end-to-end against a mock xAI endpoint (also in `test/mock-social-api.cjs`), covering: a real generation call decodes and writes actual image bytes to disk with the right auth header and model/format fields; nothing is written if `XAI_API_KEY` is missing, the API returns a non-2xx status, or xAI's own moderation flags the result.

```bash
node test/mock-social-api.cjs &
BAGWORK_TEST_X_API_URL=http://127.0.0.1:8601/2/tweets \
BAGWORK_TEST_X_MEDIA_URL=http://127.0.0.1:8604/1.1/media/upload.json \
X_API_KEY=k X_API_SECRET=s X_ACCESS_TOKEN=t X_ACCESS_TOKEN_SECRET=ts \
DISCORD_WEBHOOK_URL=http://127.0.0.1:8602/webhook \
node test/poster.test.js

BAGWORK_TEST_XAI_URL=http://127.0.0.1:8606/v1/images/generations \
XAI_API_KEY=test-key \
node test/imagegen.test.js
```

The OAuth1 signing itself (`src/oauth1.js`) was spot-checked against Twitter's own published worked example for percent-encoding correctness — the mock server accepts any signature, so that check happens independent of the test suite above.

## Not yet built

- No image-generation provider other than xAI's Grok — no fallback if xAI's API is down or a project prefers a different model; `imagegen.js`'s prompt-safety framing (describe, don't name real copyrighted templates/people) is enforced by `bag-work-meme`'s system prompt, not by any code-level content filter beyond surfacing xAI's own moderation flag.
- No scheduling/queueing beyond manual `post` calls — no watch-mode equivalent yet. Given the stakes of an autonomous process being able to publish public, disclosed-financial-interest content, that's a deliberate scope decision worth its own conversation before building, not a default extension of mint-agent's `watch` pattern.
- No per-platform character-limit awareness beyond a flat max (280 for X, 2000 for Discord) — doesn't account for X's link-shortening quirks, Discord embeds, or the fact that an attached image doesn't consume any of that text budget.
