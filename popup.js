const $ = id => document.getElementById(id);
function updateMode() {
  const enabled=$('translate').checked;
  $('translationSettings').hidden=!enabled;
  $('key').required=enabled;
  $('model').required=enabled;
  $('start').textContent=enabled?'开始翻译 ↗':'开始识别 ↗';
  $('privacy').textContent=enabled?'音频只发送到本机，识别出的日语文字发送至 DeepSeek，产生 API 费用。':'仅识别模式无需 Key，音频只发送到本机，不调用 DeepSeek。请先启动本地服务并播放视频。';
}
$('translate').onchange=updateMode;
async function init() {
  const local = await chrome.storage.local.get(['settings', 'deepseekKey']);
  const session = await chrome.storage.session.get('deepseekKey');
  const s = HidariConfig.normalize(local.settings);
  $('translate').checked=s.translate;
  updateMode();
  $('key').value = local.deepseekKey || session.deepseekKey || '';
  $('remember').checked = Boolean(local.deepseekKey);
  for (const id of ['localPort', 'model', 'seconds']) $(id).value = s[id];
  const state = await chrome.runtime.sendMessage({type:'STATUS'});
  $('status').textContent = state?.message || '准备就绪';
}
$('settings').onsubmit = async e => {
  e.preventDefault(); $('start').disabled = true;
  try {
    const key = $('key').value.trim();
    const settings = HidariConfig.normalize({pipeline:'local-deepseek',translate:$('translate').checked,localPort:$('localPort').value,model:$('model').value.trim(),seconds:Number($('seconds').value)});
    await chrome.storage.local.set({settings});
    if(settings.translate) {
      await chrome.storage.session.set({deepseekKey:key});
      if ($('remember').checked) await chrome.storage.local.set({deepseekKey:key});
      else await chrome.storage.local.remove('deepseekKey');
    }
    // Never reuse an old OpenAI credential for a different provider.
    await chrome.storage.local.remove('key');
    await chrome.storage.session.remove('key');
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const result = await chrome.runtime.sendMessage({type:'START',tabId:tab.id});
    $('status').textContent = result.message;
  } catch(e) { $('status').textContent = e.message; }
  finally { $('start').disabled = false; }
};
$('stop').onclick = async () => { const r = await chrome.runtime.sendMessage({type:'STOP'}); $('status').textContent=r.message; };
$('forget').onclick = async () => { await chrome.storage.local.remove(['key','deepseekKey']); await chrome.storage.session.remove(['key','deepseekKey']); $('key').value=''; $('remember').checked=false; $('status').textContent='密钥已清除；正在运行的翻译请点击停止。'; };
$('testLocal').onclick = async () => {
  $('testLocal').disabled=true; $('status').textContent='正在连接本地识别服务…';
  try {
    const r=await chrome.runtime.sendMessage({type:'CHECK_LOCAL',settings:{localPort:$('localPort').value}});
    $('status').textContent=r.message;
  } catch(e) { $('status').textContent=e.message; }
  finally { $('testLocal').disabled=false; }
};
init().catch(e => $('status').textContent=e.message);
