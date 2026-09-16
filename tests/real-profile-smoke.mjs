// Run explicitly: node tests/real-profile-smoke.mjs [profile-name]
import assert from "node:assert/strict";
import { CodexAppServerClient } from "../plugins/codex/scripts/lib/app-server.mjs";
import { profileConfigArgs } from "../plugins/codex/scripts/lib/profile-config.mjs";
const env = {...process.env, CODEX_COMPANION_PROFILE: process.argv[2] || "custom"};
const overrides = profileConfigArgs(env);
const timer = setTimeout(() => { console.error("Profile smoke check timed out"); process.exit(1); }, 20000);
let client;
try {
  client = await CodexAppServerClient.connect(process.cwd(), {disableBroker:true, env});
  const {config} = await client.request("config/read", {includeLayers:false, cwd:process.cwd()});
  for (const key of ["model", "model_reasoning_effort", "model_provider"]) {
    const value = overrides.find(arg => arg.startsWith(key + "="));
    if (value) assert.equal(config[key], JSON.parse(value.slice(key.length + 1)), key);
  }
  const provider = config.model_provider;
  const endpointKey = `model_providers.${provider}.base_url=`;
  const endpoint = overrides.find(arg => arg.startsWith(endpointKey));
  if (endpoint) assert.equal(config.model_providers[provider].base_url, JSON.parse(endpoint.slice(endpointKey.length)));
  console.log(JSON.stringify({model:config.model, effort:config.model_reasoning_effort, provider, mcpCount:Object.keys(config.mcp_servers ?? {}).length}));
} finally {
  if (client) await client.close();
  clearTimeout(timer);
}
