const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function launch(config={}, backend) {
  let call;
  const fakeFs={existsSync:()=>true,readFileSync:()=>JSON.stringify(config),readdirSync:()=>[{name:'whisper-server.exe',isFile:()=>true,isDirectory:()=>false}]};
  const c=vm.createContext({__dirname:path.resolve('local'),console:{log(){},error(){}},process:{argv:['node','server.cjs','kotoba-v2',...(backend?[backend]:[])],env:{},on(){},exit(){throw Error('unexpected exit');}},
    require:name=>{
      if(name==='node:fs')return fakeFs;
      if(name==='node:path')return path;
      if(name==='node:os')return {availableParallelism:()=>20};
      if(name==='node:child_process')return {spawn:(...args)=>{call=args;return {on(){}};}};
      if(name==='./models.cjs')return require('../local/models.cjs');
      if(name==='./gateway.cjs')return {createGateway:()=>({on(){},close(){}})};
      throw Error('Unexpected require: '+name);
    }});
  vm.runInContext(fs.readFileSync('local/server.cjs','utf8'),c);
  return call;
}
test('verified Vulkan configuration enables GPU with the AMD compatibility flags',()=>{
  const [exe,args,options]=launch({backend:'vulkan',vulkanCompat:true});
  assert.ok(exe.includes(path.join('.local','vulkan')));
  assert.ok(!args.includes('--no-gpu'));assert.ok(args.includes('--no-flash-attn'));
  assert.equal(options.env.GGML_VK_DISABLE_COOPMAT,'1');
  assert.equal(options.env.GGML_VK_DISABLE_COOPMAT2,'1');
  assert.equal(args[args.indexOf('--host')+1],'127.0.0.1');
  assert.equal(options.windowsHide,true);
});
test('CPU can be selected explicitly despite a saved Vulkan preference',()=>{
  const [exe,args,options]=launch({backend:'vulkan',vulkanCompat:true},'cpu');
  assert.ok(exe.includes(path.join('.local','whisper')));
  assert.ok(args.includes('--no-gpu'));assert.ok(!args.includes('--no-flash-attn'));
  assert.equal(options.env.GGML_VK_DISABLE_COOPMAT,undefined);
});
test('an unconfigured installation still defaults to the CPU engine',()=>{
  const [,args]=launch({});assert.ok(args.includes('--no-gpu'));
});
