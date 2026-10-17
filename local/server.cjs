const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..','.local');
const models=require('./models.cjs');
const runtimeConfig=fs.existsSync(path.join(root,'runtime-config.json'))?JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json'),'utf8')):{};
const model=process.argv[2] || runtimeConfig.model || 'kotoba-v2';
if(!models[model]) throw Error('Unsupported model name');
const port=Number(process.env.HIDARI_LOCAL_PORT || 8080);
if(!Number.isInteger(port) || port<1024 || port>65535) throw Error('Invalid HIDARI_LOCAL_PORT');
function findServer(folder) {
  if(!fs.existsSync(folder)) return;
  for(const item of fs.readdirSync(folder,{withFileTypes:true})) {
    const full=path.join(folder,item.name);
    if(item.isFile() && item.name==='whisper-server.exe') return full;
    if(item.isDirectory()) {const found=findServer(full);if(found) return found;}
  }
}
const backend=process.argv[3] || process.env.HIDARI_BACKEND || (process.env.HIDARI_WHISPER_SERVER?'vulkan':runtimeConfig.backend || 'cpu');
if(!['cpu','vulkan'].includes(backend)) throw Error('Backend must be cpu or vulkan');
const executable=process.env.HIDARI_WHISPER_SERVER || findServer(path.join(root,backend==='vulkan'?'vulkan':'whisper'));
const modelPath=path.join(root,'models',models[model].file);
if(!executable || !fs.existsSync(executable) || !fs.existsSync(modelPath)) {
  console.error('Local engine/model missing. Run: npm run local:setup -- '+model);
  process.exit(1);
}
// Model stays loaded between requests. No shell, no audio files written by this launcher.
// Relative ASCII model paths also work with Windows builds whose argv/fopen
// cannot handle a workspace path containing Chinese characters.
const args=['--host','127.0.0.1','--port',String(port),'-m',path.relative(root,modelPath),'-l','ja','-t',String(Math.min(8,require('node:os').availableParallelism()))];
if(backend==='cpu') args.push('--no-gpu');
const vulkanCompat=backend==='vulkan' && runtimeConfig.vulkanCompat!==false;
if(process.env.HIDARI_NO_FLASH_ATTN==='1' || vulkanCompat) args.push('--no-flash-attn');
const childEnv={...process.env};
if(vulkanCompat) {childEnv.GGML_VK_DISABLE_COOPMAT='1';childEnv.GGML_VK_DISABLE_COOPMAT2='1';}
const child=spawn(executable,args,{cwd:root,env:childEnv,stdio:'inherit',windowsHide:true});
console.log(`Starting local Japanese ASR: http://127.0.0.1:${port} | model=${model} | requested backend=${backend}. Ctrl+C stops the service.`);
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{console.log(`ASR process exited: code=${code}, signal=${signal || 'none'}`);process.exitCode=code===0?0:1;});
process.on('SIGINT',()=>child.kill());
process.on('SIGTERM',()=>child.kill());
