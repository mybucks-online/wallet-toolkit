const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
};

const color = (value, ...codes) =>
  `${codes.join("")}${value}${C.reset}`;

const lines = [
  "",
  color("mybucks.online wallet toolkit", C.bold, C.cyan),
  "",
  color("Available scripts", C.bold, C.green),
  color("-----------------", C.gray),
  color("1) Generate wallets CSV", C.bold, C.yellow),
  `   ${color("node src/generate.js [count] [network]", C.cyan)}`,
  `   ${color("Example:", C.gray)} node src/generate.js 10 polygon > wallets.csv`,
  "",
  color("2) Parse transfer link", C.bold, C.yellow),
  `   ${color("node src/parse.js", C.cyan)}`,
  `   ${color("Example:", C.gray)} node src/parse.js`,
  "",
  color(
    "3) Distribute funds (interactive, one recipient at a time)",
    C.bold,
    C.yellow,
  ),
  `   ${color("node src/distribute.js [network]", C.cyan)}`,
  `   ${color("Example:", C.gray)} node src/distribute.js polygon`,
  "",
  color("4) Convert CSV for disperse.app input", C.bold, C.yellow),
  `   ${color("node src/disperse-input.js <wallets.csv> <amount> [--no-dedupe]", C.cyan)}`,
  `   ${color("Example:", C.gray)} node src/disperse-input.js wallets.csv 0.01 > disperse.txt`,
  "",
  color("Notes", C.bold, C.green),
  color("-----", C.gray),
  "- network default is polygon for generate/distribute",
  "- run commands from project root",
  "- configure .env for distribute.js (FUNDER_*, INFURA_API_KEY where needed)",
  "",
];

process.stdout.write(lines.join("\n"));
