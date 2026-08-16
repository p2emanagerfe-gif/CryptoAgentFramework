// End-to-end smoke test against the local mock xAI server. Run after
// starting test/mock-social-api.cjs:
//   node test/mock-social-api.cjs &
//   BAGWORK_TEST_XAI_URL=http://127.0.0.1:8606/v1/images/generations \
//   XAI_API_KEY=test-key \
//   node test/imagegen.test.js
import assert from "node:assert/strict";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { generateMemeImage } from "../src/imagegen.js";

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

const OUT = "test/fixtures/generated-test.png";

async function main() {
  await run("generates an image and writes real bytes to disk", async () => {
    if (existsSync(OUT)) unlinkSync(OUT);
    const before = await getInspection();
    const result = await generateMemeImage({ prompt: "an original flat-illustration meme, no real people or trademarks", outputPath: OUT });
    const after = await getInspection();
    assert.equal(after.xai.length, before.xai.length + 1);
    assert.ok(existsSync(OUT), "output file must exist");
    assert.ok(result.bytes > 0, "must report non-zero bytes written");
    const written = readFileSync(OUT);
    assert.equal(written.length, result.bytes);
    const lastReq = after.xai[after.xai.length - 1];
    assert.equal(lastReq.headers.authorization, "Bearer test-key");
    assert.equal(lastReq.body.model, "grok-imagine-image-2.0");
    assert.equal(lastReq.body.response_format, "b64_json");
    unlinkSync(OUT);
  });

  await run("throws (and writes nothing) if XAI_API_KEY is unset", async () => {
    const savedKey = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    try {
      await assert.rejects(
        () => generateMemeImage({ prompt: "test", outputPath: OUT }),
        /XAI_API_KEY is not set/
      );
      assert.ok(!existsSync(OUT), "must not write a file when the key is missing");
    } finally {
      process.env.XAI_API_KEY = savedKey;
    }
  });

  await run("throws on a non-2xx response from the API", async () => {
    await assert.rejects(
      () => generateMemeImage({ prompt: "TRIGGER_500 please fail", outputPath: OUT }),
      /Grok image generation returned 500/
    );
    assert.ok(!existsSync(OUT), "must not write a file on failure");
  });

  await run("throws if xAI flags the generation via moderation", async () => {
    await assert.rejects(
      () => generateMemeImage({ prompt: "TRIGGER_MODERATION please flag this", outputPath: OUT }),
      /flagged this generation/
    );
    assert.ok(!existsSync(OUT), "must not write a file when moderation-flagged");
  });
}

main();
