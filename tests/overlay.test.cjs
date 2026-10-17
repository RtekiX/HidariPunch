const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup() {
  const handlers={},windowEvents={},saved=[];
  const style={removeProperty(key){delete this[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}};
  const host={style,dataset:{},getBoundingClientRect(){return {left:parseFloat(style.left)||100,top:parseFloat(style.top)||200,width:parseFloat(style.width)||600,height:180};}};
  const parent={append(node){node.parentNode=this;}};
  const handle={addEventListener(name,fn){handlers[name]=fn;},setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){}};
  const context=vm.createContext({innerWidth:1000,innerHeight:800,document:{documentElement:parent},addEventListener:(name,fn)=>windowEvents[name]=fn});
  vm.runInContext(fs.readFileSync('overlay.js','utf8'),context);
  const overlay=context.HidariOverlay.attach(host,handle,p=>saved.push(p));
  const event=extra=>({button:0,pointerId:1,clientX:100,clientY:200,target:{closest:()=>null},preventDefault(){},...extra});
  return {handlers,windowEvents,saved,host,overlay,context,event};
}
test('dragging creates a floating panel, clamps it to the viewport and saves only position',()=>{
  const e=setup();e.handlers.pointerdown(e.event());
  e.handlers.pointermove(e.event({clientX:2000,clientY:2000}));
  e.handlers.pointerup(e.event());
  assert.equal(e.overlay.floating,true);assert.equal(e.host.style.position,'fixed');
  assert.equal(e.saved.length,1);assert.equal(e.saved[0].left,388);assert.equal(e.saved[0].top,608);
  assert.deepEqual(Object.keys(e.saved[0]).sort(),['left','top','width']);
  e.overlay.reset();assert.equal(e.overlay.floating,false);assert.equal(e.saved.at(-1),null);
  assert.equal(e.host.style.position,undefined);
});
test('buttons do not trigger dragging and restored coordinates adapt to smaller windows',()=>{
  const e=setup();e.handlers.pointerdown(e.event({target:{closest:()=>({})}}));
  assert.equal(e.overlay.floating,false);
  e.overlay.restore({left:800,top:700,width:600});e.context.innerWidth=500;e.context.innerHeight=300;e.windowEvents.resize();
  assert.equal(e.host.style.left,'12px');assert.equal(e.host.style.top,'108px');
  assert.equal(e.host.style.width,'476px');assert.equal(e.saved.length,0);
});
