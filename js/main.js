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
    else for(let i=0;i<gameSpeed&&!G.over;i++)update(dt);
  }
  else if(G.over){updateFloats(dt);G.shake=Math.max(0,G.shake-dt*1.6);}
  if(followMode&&mode==='play'&&!paused&&!G.over)followCam(dt*gameSpeed);
  draw();
  refreshHUD();
}
resize();
newGame(null);
mode='menu';
const _pvpCode=new URLSearchParams(location.search).get('pvp');
if(_pvpCode)netJoin(_pvpCode);
requestAnimationFrame(ts=>{last=ts;requestAnimationFrame(frame);});
