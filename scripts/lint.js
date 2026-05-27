const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const filters = ["@atlas-one/lib", "@atlas-one/ui", "@atlas-one/server", "@atlas-one/web"];

for (const filter of filters) {
  const result = spawnSync("corepack", ["pnpm", "--filter", filter, "lint"], {
    cwd: root,
    stdio: "inherit",
    shell: true
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("[lint] OK");
