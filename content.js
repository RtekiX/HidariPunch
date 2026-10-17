(()=>{
  if(globalThis.hidariPunchLoaded) return;
  globalThis.hidariPunchLoaded=true;
  const host=document.createElement('div'); host.id='hidari-punch';
  const root=host.attachShadow({mode:'closed'});
  root.innerHTML=`<style>:host{display:block;margin:12px 0;font-family:system-ui,"Microsoft YaHei",sans-serif;color:#edf2f7}section{background:#141b25;border:1px solid #364050;border-radius:12px;padding:18px 22px}header{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;color:#a4dfbd}button{background:transparent;border:1px solid #536173;border-radius:5px;color:#d2dbe7;cursor:pointer;padding:4px 8px}#status{font-size:12px;color:#a7b2c3;margin:10px 0}#zh{font-size:23px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}#ja{font-size:14px;color:#9caabd;line-height:1.7;margin-top:8px}details{margin-top:12px;font-size:12px;color:#a7b2c3}#history{max-height:200px;overflow:auto}article{border-top:1px solid #303b4a;padding:10px 0;white-space:pre-wrap;overflow-wrap:anywhere}</style><section><header><b>HIDARI PUNCH · 日 → 中</b><button id="clear">清空字幕</button></header><div id="status" role="status">等待启动</div><div id="zh" aria-live="polite">中文字幕将显示在这里</div><div id="ja" lang="ja"></div><details><summary>字幕历史（最近 60 条）</summary><div id="history"></div></details></section>`;
  const el=id=>root.getElementById(id);
  el('zh').textContent='识别字幕将显示在这里';
  el('clear').onclick=()=>{el('zh').textContent='识别字幕将显示在这里';el('ja').textContent='';el('history').replaceChildren();};
  let visible=false;
  function mount(){
    if(!visible || !location.pathname.startsWith('/watch')){host.remove();return;}
    const player=document.querySelector('ytd-watch-flexy #player');
    if(player && host.previousElementSibling!==player) player.after(host);
  }
  let scheduled=false;
  new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;mount();});}}).observe(document.documentElement,{subtree:true,childList:true});
  chrome.runtime.onMessage.addListener((m,sender,reply)=>{
    if(m.type==='PING'){reply({ok:true});return;}
    if(m.type!=='SUBTITLE') return;
    visible=true; mount(); el('status').textContent=m.message;
    root.querySelector('header b').textContent=m.translate?'HIDARI PUNCH · 日 → 中':'HIDARI PUNCH · 日语识别';
    if(m.zh || m.ja){
      el('zh').textContent=m.zh || m.ja; el('zh').lang=m.zh?'zh-CN':'ja';
      el('ja').textContent=m.zh?m.ja:'';
      const row=document.createElement('article');row.textContent=new Date().toLocaleTimeString()+'  '+(m.zh?m.zh+'\n'+m.ja:m.ja);
      el('history').prepend(row);
      while(el('history').children.length>60) el('history').lastChild.remove();
    }
  });
})();
