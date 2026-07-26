'use strict';
/* ---------------- 屏幕常亮（手机对战中防息屏） ---------------- */
let wakeLock=null;
async function keepAwake(){
  try{
    if('wakeLock' in navigator&&!wakeLock){
      wakeLock=await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release',()=>{wakeLock=null;});
    }
  }catch(e){}
}
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&mode==='play')keepAwake();
});

/* ---------------- 主循环 ---------------- */
let last=0;
function frame(ts){
  requestAnimationFrame(frame);
  let dt=(ts-last)/1000;
  last=ts;
  if(!(dt>0))dt=0;
  if(dt>0.05)dt=0.05;
  if(!G)return;
  if(mode==='play'&&!paused&&!G.over){
    if(G.pvp&&NET&&!NET.isHost)netGuestTick(dt);
    else if(G.pvp){
      /* 主机：按协商倍速分步模拟，保证高倍速下判定稳定 */
      const sp=G.pvpSpeed||1, n=Math.ceil(sp);
      for(let i=0;i<n&&!G.over;i++)update(dt*sp/n);
    }else{
      for(let i=0;i<gameSpeed&&!G.over;i++)update(dt);
    }
  }
  else if(G.over){updateFloats(dt);G.shake=Math.max(0,G.shake-dt*1.6);}
  if(followMode&&mode==='play'&&!paused&&!G.over)followCam(dt*gameSpeed);
  draw();
  tickEmoteCd(dt);   /* 表情冷却走真实时间，不受暂停/倍速影响 */
  refreshHUD();
}
resize();
newGame(null);
mode='menu';
const _q=new URLSearchParams(location.search);
const _pvpCode=_q.get('pvp'), _watchCode=_q.get('watch');
if(_watchCode)netWatch(_watchCode);
else if(_pvpCode)netJoin(_pvpCode);
requestAnimationFrame(ts=>{last=ts;requestAnimationFrame(frame);});
