import { runMint } from "./mintRunner.js";
import { watch } from "./watchRunner.js";

const [, , command, targetName] = process.argv;

function usage() {
  console.log("Usage:");
  console.log("  node src/index.js run <target-name>   Run one target now (waits for its own trigger, then exits).");
  console.log("  node src/index.js watch                Stay running unattended; auto-launches any target with");
  console.log("                                          \"watchEnabled\": true once its trigger fires. Ctrl+C to stop.");
}

if (command === "run") {
  if (!targetName) {
    usage();
    process.exit(1);
  }
  runMint(targetName)
    .then((summary) => {
      const failed = summary.filter((s) => !["success", "dry-run-ok"].includes(s.status));
      if (failed.length > 0) {
        console.error(`${failed.length} wallet(s) did not complete successfully.`);
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error(`Run aborted: ${err.message}`);
      process.exitCode = 1;
    });
} else if (command === "watch") {
  watch().catch((err) => {
    console.error(`Watch mode crashed: ${err.message}`);
    process.exitCode = 1;
  });
} else {
  usage();
  process.exit(1);
}
