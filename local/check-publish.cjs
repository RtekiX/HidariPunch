// Audit the Git index, never print detected secrets or inspect local runtime data.
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const files=execFileSync('git',['ls-files','--cached','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const violations=[];
const deny=/(^|\/)(\.local|node_modules|\.codex|\.agents)(\/|$)|(^|\/)\.env($|\.)|(^|\/)(credentials|secrets|runtime-config)([^/]*\.json)$|\.(key|pem|pfx|p12|log|zip|bin|wav|mp3|flac|part)$/i;
const patterns=[
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /[A-Z]:[\\/]Users[\\/][^\\/\s]+[\\/]/i,
  /[A-Z]:[\\/]CIAPF[\\/]/i
];
for(const file of files) {
  if(deny.test(file) || file==='docs/VULKAN_VERIFICATION.md') {violations.push(file+': sensitive/local file');continue;}
  const text=execFileSync('git',['show',':'+file],{encoding:'utf8',maxBuffer:4*1024*1024});
  for(const [i,line] of text.split(/\r?\n/).entries()) if(patterns.some(pattern=>pattern.test(line))) violations.push(file+':'+(i+1)+': potential secret or personal path');
}
const report={filesChecked:files.length,violations};
fs.mkdirSync('.local',{recursive:true});fs.writeFileSync('.local/publish-audit.json',JSON.stringify(report,null,2));
if(violations.length){console.error(violations.join('\n'));process.exitCode=1;}
else console.log(`Publish audit passed: ${files.length} staged files; no denied local files, token patterns or personal paths found.`);
