const fs=require('node:fs');
const path=require('node:path');
const models=require('./models.cjs');
const name=process.argv[2] || 'kotoba-v2';
if(!Object.hasOwn(models,name)) throw Error('Unknown model: '+name);
const root=path.resolve(__dirname,'..','.local');
const relative='models/'+models[name].file;
if(!fs.existsSync(path.join(root,relative))) throw Error('Model missing. Run: npm run local:setup -- '+name);
const port=Number(process.env.HIDARI_LOCAL_PORT || 8080);
if(!Number.isInteger(port) || port<1024 || port>65535) throw Error('Invalid local port');
(async()=>{
  const form=new FormData();form.append('model',relative);
  const response=await fetch(`http://127.0.0.1:${port}/load`,{method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(120000)});
  const message=await response.text();
  if(!response.ok || !message.includes('Load was successful')) throw Error('Model switch failed: '+message);
  console.log('Active model: '+name+' ('+models[name].file+')');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
