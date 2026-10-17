const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const REPO='RtekiX/HidariPunch';
const roots=new Set(['.gitignore','.gitattributes','README.md','package.json','manifest.json']);
function managed(file) {
  if(typeof file!=='string' || file.includes('\\') || file.split('/').some(part=>!part || part==='.' || part==='..'))return false;
  if(roots.has(file))return true;
  return /^[a-zA-Z0-9_-]+\.(js|html|css|cmd)$/.test(file) || /^local\/[a-zA-Z0-9_-]+\.(cjs|ps1)$/.test(file) || /^tests\/[a-zA-Z0-9_-]+\.test\.cjs$/.test(file) || (file!=='docs/VULKAN_VERIFICATION.md' && /^docs\/[a-zA-Z0-9_-]+\.md$/.test(file));
}
function target(root,file) {
  if(!managed(file))throw Error('Unsafe update path');
  const result=path.resolve(root,...file.split('/'));
  if(!result.startsWith(path.resolve(root)+path.sep))throw Error('Update escaped project directory');
  let current=path.resolve(root);
  for(const part of file.split('/')) {
    current=path.join(current,part);
    if(fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())throw Error('Refusing to overwrite a symbolic link');
  }
  return result;
}
async function request(url,options={}) {
  if(!process.env.HIDARI_DOWNLOAD_PROXY)return fetch(url,{...options,signal:AbortSignal.timeout(30000)});
  const npmRoot=process.env.npm_execpath?path.resolve(path.dirname(process.env.npm_execpath),'..'):path.join(path.dirname(process.execPath),'node_modules','npm');
  return require(path.join(npmRoot,'node_modules','make-fetch-happen'))(url,{...options,proxy:process.env.HIDARI_DOWNLOAD_PROXY,timeout:30000,retry:0});
}
function git(root,args){return execFileSync('git',['-c','safe.directory='+path.resolve(root),'-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}}).trim();}
async function runUpdate({root=path.resolve(__dirname,'..'),checkOnly=false,fetcher=request}={}) {
  const info=await fetcher(`https://api.github.com/repos/${REPO}/commits/main`);
  if(!info.ok)throw Error('Cannot read update metadata: HTTP '+info.status);
  const commit=(await info.json()).sha;
  if(!/^[a-f0-9]{40}$/.test(commit || ''))throw Error('Invalid update commit');
  if(checkOnly)return {ok:true,commit,message:'Latest source commit: '+commit.slice(0,7)};
  if(fs.existsSync(path.join(root,'.git'))) {
    if(git(root,['symbolic-ref','--short','HEAD'])!=='main')throw Error('Switch the checkout to main before updating');
    if(git(root,['status','--porcelain']))throw Error('Local source changes detected. Commit or back them up before updating.');
    if(git(root,['rev-parse','HEAD'])===commit)return {ok:true,commit,message:'Already up to date'};
    const proxy=process.env.HIDARI_DOWNLOAD_PROXY?['-c','http.proxy='+process.env.HIDARI_DOWNLOAD_PROXY]:[];
    git(root,[...proxy,'fetch','--no-tags',`https://github.com/${REPO}.git`,'main']);
    if(git(root,['rev-parse','FETCH_HEAD'])!==commit)throw Error('Remote changed during update; retry');
    git(root,['merge','--ff-only',commit]);
    return {ok:true,commit,message:'Updated. Restart start.cmd and reload the extension.'};
  }
  const treeResponse=await fetcher(`https://api.github.com/repos/${REPO}/git/trees/${commit}?recursive=1`);
  if(!treeResponse.ok)throw Error('Cannot read source list');
  const tree=await treeResponse.json();
  if(tree.truncated)throw Error('Incomplete source list');
  const entries=(tree.tree || []).filter(e=>e.type==='blob' && ['100644','100755'].includes(e.mode) && managed(e.path));
  for(const required of ['manifest.json','popup.html','offscreen.js','local/server.cjs'])if(!entries.some(e=>e.path===required))throw Error('Incomplete update package');
  const files=[];
  // Validate every target and download every file before changing any source.
  for(let offset=0;offset<entries.length;offset+=6) {
    const batch=await Promise.all(entries.slice(offset,offset+6).map(async entry=>{
      const destination=target(root,entry.path);
      if(entry.size>2*1024*1024)throw Error('Source file is unexpectedly large');
      const response=await fetcher(`https://raw.githubusercontent.com/${REPO}/${commit}/${entry.path}`);
      if(!response.ok)throw Error('Source download failed: '+entry.path);
      const bytes=Buffer.from(await response.arrayBuffer());
      const hash=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
      if(hash!==entry.sha)throw Error('Source checksum mismatch: '+entry.path);
      return {file:entry.path,destination,bytes};
    }));
    files.push(...batch);
  }
  JSON.parse(files.find(f=>f.file==='manifest.json').bytes.toString('utf8'));
  const backup=path.join(root,'.local','update-backups',crypto.randomUUID());
  fs.mkdirSync(backup,{recursive:true});
  const previous=new Map();
  for(const file of files) {
    const existed=fs.existsSync(file.destination);previous.set(file.file,existed);
    if(existed){const copy=path.join(backup,file.file);fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file.destination,copy);}
  }
  try {
    for(const file of files){fs.mkdirSync(path.dirname(file.destination),{recursive:true});fs.writeFileSync(file.destination,file.bytes);}
  } catch(error) {
    for(const file of files) {
      if(previous.get(file.file))fs.copyFileSync(path.join(backup,file.file),file.destination);
      else if(fs.existsSync(file.destination))fs.unlinkSync(file.destination);
    }
    throw error;
  }
  fs.writeFileSync(path.join(root,'.local','update-state.json'),JSON.stringify({commit,updatedAt:new Date().toISOString()},null,2));
  return {ok:true,commit,message:'Updated with source backup. Restart start.cmd and reload the extension.'};
}
module.exports={runUpdate,managed};
if(require.main===module)runUpdate({checkOnly:process.argv.includes('--check')}).then(result=>console.log(result.message),error=>{console.error(error.message);process.exitCode=1;});
