/**
 * Validates docker-compose.prod.yml using .env.production.example values.
 * Usage: node scripts/validate-docker-compose.mjs
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const example = resolve(root, ".env.production.example");
const tempEnv = resolve(root, ".env.docker-validate.tmp");

if (!existsSync(example)) {
  console.error("Missing .env.production.example");
  process.exit(1);
}

let content = readFileSync(example, "utf8");
content = content
  .replace(/REPLACE_WITH_STRONG_PASSWORD/g, "docker_validate_pg_pass_32chars_min")
  .replace(/REPLACE_WITH_STRONG_REDIS_PASSWORD/g, "docker_validate_redis_pass")
  .replace(/REPLACE_WITH_64_CHAR_RANDOM_SECRET/g, "a".repeat(64))
  .replace(/REPLACE_WITH_RANDOM_SECRET/g, "webhook_secret_for_docker_validate_32")
  .replace(/REPLACE_WITH_SETUP_TOKEN/g, "setup_token_for_docker_validate")
  .replace(/REPLACE_WITH_EVOLUTION_KEY/g, "evolution_key_for_docker_validate");

writeFileSync(tempEnv, content, "utf8");

try {
  const out = execSync("docker compose -f docker-compose.prod.yml --env-file .env.docker-validate.tmp config", {
    cwd: root,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  });
  console.log(JSON.stringify({ status: "PASS", services: (out.match(/^\s{2}\w+/gm) ?? []).length }, null, 2));
} catch (error) {
  const err = error;
  console.log(
    JSON.stringify(
      {
        status: "FAIL",
        stderr: err.stderr?.toString() ?? err.message
      },
      null,
      2
    )
  );
  process.exit(1);
} finally {
  if (existsSync(tempEnv)) unlinkSync(tempEnv);
}
