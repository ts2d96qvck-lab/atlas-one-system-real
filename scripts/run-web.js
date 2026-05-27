const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const cwd = path.join(__dirname, "..", "apps", "web");
const buildId = path.join(cwd, ".next", "BUILD_ID");
const prerenderManifest = path.join(cwd, ".next", "prerender-manifest.json");
const forceDev = process.env.ATLAS_WEB_MODE === "dev";
const forceStart = process.env.ATLAS_WEB_MODE === "start" || process.env.NODE_ENV === "production";
const hasBuild = fs.existsSync(buildId) && fs.existsSync(prerenderManifest);
const useStart = forceStart && hasBuild && !forceDev;
const nextBin = path.join(cwd, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");

if (forceStart && !hasBuild && !forceDev) {
  console.error("[atlas-web] Build incompleto. Rode: corepack pnpm --filter @atlas-one/web build");
  process.exit(1);
}

const child =
  useStart && fs.existsSync(nextBin)
    ? spawn(`"${nextBin}"`, ["start", "-H", "0.0.0.0", "-p", "3001"], {
        cwd,
        shell: true,
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "production" }
      })
    : spawn("corepack", ["pnpm", "run", "dev"], {
        cwd,
        shell: true,
        stdio: "inherit",
        env: process.env
      });

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", () => process.exit(1));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
