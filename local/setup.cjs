// Downloads official CPU binaries and a multilingual model into this project only.
// The optional Vulkan build is documented in README.md.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pipeline} = require('node:stream/promises');
const {Readable} = require('node:stream');
const {spawnSync} = require('node:child_process');
const models = require('./models.cjs');
const root = path.resolve(__dirname, '..', '.local');
const model = process.argv[2] || 'kotoba-v2';
if (!models[model]) throw Error('Choose a model: '+Object.keys(models).join(', '));
const selected = models[model];
async function request(url, options = {}) {
  const proxy = process.env.HIDARI_DOWNLOAD_PROXY;
  if(!proxy) return fetch(url,options);
  // Reuse npm's HTTP client when an explicit download proxy is requested.
  // This adds no dependencies to the extension and does not change system proxy settings.
  const npmRoot=process.env.npm_execpath?path.resolve(path.dirname(process.env.npm_execpath),'..'):path.join(path.dirname(process.execPath),'node_modules','npm');
  const proxyFetch=require(path.join(npmRoot,'node_modules','make-fetch-happen'));
  return proxyFetch(url,{...options,proxy,timeout:900000,retry:0});
}
async function download(url, dest, hash, headers = {}) {
  if(fs.existsSync(dest) && (!hash || await digest(dest,hash.length) === hash)) {console.log('Already downloaded: '+path.basename(dest));return;}
  console.log('Downloading '+url);
  const response = await request(url, {headers,signal:AbortSignal.timeout(900000)});
  if(!response.ok) throw Error('Download failed: HTTP '+response.status);
  const body=typeof response.body.getReader==='function'?Readable.fromWeb(response.body):response.body;
  let lastProgress=Date.now(), received=0;
  body.on('data',chunk=>{
    received+=chunk.length;
    if(Date.now()-lastProgress>10000) {console.log(`Downloaded ${Math.round(received/1048576)} MiB: ${path.basename(dest)}`);lastProgress=Date.now();}
  });
  await pipeline(body, fs.createWriteStream(dest+'.part'));
  if(hash && await digest(dest+'.part',hash.length) !== hash) throw Error('Checksum mismatch: '+path.basename(dest));
  fs.renameSync(dest+'.part',dest);
}
async function digest(file, length) {
  const hash=crypto.createHash(length===40?'sha1':'sha256');
  for await(const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
(async()=>{
  if(process.platform!=='win32' || process.arch!=='x64') throw Error('This setup script supports Windows x64. Build whisper.cpp manually on other platforms.');
  fs.mkdirSync(path.join(root,'models'),{recursive:true});
  const archive=path.join(root,'whisper-bin-x64-v1.8.3.zip');
  const metadata=await request('https://api.github.com/repos/ggml-org/whisper.cpp/releases/tags/v1.8.3',{signal:AbortSignal.timeout(15000)});
  if(!metadata.ok) throw Error('Cannot read official release metadata: HTTP '+metadata.status);
  const asset=(await metadata.json()).assets.find(a=>a.name==='whisper-bin-x64.zip');
  if(!asset) throw Error('Official Windows x64 archive missing');
  await download(asset.url+'?download=1&t='+Date.now(),archive,'d824b1e37599f882b396e73f1ee0bfd5d0529f700314c48311dcbd00b803321d',{Accept:'application/octet-stream'});
  if(!fs.existsSync(path.join(root,'whisper','Release','whisper-server.exe'))) {
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'unpack.ps1'),'-ZipPath',archive,'-Destination',path.join(root,'whisper')],{stdio:'inherit',windowsHide:true});
    if(result.error || result.status!==0) throw Error('Unable to unpack the whisper.cpp archive');
  }
  // Official standard-model SHA-1 or Kotoba repository LFS SHA-256.
  const modelFile=path.join(root,'models',selected.file);
  try {
    await download(`https://huggingface.co/${selected.repo}/resolve/main/${selected.file}?download=true&t=${Date.now()}`,modelFile,selected.hash);
  } catch(e) {
    console.log('Official model download failed; trying hf-mirror.com with the official model checksum.');
    await download(`https://hf-mirror.com/${selected.repo}/resolve/main/${selected.file}?download=true&t=${Date.now()}`,modelFile,selected.hash);
  }
  await download('https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.8.3/LICENSE',path.join(root,'whisper-LICENSE.txt'));
  console.log(`Ready. Run: npm run local:start -- ${model}`);
})().catch(e=>{console.error(e.message, e.cause?.code || '');process.exitCode=1;});
