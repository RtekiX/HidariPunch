importScripts('config.js');
let creating;
let busy = false;
let startEpoch = 0;
const initial = chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
async function offscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) creating = chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA'],justification:'捕获用户启动的 YouTube 标签页音频并生成翻译字幕'}).finally(()=>creating=null);
  await creating;
}
async function deliver(tabId, payload) { try { await chrome.tabs.sendMessage(tabId,{...payload,type:'SUBTITLE'}); } catch {} }
async function checkLocal(settings) {
  let response;
  try { response=await fetch(HidariConfig.localURL(settings,'health'),{signal:AbortSignal.timeout(4000),redirect:'error'}); }
  catch { throw Error('无法连接本地识别服务，请先运行 whisper-server 并检查端口及 Chrome 本地网络访问权限'); }
  if(response.status===503) throw Error('本地模型正在加载，请稍后重试');
  if(!response.ok) throw Error(`本地服务健康检查失败 (${response.status})，请确认使用 whisper.cpp 服务`);
  let health;
  try { health=await response.json(); } catch { throw Error('本地服务返回格式不正确，请确认端口'); }
  if(health.status!=='ok') throw Error('本地模型尚未准备好');
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if (sender.id !== chrome.runtime.id || sender.tab) return;
  if (m.target === 'offscreen') return;
  (async()=>{
    await initial;
    if(m.type==='STATUS') return (await chrome.storage.session.get('state')).state || {message:'准备就绪'};
    if(m.type==='CHECK_LOCAL') {
      const settings=HidariConfig.normalize(m.settings);
      await checkLocal(settings);
      return {ok:true,message:'本地识别服务已就绪（连通检查通过，识别速度需播放音频实测）'};
    }
    if(m.type==='EVENT') {
      await chrome.storage.session.set({state:{tabId:m.tabId,active:m.active,message:m.message}});
      await deliver(m.tabId,m);
      return {ok:true};
    }
    if(m.type==='STOP') {
      startEpoch++;
      if(await chrome.offscreen.hasDocument()) await chrome.runtime.sendMessage({target:'offscreen',type:'STOP'});
      return {message:'已停止识别'};
    }
    if(m.type==='START') {
      if(busy) throw Error('正在启动，请稍候');
      busy=true;
      const epoch=++startEpoch;
      const ensureStarting=()=>{if(epoch!==startEpoch) throw Error('启动已取消');};
      try {
        const tab = await chrome.tabs.get(m.tabId);
        if(!/^https:\/\/www\.youtube\.com\/watch\?/.test(tab.url || '')) throw Error('请在 YouTube 视频或直播观看页面启动');
        try { await chrome.tabs.sendMessage(m.tabId,{type:'PING'}); } catch { throw Error('请刷新 YouTube 页面后重试'); }
        const local=await chrome.storage.local.get(['deepseekKey','settings']);
        const session=await chrome.storage.session.get('deepseekKey');
        const settings=HidariConfig.normalize(local.settings);
        const key=settings.translate?(local.deepseekKey || session.deepseekKey):undefined;
        if(settings.translate && !key) throw Error('请先填写 DeepSeek API Key');
        await checkLocal(settings);
        ensureStarting();
        await offscreen();
        await chrome.runtime.sendMessage({target:'offscreen',type:'STOP'});
        ensureStarting();
        const streamId=await chrome.tabCapture.getMediaStreamId({targetTabId:m.tabId});
        ensureStarting();
        const r=await chrome.runtime.sendMessage({target:'offscreen',type:'START',streamId,tabId:m.tabId,key,settings});
        if(!r?.ok) throw Error(r?.error || '音频捕获启动失败');
        return {message:'正在监听日语，字幕即将显示在播放器下方'};
      } finally {busy=false;}
    }
  })().then(reply,e=>reply({ok:false,message:e.message}));
  return true;
});
chrome.tabs.onRemoved.addListener(async id=>{
  const {state}=await chrome.storage.session.get('state');
  if(state?.tabId===id && await chrome.offscreen.hasDocument()) await chrome.runtime.sendMessage({target:'offscreen',type:'STOP'});
});
chrome.tabs.onUpdated.addListener(async (id,change)=>{
  if(!change.url) return;
  const {state}=await chrome.storage.session.get('state');
  if(state?.active && state.tabId===id && await chrome.offscreen.hasDocument()) await chrome.runtime.sendMessage({target:'offscreen',type:'STOP'});
});
