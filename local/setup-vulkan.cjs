// Community MinGW build of upstream whisper.cpp v1.9.5. The pinned archive
// is isolated from the official CPU runtime; no launcher or installer is run.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {pipeline}=require('node:stream/promises');
const {Readable}=require('node:stream');
const root=path.resolve(__dirname,'..','.local');
const blobHash='3cffb5692d1340e189d2fd7fbbff876a6127a52d';
const archive=path.join(root,'whisper-vulkan-bundle.zip');
function verify(bytes) {
  return crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')===blobHash;
}
(async()=>{
  fs.mkdirSync(root,{recursive:true});
  if(!fs.existsSync(archive) || !verify(fs.readFileSync(archive))) {
    const r=await fetch('https://api.github.com/repos/nyancodex/whisper-server-vulkan-windows/git/blobs/'+blobHash,{headers:{Accept:'application/vnd.github.raw+json'},signal:AbortSignal.timeout(180000)});
    if(!r.ok) throw Error('Vulkan archive download failed: HTTP '+r.status);
    await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(archive+'.part'));
    if(!verify(fs.readFileSync(archive+'.part'))) throw Error('Vulkan archive Git blob checksum mismatch');
    fs.renameSync(archive+'.part',archive);
  }
  const destination=path.join(root,'vulkan');
  if(!['whisper-server.exe','ggml-vulkan.dll','libwhisper.dll'].every(file=>fs.existsSync(path.join(destination,file)))) {
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'unpack.ps1'),'-ZipPath',archive,'-Destination',destination],{stdio:'inherit',windowsHide:true});
    if(result.error || result.status!==0) throw Error('Unable to unpack Vulkan runtime');
  }
  console.log('Vulkan runtime unpacked in .local/vulkan. GPU use must still be verified in the service log.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
