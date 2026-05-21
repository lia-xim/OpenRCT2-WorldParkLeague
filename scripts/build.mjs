import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/WorldParkLeague.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  charset: "ascii",
  legalComments: "none",
  sourcemap: false,
});
