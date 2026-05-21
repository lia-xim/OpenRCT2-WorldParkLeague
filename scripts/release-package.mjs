import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;
const stageDir = path.join(rootDir, "release", `WorldParkLeague-v${version}`);
const zipPath = path.join(rootDir, "release", `WorldParkLeague-v${version}.zip`);
const checksumPath = `${zipPath}.sha256`;
const pluginSource = path.join(rootDir, "dist", "WorldParkLeague.js");

runBuild();

rmSync(stageDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
rmSync(checksumPath, { force: true });
mkdirSync(stageDir, { recursive: true });

copyFileSync(pluginSource, path.join(stageDir, "WorldParkLeague.js"));
copyFileSync(path.join(rootDir, "README.md"), path.join(stageDir, "README.md"));
copyFileSync(path.join(rootDir, "CHANGELOG.md"), path.join(stageDir, "CHANGELOG.md"));
copyFileSync(path.join(rootDir, "LICENSE"), path.join(stageDir, "LICENSE"));

compressStage(stageDir, zipPath);

const checksum = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
writeFileSync(checksumPath, `${checksum}  ${path.basename(zipPath)}\n`, "utf8");

process.stdout.write(`Release package created:\n- ${zipPath}\n- ${checksumPath}\n`);

function runBuild() {
  execFileSync(process.execPath, [path.join(rootDir, "scripts", "build.mjs")], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

function compressStage(sourceDir, destinationZip) {
  const powershell = process.platform === "win32" ? "powershell" : "pwsh";
  const command =
    `Compress-Archive -Path '${sourceDir}\\*' ` +
    `-DestinationPath '${destinationZip}' -Force`;
  execFileSync(powershell, ["-NoProfile", "-Command", command], {
    cwd: rootDir,
    stdio: "inherit",
  });
}
