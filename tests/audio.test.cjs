const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context=vm.createContext({Blob});
vm.runInContext(fs.readFileSync('audio.js','utf8'),context);
vm.runInContext(fs.readFileSync('config.js','utf8'),context);
test('WAV is mono PCM16 16kHz, lengths and clipping are correct',async()=>{
  const wav=context.HidariAudio.encodeWav(new Float32Array([-2,-1,0,1,2]));
  const b=Buffer.from(await wav.arrayBuffer());
  assert.equal(wav.type,'audio/wav');assert.equal(b.toString('ascii',0,4),'RIFF');
  assert.equal(b.toString('ascii',8,12),'WAVE');assert.equal(b.readUInt32LE(4),b.length-8);
  assert.equal(b.readUInt16LE(20),1);assert.equal(b.readUInt16LE(22),1);
  assert.equal(b.readUInt32LE(24),16000);assert.equal(b.readUInt16LE(34),16);
  assert.equal(b.readUInt32LE(40),10);
  assert.deepEqual(Array.from({length:5},(_,i)=>b.readInt16LE(44+i*2)),[-32768,-32768,0,32767,32767]);
});
test('old OpenAI settings migrate without reusing the old model',()=>{
  const settings=context.HidariConfig.normalize({model:'gpt-4o-mini',asr:'gpt-4o-mini-transcribe',seconds:8});
  assert.equal(settings.model,'deepseek-flash');assert.equal(settings.seconds,8);
  assert.equal(settings.translate,false);
  assert.equal(context.HidariConfig.localURL(settings,'inference'),'http://127.0.0.1:8080/inference');
});
test('local port validation prevents malformed or remote endpoints',()=>{
  for(const port of ['evil.com',0,80,65536,8080.5,'']) assert.throws(()=>context.HidariConfig.normalize({localPort:port}));
});
