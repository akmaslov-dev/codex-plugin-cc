import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeCodex, buildEnv } from "./fake-codex-fixture.mjs";
import { makeTempDir, run, initGitRepo } from "./helpers.mjs";
import { sendBrokerShutdown } from "../plugins/codex/scripts/lib/broker-lifecycle.mjs";
import { resolveStateDir } from "../plugins/codex/scripts/lib/state.mjs";
const script = new URL("../plugins/codex/scripts/codex-companion.mjs", import.meta.url).pathname;
test("profile selects Codex process, isolates brokers and resume candidates", async () => {
  const bin = makeTempDir();
  const cwd = makeTempDir();
  initGitRepo(cwd);
  installFakeCodex(bin);
  const fake = path.join(bin, "codex");
  fs.renameSync(fake, fake + "-real");
  const log = path.join(bin, "args.jsonl");
  fs.writeFileSync(fake, `#!/usr/bin/env node
const fs = require('node:fs');
const {spawn} = require('node:child_process');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
if(args.includes('--profile')) { console.error('--profile not supported for app-server'); process.exit(1); }\nwhile(args[0] === '-c') args.splice(0, 2);
const p=spawn(${JSON.stringify(fake + "-real")},args,{stdio:'inherit'});
p.on('exit',c=>process.exit(c ?? 1));
`, {mode:0o755});
  const home = makeTempDir();
  for (const profile of ['custom', 'other']) fs.writeFileSync(path.join(home, profile + '.config.toml'), 'model = "profile-' + profile + '"\nmodel_reasoning_effort = "high"\n[model_providers.test]\nbase_url = "https://example.invalid/v1"\n');
  const env = {...buildEnv(bin), CODEX_HOME: home, CODEX_COMPANION_SESSION_ID: "profile-test"};
  delete env.CODEX_COMPANION_PROFILE;
  const invoke = (command, args=[]) => {
    const result = run('node', [script, command, ...args], {cwd, env});
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  try {
    fs.writeFileSync(path.join(cwd, 'sample.txt'), 'base');
    run('git', ['add', '.'], {cwd});
    run('git', ['commit', '-m', 'base'], {cwd});
    fs.writeFileSync(path.join(cwd, 'sample.txt'), 'changed');
    invoke('setup', ['--profile', 'custom', '--json']);
    assert.ok(fs.readFileSync(log,'utf8').split('\n').filter(Boolean).map(JSON.parse).some(a=>a.includes('model="profile-custom"') && a.at(-1) === 'app-server'));
    invoke('setup', ['--profile=other', '--json']);
    invoke('setup', ['--json']);
    invoke('task', ['--profile', 'custom', '--json', 'inspect']);
    invoke('task', ['--profile', 'other', '--json', 'inspect']);
    invoke('task', ['--json', 'inspect']);
    const states = fs.readdirSync(resolveStateDir(cwd)).filter(n=>n.startsWith('broker') && n.endsWith('.json'));
    assert.equal(states.length,3);
    const endpoints=states.map(n=>JSON.parse(fs.readFileSync(path.join(resolveStateDir(cwd),n))).endpoint);
    assert.equal(new Set(endpoints).size,3);
    invoke('task', ['--profile', 'custom', '--json', 'inspect']);
    assert.equal(invoke('task-resume-candidate', ['--profile','custom','--json']).available,true);
    assert.equal(invoke('task-resume-candidate', ['--profile','unused','--json']).available,false);
    invoke('review', ['--profile custom --wait --json']);
    invoke('adversarial-review', ['-p', 'custom', '--wait', '--json', 'check']);
    const invalid=run('node',[script,'setup','--profile','../bad','--json'],{cwd,env});
    assert.notEqual(invalid.status,0);
    assert.match(invalid.stderr,/profile/i);
  } finally {
    for (const n of (fs.existsSync(resolveStateDir(cwd)) ? fs.readdirSync(resolveStateDir(cwd)) : []).filter(n=>n.startsWith('broker') && n.endsWith('.json'))) {
      await sendBrokerShutdown(JSON.parse(fs.readFileSync(path.join(resolveStateDir(cwd),n))).endpoint);
    }
  }
});
