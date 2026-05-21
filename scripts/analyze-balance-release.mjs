import { build } from "esbuild";
import { execFileSync } from "node:child_process";

const outfile = "dist/balance-lab.cjs";

await build({
  entryPoints: ["scripts/balance-lab.ts"],
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
    BALANCE_LAB_WORKERS: process.env.BALANCE_LAB_WORKERS ?? "20",
    BALANCE_LAB_COARSE_MONTHS: process.env.BALANCE_LAB_COARSE_MONTHS ?? "36",
    BALANCE_LAB_COARSE_SEEDS: process.env.BALANCE_LAB_COARSE_SEEDS ?? "8",
    BALANCE_LAB_TOP: process.env.BALANCE_LAB_TOP ?? "6",
    BALANCE_LAB_REFINE_MONTHS: process.env.BALANCE_LAB_REFINE_MONTHS ?? "72",
    BALANCE_LAB_REFINE_SEEDS: process.env.BALANCE_LAB_REFINE_SEEDS ?? "24",
  },
});

process.stdout.write(output);
