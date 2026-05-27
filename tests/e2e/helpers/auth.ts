import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

type TokenCache = {
  demoAgent?: string;
  qaAgent?: string;
  qaAdmin?: string;
  qaSupervisor?: string;
};

const TOKEN_FILE = resolve(process.cwd(), ".qa-tokens.json");

export function getTokens(): TokenCache {
  if (!existsSync(TOKEN_FILE)) {
    throw new Error("Missing .qa-tokens.json — globalSetup did not run");
  }
  return JSON.parse(readFileSync(TOKEN_FILE, "utf8")) as TokenCache;
}

export const API = process.env.QA_API_URL ?? "http://localhost:4000";
