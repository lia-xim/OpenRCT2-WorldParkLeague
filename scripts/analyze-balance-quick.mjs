import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const outfile = "dist/balance-analysis.cjs";
const reportFile = "dist/balance-quick-latest.json";

await build({
  entryPoints: ["scripts/balance-analysis.ts"],
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
    BALANCE_MONTHS: process.env.BALANCE_MONTHS ?? "24",
    BALANCE_SEEDS: process.env.BALANCE_SEEDS ?? "12",
  },
});

mkdirSync("dist", { recursive: true });
writeFileSync(reportFile, output);
process.stdout.write(output);
