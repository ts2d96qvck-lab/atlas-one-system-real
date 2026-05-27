const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const webNext = path.join(root, "apps", "web", ".next");

function run(label, command, args, options = {}) {
  console.log(`\n[redeploy:web] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    ...options
  });
  if (result.status !== 0) {
    console.error(`[redeploy:web] failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

run("stop atlas-web", "pm2", ["stop", "atlas-web"], { stdio: "inherit" });

if (fs.existsSync(webNext)) {
  fs.rmSync(webNext, { recursive: true, force: true });
}

run("build web", "corepack", ["pnpm", "--filter", "@atlas-one/web", "build"]);
run("restart atlas-web", "pm2", ["restart", "atlas-web", "--update-env"]);

console.log("\n[redeploy:web] OK — http://localhost:3001");
