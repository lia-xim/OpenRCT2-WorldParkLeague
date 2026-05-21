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
});

process.stdout.write(output);
