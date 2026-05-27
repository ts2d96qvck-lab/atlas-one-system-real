const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

function run(label, args, cwd = root) {
  console.log(`\n[build] ${label}`);
  const result = spawnSync("corepack", ["pnpm", ...args], {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env
  });
  if (result.status !== 0) {
    console.error(`[build] failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

run("packages/lib", ["--filter", "@atlas-one/lib", "build"]);
run("packages/ui", ["--filter", "@atlas-one/ui", "build"]);
run("server", ["--filter", "@atlas-one/server", "build"]);

console.log("\n[build] web (NODE_ENV=production)");
const webResult = spawnSync("corepack", ["pnpm", "--filter", "@atlas-one/web", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NODE_ENV: "production" }
});
if (webResult.status !== 0) {
  console.error("[build] failed: web");
  process.exit(webResult.status ?? 1);
}

console.log("\n[build] OK — production artifacts ready");
