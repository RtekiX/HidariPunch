const fs=require('node:fs');
const file=process.argv[2];
const port=Number(process.argv[3] || 8080);
const runs=Number(process.argv[4] || 3);
if(!file || !Number.isInteger(port) || port<1024 || port>65535 || !Number.isInteger(runs) || runs<1 || runs>10) throw Error('Usage: node local/benchmark.cjs audio.wav [port=8080] [runs=3, max=10]');
(async()=>{
  const bytes=fs.readFileSync(file);
  for(let i=0;i<runs;i++) {
    const form=new FormData();form.append('file',new Blob([bytes],{type:'audio/wav'}),'benchmark.wav');
    form.append('language','ja');form.append('translate','false');form.append('response_format','json');
    const start=Date.now();
    const response=await fetch(`http://127.0.0.1:${port}/inference`,{method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(60000)});
    const result=await response.json();
    if(!response.ok || typeof result.text!=='string') throw Error('Recognition failed: HTTP '+response.status);
    console.log(JSON.stringify({run:i+1,port,ms:Date.now()-start,text:result.text.trim()}));
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
