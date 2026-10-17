const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const {createGateway}=require('../local/gateway.cjs');
const headers={'Content-Type':'application/json','X-Hidari-Update':'1',Origin:'chrome-extension://'+'a'.repeat(32)};
test('update endpoint rejects website requests, deduplicates jobs and reports completion',async t=>{
  let finish,count=0;
  const server=createGateway({port:0,enginePort:1,root:'.',update:()=>{count++;return new Promise(resolve=>finish=resolve);}});
  await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/hidari/update`;
  assert.equal((await fetch(url,{method:'POST',headers:{...headers,Origin:'https://example.com'},body:'{}'})).status,403);
  assert.equal((await fetch(url)).status,403);
  for(let i=0;i<2;i++)assert.equal((await fetch(url,{method:'POST',headers,body:'{}'})).status,202);
  assert.equal(count,1);
  assert.equal((await (await fetch(url,{headers})).json()).status,'running');
  finish({ok:true,message:'updated'});await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await (await fetch(url,{headers})).json()).status,'done');
});
test('gateway forwards recognition audio and returns the engine transcript unchanged',async t=>{
  let audio='';
  const engine=http.createServer((req,res)=>{req.on('data',chunk=>audio+=chunk);req.on('end',()=>{res.setHeader('Content-Type','application/json');res.end('{"text":"こんにちは"}');});});
  engine.listen(0,'127.0.0.1');await once(engine,'listening');
  const gateway=createGateway({port:0,enginePort:engine.address().port,root:'.'});await once(gateway,'listening');
  t.after(async()=>{await new Promise(resolve=>gateway.close(resolve));await new Promise(resolve=>engine.close(resolve));});
  const r=await fetch(`http://127.0.0.1:${gateway.address().port}/inference`,{method:'POST',body:'audio-bytes'});
  assert.equal((await r.json()).text,'こんにちは');assert.equal(audio,'audio-bytes');
});
