'use strict';
/* ---------------- 对局遥测（仅 PvP 主机端录制；数据用于平衡分析，大厅有告知文案） ----------------
   主机权威模拟里双方数据都是真值，所以只录主机一端就是整场对局的完整记录。
   上传目标是 Cloudflare 代理的域名——源站真实地址不出现在本仓库任何位置。
   URL 里的 k= 只是防手滑门槛，不是机密；服务端另有大小与结构校验。 */
const TELE_URL='https://wg.littleshark.xin/t/match?k=wgtl_c243981ea1842800';
const TELE_VER='2026.07.28-era3-dual-hero-v2'; /* 每次平衡改版随手升级，脏数据全靠它隔离 */
const TELE_QKEY='wgTeleQueue';
let TELE=null;

function teleStart(c0,c1){
  TELE={t0:G.t,last:-9,samp:[],cmds:[],evts:[],
        meta:{v:TELE_VER,mode:'pvp',L:Math.round(L),c0,c1,st:Date.now()}};
}
/* 经济全景采样，每 2 秒一行：
   [t, 金0,金1, 速率0,速率1, xp0,xp1, 时代0,时代1, 堆数0,堆数1, 堆总级0,堆总级1, 城0,城1, 前线0,前线1] */
function teleTick(){
  if(!TELE)return;
  const t=G.t-TELE.t0;
  if(t-TELE.last<2)return;
  TELE.last=t;
  const wy=[0,0],wn=[0,0],wl=[0,0];
  for(const u of G.units)if(!u.dying&&u.type==='b_workshop'){
    wy[u.side]+=wsYield(u);wn[u.side]++;wl[u.side]+=u.wlv||1;
  }
  TELE.samp.push([Math.round(t),
    G.money|0,G.aiMoney|0,
    Math.round(G.income+FLAG_INCOME*ownedFlags(0)+wy[0]+plunderOf(0)),
    Math.round(G.aiIncome+FLAG_INCOME*ownedFlags(1)+wy[1]+plunderOf(1)),
    G.xp|0,G.aiXp|0,G.era,G.aiEra,
    wn[0],wn[1],wl[0],wl[1],
    Math.round(G.baseHp[0]),Math.round(G.baseHp[1]),
    Math.round(frontSmooth(0)),Math.round(frontSmooth(1))]);
}
/* 决策流：[t, side, 动作, 附注]；动作=buy、inc、evolve、place_xx、airdrop、strike、wsup、wsrec */
function teleCmd(side,kind,x){
  if(!TELE)return;
  TELE.cmds.push([Math.round((G.t-TELE.t0)*10)/10,side,kind,x===undefined?0:x]);
}
/* 关键事件流：[t, 类型, a, b]；kill/flag/evt/evolve */
function teleEvent(kind,a,b){
  if(!TELE)return;
  TELE.evts.push([Math.round((G.t-TELE.t0)*10)/10,kind,a===undefined?0:a,b===undefined?0:b]);
}
async function teleGzip(str){
  if(typeof CompressionStream==='undefined')return null;
  try{
    const cs=new CompressionStream('gzip');
    return await new Response(new Blob([str]).stream().pipeThrough(cs)).arrayBuffer();
  }catch(e){return null;}
}
async function telePost(str){
  let body=await teleGzip(str);
  if(!body)body=str;                                   /* 老浏览器兜底：服务端接受原文 */
  const small=(body.byteLength||body.length)<60000;    /* keepalive 有 64KB 硬上限 */
  const r=await fetch(TELE_URL,{method:'POST',body,keepalive:small,
    headers:{'Content-Type':'text/plain'}});           /* text/plain=简单请求，免预检 */
  return r.ok;
}
function teleQueuePush(str){
  try{
    const q=JSON.parse(localStorage.getItem(TELE_QKEY)||'[]');
    q.push(str);
    while(q.length>3)q.shift();                        /* 最多积压 3 局，防撑爆 localStorage */
    localStorage.setItem(TELE_QKEY,JSON.stringify(q));
  }catch(e){}
}
async function teleFlush(){
  let q;
  try{q=JSON.parse(localStorage.getItem(TELE_QKEY)||'[]');}catch(e){return;}
  if(!q.length)return;
  const rest=[];
  for(const s of q){
    try{if(!await telePost(s))rest.push(s);}catch(e){rest.push(s);}
  }
  try{localStorage.setItem(TELE_QKEY,JSON.stringify(rest));}catch(e){}
}
function teleEnd(win,reason){
  if(!TELE)return;
  const p=TELE;TELE=null;
  const payload=Object.assign({},p.meta,{
    dur:Math.round(G.t-p.t0),win:win?1:0,reason:reason||'',
    samp:p.samp,cmds:p.cmds,evts:p.evts});
  const str=JSON.stringify(payload);
  telePost(str).then(ok=>{if(!ok)teleQueuePush(str);}).catch(()=>teleQueuePush(str));
}
setTimeout(teleFlush,6000);  /* 开页 6 秒后补传上次失败积压的对局 */
