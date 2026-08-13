import { runMint } from "./mintRunner.js";

const [, , command, targetName] = process.argv;

if (command !== "run" || !targetName) {
  console.log("Usage: node src/index.js run <target-name>");
  console.log("Target names come from the keys in approved-mints.json.");
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
