const http=require('node:http');
const {runUpdate}=require('./update.cjs');
function createGateway({port,enginePort,root,update=()=>runUpdate({root})}) {
  let job={status:'idle',ok:true,message:'No update running'};
  const server=http.createServer((req,res)=>{
    const pathname=req.url?.split('?')[0];
    if(pathname==='/hidari/update') {
      const origin=req.headers.origin;
      if(req.headers['x-hidari-update']!=='1' || (origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin))) {res.writeHead(403);res.end();return;}
      res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
      if(req.method==='GET'){res.end(JSON.stringify(job));return;}
      if(req.method!=='POST' || !req.headers['content-type']?.startsWith('application/json')){res.writeHead(405);res.end();return;}
      req.resume();
      if(job.status!=='running') {
        job={status:'running',ok:true,message:'Updating source'};
        Promise.resolve().then(update).then(result=>{job={...result,status:'done'};},error=>{job={status:'failed',ok:false,message:error.message};});
      }
      res.writeHead(202);res.end(JSON.stringify(job));return;
    }
    if(!['/health','/inference','/load'].includes(pathname)){res.writeHead(404);res.end();return;}
    const upstream=http.request({host:'127.0.0.1',port:enginePort,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${enginePort}`}},response=>{
      res.writeHead(response.statusCode,response.headers);response.on('error',()=>res.destroy());response.pipe(res);
    });
    upstream.on('error',()=>{if(res.destroyed || res.writableEnded)return;if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"Local engine is starting or unavailable"}');});
    res.on('close',()=>{if(!res.writableEnded)upstream.destroy();});
    req.pipe(upstream);
  });
  server.on('error',error=>console.error('Local gateway: '+error.message));
  server.listen(port,'127.0.0.1');
  return server;
}
module.exports={createGateway};
