const esbuild = require("esbuild");
const path = require("path");

const root = path.join(__dirname, "..");
const entry = path.join(root, "apps/server/src/server.ts");
const outfile = path.join(root, "apps/server/dist/server.mjs");

esbuild.buildSync({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  sourcemap: true,
  logLevel: "info"
});

console.log("[bundle-server] OK -> apps/server/dist/server.mjs");
