/**
 * Inicia API (build de producao) + Web (next start) sem pnpm dev.
 */
const { spawn } = require("child_process");
const { existsSync } = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const serverEntry = path.join(root, "apps", "server", "dist", "server.mjs");
const webBuild = path.join(root, "apps", "web", ".next");

if (!existsSync(serverEntry)) {
  console.error("[atlas] Execute `pnpm build` antes de `pnpm start`.");
  process.exit(1);
}
if (!existsSync(webBuild)) {
  console.error("[atlas] Build do web ausente. Execute `pnpm build`.");
  process.exit(1);
}

process.env.NODE_ENV = process.env.NODE_ENV || "production";

function log(event, detail = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", event, ...detail }));
}

function spawnNamed(name, command, args, cwd) {
  log("process_start", { name, command, cwd });
  const child = spawn(command, args, {
    cwd,
    shell: true,
    stdio: "inherit",
    env: { ...process.env }
  });
  child.on("exit", (code) => {
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", event: "process_exit", name, code }));
    process.exit(code ?? 1);
  });
  return child;
}

spawnNamed("atlas-api", "node", ["dist/server.mjs"], path.join(root, "apps", "server"));

setTimeout(() => {
  spawnNamed("atlas-web", "pnpm", ["start"], path.join(root, "apps", "web"));
}, 4000);

log("production_starting", { nodeEnv: process.env.NODE_ENV });
