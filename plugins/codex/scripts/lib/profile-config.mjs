import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Parse TOML with Python's standard library.
export function profileConfigArgs(env = process.env) {
  const profile = env.CODEX_COMPANION_PROFILE;
  if (!profile) return [];
  if (!/^[A-Za-z0-9_-]+$/.test(profile)) throw new Error("Invalid Codex profile name.");
  const file = path.join(env.CODEX_HOME || path.join(os.homedir(), ".codex"), `${profile}.config.toml`);
  const parsed = spawnSync("python3", ["-c", "import json,sys,tomllib; print(json.dumps(tomllib.load(open(sys.argv[1], 'rb'))))", file], {
    env, encoding: "utf8", maxBuffer: 4 * 1024 * 1024
  });
  if (parsed.error || parsed.status !== 0) {
    throw new Error(`Cannot read Codex profile ${file}: requires Python 3.11+ and valid TOML.`);
  }
  const encode = value => {
    if (Array.isArray(value)) return `[${value.map(encode).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).map(([k,v]) => `${JSON.stringify(k)}=${encode(v)}`).join(",")}}`;
    return JSON.stringify(value);
  };
  const args = [];
  const visit = (table, prefix = "") => {
    for (const [key, value] of Object.entries(table)) {
      if (key.includes(".")) throw new Error("Profile override keys cannot contain dots.");
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length) visit(value, fullKey);
      else args.push("-c", `${fullKey}=${encode(value)}`);
    }
  };
  visit(JSON.parse(parsed.stdout));
  return args;
}
