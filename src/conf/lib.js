import * as readline from "node:readline/promises";

export async function waitForAnyKey(instruction) {
  console.log(instruction);
  const waitHint = "Press any key to continue...";

  if (process.stdin.isTTY) {
    process.stdout.write(`${waitHint} `);
    await new Promise((resolve) => {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once("data", (buffer) => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        const key = buffer.toString();
        if (key === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        }
        process.stdout.write("\n");
        resolve();
      });
    });
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    await rl.question(
      `${waitHint} (stdin is not a TTY — press Enter to continue) `,
    );
  } finally {
    rl.close();
  }
}
