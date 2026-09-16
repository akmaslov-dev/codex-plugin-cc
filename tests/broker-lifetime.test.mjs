import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {makeTempDir,run} from "./helpers.mjs";
import {installFakeCodex,buildEnv} from "./fake-codex-fixture.mjs";
import {createBrokerEndpoint} from "../plugins/codex/scripts/lib/broker-endpoint.mjs";
import {waitForBrokerEndpoint,sendBrokerShutdown,saveBrokerSession} from "../plugins/codex/scripts/lib/broker-lifecycle.mjs";
import {CodexAppServerClient} from "../plugins/codex/scripts/lib/app-server.mjs";
import {resolveStateDir,saveState} from '../plugins/codex/scripts/lib/state.mjs';
const script=new URL('../plugins/codex/scripts/app-server-broker.mjs',import.meta.url).pathname;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('broker stays alive with a client and exits after idle timeout',async()=>{
 const bin=makeTempDir(),cwd=makeTempDir(),dir=makeTempDir();
 installFakeCodex(bin);
 const endpoint=createBrokerEndpoint(dir);
 const env={...buildEnv(bin),CODEX_COMPANION_BROKER_IDLE_MS:'150'};
 delete env.CODEX_COMPANION_PROFILE;
 const broker=spawn(process.execPath,[script,'serve','--cwd',cwd,'--endpoint',endpoint],{env,stdio:'ignore'});
 let client;
 try{
  assert.equal(await waitForBrokerEndpoint(endpoint,2000),true);
  client=await CodexAppServerClient.connect(cwd,{brokerEndpoint:endpoint,env});
  await delay(350);
  assert.equal(broker.exitCode,null);
  await client.request('account/read',{refreshToken:false});
  await client.close();client=null;
  await delay(500);
  assert.equal(broker.exitCode,0);
  assert.equal(fs.existsSync(endpoint.slice(5)),false);
 }finally{if(client)await client.close();broker.kill('SIGTERM')}
});

test('broker exits when its child app-server dies',async()=>{
 const bin=makeTempDir(),cwd=makeTempDir(),dir=makeTempDir();
 installFakeCodex(bin);
 const fake=path.join(bin,'codex'),pidFile=path.join(dir,'child.pid');
 fs.writeFileSync(fake,fs.readFileSync(fake,'utf8').replace('const fs = require("node:fs");',`const fs = require("node:fs"); fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));`));
 const endpoint=createBrokerEndpoint(dir),env=buildEnv(bin);
 delete env.CODEX_COMPANION_PROFILE;
 const broker=spawn(process.execPath,[script,'serve','--cwd',cwd,'--endpoint',endpoint],{env,stdio:'ignore'});
 try{
  assert.equal(await waitForBrokerEndpoint(endpoint,2000),true);
  process.kill(Number(fs.readFileSync(pidFile,'utf8')),'SIGTERM');
  await delay(500);
  assert.equal(broker.exitCode,1);
  assert.equal(fs.existsSync(endpoint.slice(5)),false);
 }finally{broker.kill('SIGTERM')}
});

test('SessionEnd cleans custom broker and preserves another sessions active ordinary job',async()=>{
 const bin=makeTempDir(),cwd=makeTempDir();
 installFakeCodex(bin);
 const env=buildEnv(bin);delete env.CODEX_COMPANION_PROFILE;
 const brokers=[];
 try{
  for(const profile of [null,'custom']){
   const dir=makeTempDir(),endpoint=createBrokerEndpoint(dir);
   const broker=spawn(process.execPath,[script,'serve','--cwd',cwd,'--endpoint',endpoint],{env,stdio:'ignore'});
   brokers.push({broker,endpoint});
   assert.equal(await waitForBrokerEndpoint(endpoint,2000),true);
   const session={endpoint,pid:broker.pid,sessionDir:dir};
   if(!profile)saveBrokerSession(cwd,session);
   else fs.writeFileSync(path.join(resolveStateDir(cwd),'broker-custom.json'),JSON.stringify(session));
  }
  saveState(cwd,{version:1,config:{stopReviewGate:false},jobs:[{id:'task-other',status:'running',profile:null,sessionId:'other',createdAt:new Date().toISOString()}]});
  const hook=new URL('../plugins/codex/scripts/session-lifecycle-hook.mjs',import.meta.url).pathname;
  const result=run('node',[hook,'SessionEnd'],{cwd,env,input:JSON.stringify({cwd,session_id:'ending'})});
  assert.equal(result.status,0,result.stderr);
  await delay(100);
  assert.equal(brokers[0].broker.exitCode,null);
  assert.equal(brokers[1].broker.exitCode,0);
  assert.equal(fs.existsSync(path.join(resolveStateDir(cwd),'broker-custom.json')),false);
  assert.equal(fs.existsSync(path.join(resolveStateDir(cwd),'broker.json')),true);
 }finally{
  for(const {broker,endpoint} of brokers){await sendBrokerShutdown(endpoint);broker.kill('SIGTERM')}
 }
});

test('SessionEnd never kills an unrelated process referenced by stale broker state',async()=>{
 const cwd=makeTempDir(),dir=makeTempDir();
 const unrelated=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
 try{
  saveBrokerSession(cwd,{endpoint:createBrokerEndpoint(dir),pid:unrelated.pid,pidFile:path.join(dir,'missing.pid'),sessionDir:dir});
  const hook=new URL('../plugins/codex/scripts/session-lifecycle-hook.mjs',import.meta.url).pathname;
  const result=run('node',[hook,'SessionEnd'],{cwd,input:JSON.stringify({cwd,session_id:'ending'})});
  assert.equal(result.status,0,result.stderr);
  await delay(100);
  assert.equal(unrelated.exitCode,null);
  assert.equal(unrelated.signalCode,null);
 }finally{unrelated.kill('SIGTERM')}
});
