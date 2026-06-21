import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const outfile = "dist/balance-difficulty.cjs";
const reportFile = "dist/balance-difficulty-latest.json";

await build({
  entryPoints: ["scripts/balance-difficulty.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile,
  target: ["node20"],
  logLevel: "silent",
});

const output = execFileSync(process.execPath, [outfile], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  env: {
    ...process.env,
    BALANCE_DIFFICULTY_MONTHS: process.env.BALANCE_DIFFICULTY_MONTHS ?? "18",
    BALANCE_DIFFICULTY_SEEDS: process.env.BALANCE_DIFFICULTY_SEEDS ?? "8",
  },
});

mkdirSync("dist", { recursive: true });
writeFileSync(reportFile, output);
process.stdout.write(output);
