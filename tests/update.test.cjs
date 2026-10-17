const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {runUpdate,managed}=require('../local/update.cjs');
function fixture(t,corrupt=false) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'hidari-update-'));
  t.after(()=>{const resolved=path.resolve(root);if(path.dirname(resolved)!==path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('hidari-update-'))throw Error('Unsafe cleanup');fs.rmSync(resolved,{recursive:true,force:true});});
  fs.mkdirSync(path.join(root,'.local'));fs.writeFileSync(path.join(root,'.local','runtime-config.json'),'{"backend":"cpu"}');
  fs.writeFileSync(path.join(root,'popup.html'),'old source');
  const files={'manifest.json':'{"manifest_version":3}','popup.html':'new popup','offscreen.js':'new offscreen','local/server.cjs':'new server'};
  const entries=Object.entries(files).map(([name,content])=>({type:'blob',mode:'100644',path:name,size:Buffer.byteLength(content),sha:crypto.createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0').update(content).digest('hex')}));
  entries.push({type:'blob',mode:'100644',path:'.local/runtime-config.json',size:1,sha:'bad'});
  const urls=[];
  return {root,urls,fetcher:async url=>{
    urls.push(url);
    if(url.includes('/commits/'))return Response.json({sha:'1'.repeat(40)});
    if(url.includes('/git/trees/'))return Response.json({tree:entries,truncated:false});
    const name=url.split('/'+'1'.repeat(40)+'/')[1];
    return new Response(corrupt?'broken bytes':files[name]);
  }};
}
test('ZIP source update verifies files, backs up old source and preserves local configuration',async t=>{
  const f=fixture(t);const result=await runUpdate(f);
  assert.equal(result.ok,true);assert.equal(fs.readFileSync(path.join(f.root,'popup.html'),'utf8'),'new popup');
  assert.equal(fs.readFileSync(path.join(f.root,'.local','runtime-config.json'),'utf8'),'{"backend":"cpu"}');
  const backup=fs.readdirSync(path.join(f.root,'.local','update-backups'))[0];
  assert.equal(fs.readFileSync(path.join(f.root,'.local','update-backups',backup,'popup.html'),'utf8'),'old source');
  assert.ok(!f.urls.some(url=>url.includes('/.local/')));
});
test('checksum failure leaves existing source and local configuration untouched',async t=>{
  const f=fixture(t,true);await assert.rejects(runUpdate(f),/checksum mismatch/);
  assert.equal(fs.readFileSync(path.join(f.root,'popup.html'),'utf8'),'old source');
  assert.equal(fs.existsSync(path.join(f.root,'.local','update-backups')),false);
});
test('update allowlist rejects traversal, credentials, personal records and runtime data',()=>{
  for(const name of ['../popup.js','local/../../secret','local\\server.cjs','.local/runtime-config.json','.env','credentials.json','docs/VULKAN_VERIFICATION.md','.git/config','models/weights.bin'])assert.equal(managed(name),false,name);
});
