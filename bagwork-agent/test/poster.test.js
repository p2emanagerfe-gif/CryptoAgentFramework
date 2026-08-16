// End-to-end smoke test: real HTTP requests (to local mock servers), real
// OAuth1 signing, real compliance-gate enforcement — the only thing mocked
// is the actual X/Discord endpoints. Run after starting test/mock-social-api.cjs:
//   node test/mock-social-api.cjs &
//   BAGWORK_TEST_X_API_URL=http://127.0.0.1:8601/2/tweets \
//   X_API_KEY=k X_API_SECRET=s X_ACCESS_TOKEN=t X_ACCESS_TOKEN_SECRET=ts \
//   DISCORD_WEBHOOK_URL=http://127.0.0.1:8602/webhook \
//   node test/poster.test.js
import assert from "node:assert/strict";
import { postItem } from "../src/poster.js";

function run(name, fn) {
  return fn()
    .then(() => console.log(`PASS: ${name}`))
    .catch((err) => {
      console.error(`FAIL: ${name} — ${err.message}`);
      process.exitCode = 1;
    });
}

async function getInspection() {
  const res = await fetch("http://127.0.0.1:8603");
  return res.json();
}

const cleanItem = {
  project: "gogh-punks",
  type: "meme",
  platform: "x",
  body: "me refreshing the mint page every 30 seconds",
  disclosure: "Disclosure: we hold Gogh Punks NFTs. Not financial advice.",
  complianceApproved: true,
  dryRun: true,
};

async function main() {
  await run("dry run never hits the network, even for otherwise-postable content", async () => {
    const before = await getInspection();
    const result = await postItem("test-dry", cleanItem);
    const after = await getInspection();
    assert.equal(result.status, "dry-run-ok");
    assert.equal(after.x.length, before.x.length, "dry run must not send a real request");
  });

  await run("dry run reports compliance violations without posting", async () => {
    const badItem = { ...cleanItem, body: "this guarantees a profit" };
    const before = await getInspection();
    const result = await postItem("test-dry-bad", badItem);
    const after = await getInspection();
    assert.equal(result.status, "dry-run-ok");
    assert.equal(result.ok, false);
    assert.ok(result.violations.length > 0);
    assert.equal(after.x.length, before.x.length);
  });

  await run("real post is refused if complianceApproved is false, even with dryRun:false", async () => {
    const before = await getInspection();
    const result = await postItem("test-unapproved", { ...cleanItem, dryRun: false, complianceApproved: false });
    const after = await getInspection();
    assert.equal(result.status, "refused");
    assert.equal(after.x.length, before.x.length);
  });

  await run("real post is refused if content fails compliance, even with complianceApproved:true", async () => {
    const before = await getInspection();
    const result = await postItem("test-noncompliant", {
      ...cleanItem,
      dryRun: false,
      complianceApproved: true,
      body: "risk-free, can't lose, guaranteed profit",
    });
    const after = await getInspection();
    assert.equal(result.status, "refused");
    assert.equal(after.x.length, before.x.length);
  });

  await run("a clean, approved, non-dry-run item actually posts to X (mock)", async () => {
    const before = await getInspection();
    const result = await postItem("test-real-x", { ...cleanItem, dryRun: false });
    const after = await getInspection();
    assert.equal(result.status, "posted");
    assert.equal(after.x.length, before.x.length + 1);
    const lastReq = after.x[after.x.length - 1];
    assert.ok(lastReq.headers.authorization.startsWith("OAuth "));
    assert.ok(lastReq.body.text.includes("Disclosure: we hold Gogh Punks NFTs"), "disclosure must actually be in the posted text");
  });

  await run("a clean, approved, non-dry-run item actually posts to Discord (mock)", async () => {
    const before = await getInspection();
    const result = await postItem("test-real-discord", { ...cleanItem, platform: "discord", dryRun: false });
    const after = await getInspection();
    assert.equal(result.status, "posted");
    assert.equal(after.discord.length, before.discord.length + 1);
    const lastReq = after.discord[after.discord.length - 1];
    assert.ok(lastReq.body.content.includes("Disclosure: we hold Gogh Punks NFTs"));
  });

  await run("dry run with a mediaFile that exists reports it as found, no upload attempted", async () => {
    const before = await getInspection();
    const result = await postItem("test-dry-media", { ...cleanItem, mediaFile: "test/fixtures/test-image.png" });
    const after = await getInspection();
    assert.equal(result.status, "dry-run-ok");
    assert.equal(result.mediaFile, "test/fixtures/test-image.png");
    assert.equal(after.xMedia.length, before.xMedia.length, "dry run must not upload media either");
  });

  await run("real post with mediaFile is refused before any network call if the file doesn't exist", async () => {
    const before = await getInspection();
    const result = await postItem("test-real-missing-media", { ...cleanItem, dryRun: false, mediaFile: "test/fixtures/does-not-exist.png" });
    const after = await getInspection();
    assert.equal(result.status, "refused");
    assert.equal(after.x.length, before.x.length);
    assert.equal(after.xMedia.length, before.xMedia.length);
  });

  await run("a clean, approved, non-dry-run item with a mediaFile uploads it to X and attaches the media_id", async () => {
    const before = await getInspection();
    const result = await postItem("test-real-x-media", { ...cleanItem, dryRun: false, mediaFile: "test/fixtures/test-image.png" });
    const after = await getInspection();
    assert.equal(result.status, "posted");
    assert.equal(result.mediaId, "mock-media-id-456");
    assert.equal(after.xMedia.length, before.xMedia.length + 1, "media must actually be uploaded first");
    const mediaReq = after.xMedia[after.xMedia.length - 1];
    assert.ok(mediaReq.headers.authorization.startsWith("OAuth "), "media upload must be OAuth1-signed");
    const mediaPart = mediaReq.parts.find((p) => p.name === "media");
    assert.ok(mediaPart, "multipart body must contain a 'media' part");
    assert.equal(mediaPart.contentType, "image/png");
    assert.ok(mediaPart.dataLength > 0, "uploaded media must actually carry image bytes");
    const tweetReq = after.x[after.x.length - 1];
    assert.deepEqual(tweetReq.body.media, { media_ids: ["mock-media-id-456"] }, "tweet body must reference the uploaded media_id");
  });

  await run("a clean, approved, non-dry-run item with a mediaFile posts a multipart request to Discord with the file attached", async () => {
    const before = await getInspection();
    const result = await postItem("test-real-discord-media", {
      ...cleanItem,
      platform: "discord",
      dryRun: false,
      mediaFile: "test/fixtures/test-image.png",
    });
    const after = await getInspection();
    assert.equal(result.status, "posted");
    assert.equal(after.discord.length, before.discord.length + 1);
    const lastReq = after.discord[after.discord.length - 1];
    assert.equal(lastReq.multipart, true, "a mediaFile post to Discord must be multipart, not plain JSON");
    assert.ok(lastReq.body.content.includes("Disclosure: we hold Gogh Punks NFTs"));
    assert.ok(lastReq.file, "multipart request must include a file part");
    assert.equal(lastReq.file.contentType, "image/png");
    assert.ok(lastReq.file.dataLength > 0, "attached file must actually carry image bytes");
  });
}

main();
