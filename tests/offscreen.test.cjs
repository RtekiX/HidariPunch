const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(fetchImpl, prepare = async blob => blob) {
  let listener, timer;
  const events=[],recorders=[],requests=[];
  let stopped=0,closed=0;
  const track={stop(){stopped++;}};
  class Recorder {
    constructor(stream,options){this.mimeType=options.mimeType;recorders.push(this);}
    start(){this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable({data:new Blob(['independent-webm'])});this.onstop();}
  }
  const context=vm.createContext({console,Blob,FormData,AbortSignal,AbortController,
    chrome:{runtime:{onMessage:{addListener(fn){listener=fn;}},sendMessage:async m=>events.push(m),id:'test'}},
    navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]})}},
    AudioContext:class{createMediaStreamSource(){return {connect(){}};}async resume(){}async close(){closed++;}},
    MediaRecorder:Recorder,setTimeout(fn){timer=fn;return 1;},clearTimeout(){timer=null;},
    fetch:async(url,options)=>{requests.push({url,options});return fetchImpl(url,options);}
  });
  vm.runInContext(fs.readFileSync('config.js','utf8'),context);
  context.HidariAudio={prepare};
  vm.runInContext(fs.readFileSync('offscreen.js','utf8'),context);
  return {events,recorders,requests,tick:()=>timer(),stopped:()=>stopped,closed:()=>closed,
    message:m=>new Promise(resolve=>listener({target:'offscreen',...m},{id:'test'},resolve))};
}
const start={type:'START',tabId:7,streamId:'stream',key:'test-key',settings:{pipeline:'local-deepseek',translate:true,seconds:3,localPort:8080,model:'deepseek-flash'}};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('records independent segments, transcribes Japanese and emits translated subtitle',async()=>{
  const env=setup(async url=>({ok:true,json:async()=>url.endsWith('inference')?{text:'こんにちは'}:{choices:[{message:{content:'你好'}}]}}));
  assert.equal((await env.message(start)).ok,true);
  env.tick(); await settle();
  assert.equal(env.recorders.length,2);
  assert.equal(env.requests[0].options.body.get('language'),'ja');
  assert.equal(env.requests[0].options.body.get('file').name,'live.wav');
  assert.equal(env.requests[0].url,'http://127.0.0.1:8080/inference');
  assert.equal(env.requests[0].options.headers.Authorization,undefined);
  assert.equal(env.requests[0].options.body.get('translate'),'false');
  assert.equal(env.requests[1].url,'https://api.deepseek.com/chat/completions');
  assert.equal(env.requests[1].options.headers.Authorization,'Bearer test-key');
  assert.equal(JSON.parse(env.requests[1].options.body).thinking.type,'disabled');
  assert.equal(JSON.parse(env.requests[1].options.body).messages[1].content,'こんにちは');
  assert.equal(env.events.at(-1).zh,'你好');
  await env.message({type:'STOP'});
  assert.equal(env.stopped(),1); assert.equal(env.closed(),1);
});
test('stop aborts in-flight request and suppresses late subtitles',async()=>{
  let complete;
  const env=setup(()=>new Promise(resolve=>complete=resolve));
  await env.message(start);env.tick();await settle();
  await env.message({type:'STOP'});
  assert.equal(env.requests[0].options.signal.aborted,true);
  complete({ok:true,json:async()=>({text:'こんにちは'})});await settle();
  assert.equal(env.requests.length,1);
  assert.equal(env.events.some(e=>e.zh),false);
});
test('authentication error stops capture and reports actionable error',async()=>{
  const env=setup(async url=>url.endsWith('inference')?{ok:true,json:async()=>({text:'こんにちは'})}:{ok:false,status:401});
  await env.message(start);env.tick();await settle();
  assert.equal(env.stopped(),1);assert.equal(env.events.at(-1).message,'DeepSeek API Key 无效');
  assert.equal(env.events.at(-1).active,false);
});
test('backlog is bounded while API is slow',async()=>{
  const env=setup(()=>new Promise(()=>{}));
  await env.message(start);
  for(let i=0;i<10;i++) env.tick();
  await settle();
  assert.ok(env.events.some(e=>e.message.includes('跳过过期音频')));
  assert.equal(env.requests.length,1);
  await env.message({type:'STOP'});
});
test('silent chunks never reach local service or DeepSeek',async()=>{
  const env=setup(async()=>{throw Error('must not call');},async()=>null);
  await env.message(start);env.tick();await settle();
  assert.equal(env.requests.length,0);
  assert.ok(env.events.at(-1).message.includes('静音'));
  await env.message({type:'STOP'});
});
test('local connection failure stops capture with a local service message',async()=>{
  const env=setup(async()=>{throw TypeError('Failed to fetch');});
  await env.message(start);env.tick();await settle();
  assert.equal(env.events.at(-1).active,false);
  assert.match(env.events.at(-1).message,/whisper-server/);
  assert.equal(env.stopped(),1);
});
test('recognition-only emits Japanese without a key or any cloud request',async()=>{
  const env=setup(async url=>{
    assert.equal(url,'http://127.0.0.1:8080/inference');
    return {ok:true,json:async()=>({text:'今日はいい天気ですね。'})};
  });
  await env.message({...start,key:undefined,settings:{...start.settings,translate:false}});
  env.tick();await settle();
  assert.equal(env.requests.length,1);
  assert.equal(env.requests[0].options.headers.Authorization,undefined);
  assert.equal(env.events.at(-1).ja,'今日はいい天気ですね。');
  assert.equal(env.events.at(-1).zh,undefined);
  assert.equal(env.events.at(-1).translate,false);
  await env.message({type:'STOP'});
});
