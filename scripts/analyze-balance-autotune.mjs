import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const outfile = "dist/balance-lab.cjs";
const reportFile = "dist/balance-autotune-latest.json";

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
    BALANCE_LAB_WORKERS: process.env.BALANCE_LAB_WORKERS ?? "3",
    BALANCE_LAB_COARSE_MONTHS: process.env.BALANCE_LAB_COARSE_MONTHS ?? "18",
    BALANCE_LAB_COARSE_SEEDS: process.env.BALANCE_LAB_COARSE_SEEDS ?? "4",
    BALANCE_LAB_TOP: process.env.BALANCE_LAB_TOP ?? "4",
    BALANCE_LAB_REFINE_MONTHS: process.env.BALANCE_LAB_REFINE_MONTHS ?? "36",
    BALANCE_LAB_REFINE_SEEDS: process.env.BALANCE_LAB_REFINE_SEEDS ?? "8",
  },
});

const report = JSON.parse(output);
mkdirSync("dist", { recursive: true });
writeFileSync(reportFile, JSON.stringify(report, null, 2));

const summary = {
  generatedAt: report.generatedAt,
  candidateCount: report.candidateCount,
  workerCount: report.workerCount,
  baseline: {
    candidateId: report.baseline.candidate.id,
    total: report.baseline.objective.total,
    notes: report.baseline.objective.notes,
  },
  best: {
    candidateId: report.best.candidate.id,
    total: report.best.objective.total,
    override: report.best.candidate.override,
    notes: report.best.objective.notes,
  },
  recommendation: report.recommendation,
  savedReport: reportFile,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
