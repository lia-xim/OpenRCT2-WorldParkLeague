import { DEFAULT_MONTHS, DEFAULT_SEEDS, runBalanceAnalysis } from "./balance-shared";

function readIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function main(): void {
  const payload = runBalanceAnalysis({
    months: readIntegerEnv("BALANCE_MONTHS", DEFAULT_MONTHS),
    seeds: readIntegerEnv("BALANCE_SEEDS", DEFAULT_SEEDS),
  });

  console.log(JSON.stringify(payload, null, 2));
}

main();
