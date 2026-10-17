const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(fetchImpl) {
  let listener, captured=0;
  const sent=[];
  const local={key:'old-openai-key',settings:{model:'gpt-4o-mini'}};
  const session={};
  const store=data=>({get:async()=>({...data}),set:async value=>Object.assign(data,value),setAccessLevel:async()=>{}});
  const c=vm.createContext({AbortSignal,fetch:fetchImpl,
    chrome:{runtime:{id:'test',onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>({ok:true})},
      storage:{local:store(local),session:store(session)},
      tabs:{get:async()=>({url:'https://www.youtube.com/watch?v=test'}),sendMessage:async(tabId,message)=>{sent.push({tabId,message});return {ok:true};},onRemoved:{addListener(){}},onUpdated:{addListener(){}}},
      tabCapture:{getMediaStreamId:async()=>{captured++;return 'stream';}},
      offscreen:{hasDocument:async()=>true}}
  });
  c.importScripts=file=>vm.runInContext(fs.readFileSync(file,'utf8'),c);
  vm.runInContext(fs.readFileSync('background.js','utf8'),c);
  return {local,session,sent,captured:()=>captured,message:m=>new Promise(resolve=>listener(m,{id:'test'},resolve))};
}
test('old OpenAI key is never used to start the DeepSeek pipeline',async()=>{
  const e=setup(async()=>{throw Error('unexpected fetch');});
  e.local.settings.translate=true;
  const result=await e.message({type:'START',tabId:7});
  assert.match(result.message,/DeepSeek API Key/);assert.equal(e.captured(),0);
});
test('recognition-only can start without any API key',async()=>{
  const e=setup(async()=>({ok:true,json:async()=>({status:'ok'})}));
  const result=await e.message({type:'START',tabId:7});
  assert.equal(e.captured(),1);assert.match(result.message,/正在监听/);
});
test('recognition events reach the page as SUBTITLE, not EVENT',async()=>{
  const e=setup(async()=>{throw Error('No network expected');});
  const result=await e.message({type:'EVENT',tabId:7,active:true,translate:false,message:'正在识别日语',ja:'こんにちは'});
  assert.equal(result.ok,true);
  assert.equal(e.sent.length,1);
  assert.equal(e.sent[0].tabId,7);
  assert.equal(e.sent[0].message.type,'SUBTITLE');
  assert.equal(e.sent[0].message.ja,'こんにちは');
  assert.equal(e.sent[0].message.translate,false);
});
test('local health check uses loopback without sending any credentials',async()=>{
  let request;
  const e=setup(async(url,options)=>{request={url,options};return {ok:true,json:async()=>({status:'ok'})};});
  const result=await e.message({type:'CHECK_LOCAL',settings:{localPort:8081}});
  assert.equal(result.ok,true);assert.equal(request.url,'http://127.0.0.1:8081/health');
  assert.equal(request.options.headers,undefined);assert.equal(request.options.redirect,'error');
});
test('local health failure prevents audio capture',async()=>{
  const e=setup(async()=>{throw TypeError('Failed to fetch');});e.session.deepseekKey='deepseek-key';
  const result=await e.message({type:'START',tabId:7});
  assert.match(result.message,/无法连接本地/);assert.equal(e.captured(),0);
});
test('a non-whisper service is rejected even if it responds HTTP 200',async()=>{
  const e=setup(async()=>({ok:true,json:async()=>({hello:'world'})}));
  const result=await e.message({type:'CHECK_LOCAL',settings:{}});
  assert.equal(result.ok,false);assert.match(result.message,/未准备好/);
});
test('stop during local health check cancels pending start before capture',async()=>{
  let ready;
  const e=setup(()=>new Promise(resolve=>ready=resolve));e.session.deepseekKey='deepseek-key';
  const starting=e.message({type:'START',tabId:7});
  await new Promise(resolve=>setImmediate(resolve));
  await e.message({type:'STOP'});
  ready({ok:true,json:async()=>({status:'ok'})});
  const result=await starting;
  assert.match(result.message,/已取消/);assert.equal(e.captured(),0);
});
