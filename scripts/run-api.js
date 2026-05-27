const { spawn } = require("child_process");
const { existsSync } = require("fs");
const path = require("path");

const serverCwd = path.join(__dirname, "..", "apps", "server");
const bundle = path.join(serverCwd, "dist", "server.mjs");
const tsx = path.join(serverCwd, "node_modules", ".bin", "tsx.cmd");
const isProd = process.env.NODE_ENV === "production" && existsSync(bundle);

const child = isProd
  ? spawn("node", ["dist/server.mjs"], {
      cwd: serverCwd,
      shell: true,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" }
    })
  : spawn(`"${tsx}"`, ["src/server.ts"], {
      cwd: serverCwd,
      shell: true,
      stdio: "inherit",
      env: process.env
    });

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", () => process.exit(1));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
