import path from "node:path";
import { loadQueue, getItem, saveQueue } from "./config.js";
import { checkCompliance } from "./complianceGuard.js";
import { postItem } from "./poster.js";
import { generateMemeImage } from "./imagegen.js";
import { logEvent } from "./logger.js";

const [, , command, itemId, ...rest] = process.argv;

function usage() {
  console.log("Usage:");
  console.log("  node src/index.js list                              List all content-queue items and their status.");
  console.log("  node src/index.js check <item-id>                   Run the compliance check and print violations (no posting).");
  console.log("  node src/index.js post <item-id>                    Post one item. Respects that item's own \"dryRun\" flag.");
  console.log("  node src/index.js generate-image <item-id> [prompt] Generate a meme image via Grok (xAI) and attach it as mediaFile.");
  console.log("                                                       Uses the item's mediaConcept as the prompt if none is given.");
}

if (command === "list") {
  const queue = loadQueue();
  for (const [id, item] of Object.entries(queue)) {
    if (id === "_comment") continue;
    const { ok } = checkCompliance(item);
    console.log(
      `${id}  [${item.project}/${item.type}/${item.platform}]  dryRun=${item.dryRun}  complianceApproved=${item.complianceApproved}  complianceCheck=${ok ? "clean" : "VIOLATIONS"}`
    );
  }
} else if (command === "check") {
  if (!itemId) {
    usage();
    process.exit(1);
  }
  const item = getItem(itemId);
  const { ok, violations, assembled } = checkCompliance(item);
  console.log(`=== ${itemId} ===`);
  console.log(`Assembled post (${assembled.length} chars):\n${assembled}\n`);
  console.log(ok ? "Compliance check: clean." : `Compliance check FAILED:\n  - ${violations.join("\n  - ")}`);
  process.exitCode = ok ? 0 : 1;
} else if (command === "post") {
  if (!itemId) {
    usage();
    process.exit(1);
  }
  const item = getItem(itemId);
  postItem(itemId, item)
    .then((result) => {
      if (result.status !== "posted" && result.status !== "dry-run-ok") {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error(`Post aborted: ${err.message}`);
      process.exitCode = 1;
    });
} else if (command === "generate-image") {
  if (!itemId) {
    usage();
    process.exit(1);
  }
  const queue = loadQueue();
  const item = getItem(itemId);
  const prompt = rest.length > 0 ? rest.join(" ") : item.mediaConcept;
  if (!prompt) {
    console.error(`Refusing: item "${itemId}" has no mediaConcept and no prompt was given on the command line.`);
    process.exit(1);
  }

  const outputPath = path.join("media", `${itemId}.png`);
  generateMemeImage({ prompt, outputPath })
    .then(({ bytes }) => {
      queue[itemId].mediaFile = outputPath.split(path.sep).join("/");
      saveQueue(queue);
      logEvent({
        level: "info",
        item: itemId,
        message: `Generated image via Grok (${bytes} bytes) -> ${outputPath}. Set as mediaFile on content-queue.json.`,
      });
      console.log(`Saved ${outputPath} (${bytes} bytes) and set it as "${itemId}".mediaFile in content-queue.json.`);
      console.log(`Prompt used: ${prompt}`);
    })
    .catch((err) => {
      logEvent({ level: "error", item: itemId, message: `Image generation failed: ${err.message}` });
      console.error(`Image generation failed: ${err.message}`);
      process.exitCode = 1;
    });
} else {
  usage();
  process.exit(1);
}
