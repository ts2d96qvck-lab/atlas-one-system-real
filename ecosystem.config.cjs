/** PM2 — production uses compiled output (never pnpm dev) */
const path = require("path");
const root = __dirname;
const isProd = process.env.NODE_ENV === "production";

module.exports = {
  apps: [
    {
      name: "atlas-api",
      script: isProd
        ? path.join(root, "apps/server/dist/server.mjs")
        : path.join(root, "scripts/run-api.js"),
      cwd: isProd ? path.join(root, "apps/server") : root,
      autorestart: true,
      max_restarts: 100,
      min_uptime: "10s",
      restart_delay: 3000,
      watch: false,
      windowsHide: true,
      env: { NODE_ENV: "development", ATLAS_WEB_MODE: "dev", QA_BYPASS_RATE_LIMIT: "true", QA_BYPASS_2FA: "true" },
      env_production: { NODE_ENV: "production" }
    },
    {
      name: "atlas-web",
      script: path.join(root, "scripts/run-web.js"),
      cwd: root,
      autorestart: true,
      max_restarts: 100,
      min_uptime: "10s",
      restart_delay: 5000,
      watch: false,
      windowsHide: true,
      env: { NODE_ENV: "development", ATLAS_WEB_MODE: "dev" },
      env_production: { NODE_ENV: "production", ATLAS_WEB_MODE: "start" }
    }
  ]
};
