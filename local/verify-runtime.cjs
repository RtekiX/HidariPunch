// Tests the actual local inference path with generated silence, without cloud calls.
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const models=require('./models.cjs');
const root=path.resolve(__dirname,'..','.local');
const model=process.argv[2] || 'base';
const backend=process.argv[3] || 'cpu';
if(!Object.hasOwn(models,model) || !['cpu','vulkan'].includes(backend)) throw Error('Invalid model/backend');
require('../audio.js');
function find(folder) {
  if(!fs.existsSync(folder)) return;
  for(const entry of fs.readdirSync(folder,{withFileTypes:true})) {
    const full=path.join(folder,entry.name);
    if(entry.isFile() && entry.name==='whisper-server.exe') return full;
    if(entry.isDirectory()) {const result=find(full);if(result)return result;}
  }
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
  const exe=find(path.join(root,backend==='vulkan'?'vulkan':'whisper'));
  if(!exe) throw Error('Local engine missing');
  const args=['--host','127.0.0.1','--port',String(port),'-m','models/'+models[model].file,'-l','ja','-t','4'];
  const env={...process.env};
  if(backend==='cpu')args.push('--no-gpu');
  else {args.push('--no-flash-attn');env.GGML_VK_DISABLE_COOPMAT='1';env.GGML_VK_DISABLE_COOPMAT2='1';}
  const child=spawn(exe,args,{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let logs='',failed;
  child.on('error',e=>{failed=e;});
  child.stdout.on('data',b=>{logs+=b.toString();});child.stderr.on('data',b=>{logs+=b.toString();});
  const deadline=Date.now()+120000;
  try {
    while(true) {
      if(failed)throw failed;
      if(child.exitCode!==null)throw Error('Engine exited: '+child.exitCode);
      try {const r=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{}
      if(Date.now()>deadline)throw Error('Engine startup timed out');
      await pause(500);
    }
    const form=new FormData();form.append('file',HidariAudio.encodeWav(new Float32Array(16000)),'check.wav');
    form.append('language','ja');form.append('response_format','json');form.append('translate','false');
    const r=await fetch(`http://127.0.0.1:${port}/inference`,{method:'POST',body:form,signal:AbortSignal.timeout(60000)});
    const result=await r.json();
    if(!r.ok || typeof result.text!=='string')throw Error('Inference verification failed');
    if(backend==='vulkan' && !/using Vulkan\d* backend/.test(logs))throw Error('GPU backend was not used');
    console.log(`Verified ${backend}: local health + inference succeeded. This is a smoke test, not an accuracy benchmark.`);
  } finally {
    child.kill();
    fs.writeFileSync(path.join(root,'verify-runtime.log'),logs);
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
