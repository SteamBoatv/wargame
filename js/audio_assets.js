'use strict';
/* ---------------- 音效 ---------------- */
let AC=null, muted=false, lastHitS=0;
function unlockAudio(){
  if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  if(AC&&AC.state==='suspended')AC.resume();
}
document.addEventListener('pointerdown',unlockAudio);
document.addEventListener('pointerup',unlockAudio);
function beep(f,dur,type,vol,slide){
  if(!AC||muted||AC.state!=='running')return;
  try{
    const o=AC.createOscillator(), g=AC.createGain(), t0=AC.currentTime;
    o.type=type||'square';
    o.frequency.setValueAtTime(f,t0);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,f+slide),t0+dur);
    g.gain.setValueAtTime((vol||0.12)*volMul,t0);
    g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t0); o.stop(t0+dur+0.02);
  }catch(e){}
}
const sClick=()=>beep(620,0.06,'square',0.07);
const sSpawn=()=>beep(300,0.12,'triangle',0.1,220);
const sShoot=()=>beep(950,0.07,'sine',0.05,-520);
function sHit(){
  const n=performance.now();
  if(n-lastHitS<70)return;
  lastHitS=n;
  meleeAlt=!meleeAlt;
  if(!playSfx(meleeAlt?'melee1':'melee2',0.32))beep(160,0.07,'sawtooth',0.06,-60);
}
const sDie=()=>beep(230,0.22,'sawtooth',0.08,-150);
const sBoom=()=>beep(90,0.3,'sawtooth',0.12,-40);
const sTankLand=()=>{beep(72,0.34,'sawtooth',0.13,-18);setTimeout(()=>beep(118,0.16,'square',0.06,-38),70);};
const sRepairPulse=()=>beep(620,0.10,'triangle',0.055,180);
const sFlag=()=>beep(720,0.15,'triangle',0.1,160);
const sEvolve=()=>[392,523,659,784].forEach((f,i)=>setTimeout(()=>beep(f,0.16,'triangle',0.12),i*110));
const sWin=()=>[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,0.18,'triangle',0.12),i*140));
const sLose=()=>[330,262,196].forEach((f,i)=>setTimeout(()=>beep(f,0.25,'sawtooth',0.09),i*180));

/* ---------------- 素材（缺失时自动回退 emoji / 合成音） ---------------- */
/* Tiny Swords：单行动画表，帧数 = 宽/高；角色默认朝右 */
const TS_COLORS=['blue','black','red','purple'];
const TS_UNITS={
  warrior:{run:'warrior_run',idle:'warrior_idle',atk:'warrior_atk'},
  guard:{run:'warrior_guard',idle:'warrior_guard',atk:'warrior_atk2'},
  lancer:{run:'lancer_run',idle:'lancer_idle',atk:'lancer_atk'},
  archer:{run:'archer_run',idle:'archer_idle',atk:'archer_atk'},
  monk:{run:'monk_run',idle:'monk_idle',atk:'monk_atk'},
  pawn:{run:'pawn_run',idle:'pawn_idle',atk:'pawn_atk'},
};
ASSETS.ts={blue:{},black:{},red:{},purple:{},misc:{decos:[]}};
ASSETS.gob={red:{},purple:{}};
ASSETS.heroTank={};
ASSETS.heroRanger={};
const HERO_TANK_ANIMS={
  idle:{file:'idle',frames:6},drive:{file:'drive',frames:6},turn:{file:'turn',frames:6},
  special:{file:'special',frames:6},moveIn:{file:'move_in',frames:4},moveOut:{file:'move_out',frames:4},
  hurt:{file:'hurt',frames:2},death:{file:'death',frames:4},
  gasStart:{file:'gas_start',frames:8},gasCycle:{file:'gas_cycle',frames:8},gasEnd:{file:'gas_end',frames:8},
};
const HERO_RANGER_ANIMS={
  idle:{file:'Idle',frames:4},walk:{file:'Walk',frames:6},
  basic:{file:'Attack1',frames:8},volley:{file:'Attack2',frames:6},
  ram:{file:'Attack3',frames:4},retreat:{file:'Attack4',frames:6},
  hurt:{file:'Hurt',frames:2},death:{file:'Death',frames:6},bullet:{file:'Bullet',frames:2,cell:6},
};
/* 哥布林多行动画表。
   常规图集用 [行, 帧数]；滚桶兵来自旧版 128px 图集，动作会跨行，改用 [列, 行] 显式帧坐标。 */
const GOB_META={
  torch:{cell:192,idle:[0,6],run:[1,6],atk:[2,6]},
  tnt:{cell:192,idle:[0,6],run:[1,6],atk:[2,7]},
  barrel:{
    cell:128,
    idle:[[0,0]],
    run:[[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[0,2]],
    atk:[[0,3],[1,3],[2,3],[3,3],[4,3],[5,3]],
    death:[[0,4],[1,4],[2,4],[0,5],[1,5],[2,5]],
  },
};
function gobAnimCount(meta,action){
  const spec=meta[action];
  return Array.isArray(spec[0])?spec.length:spec[1];
}
function gobAnimFrame(meta,action,fi){
  const spec=meta[action],cell=meta.cell||192;
  let col,row;
  if(Array.isArray(spec[0]))[col,row]=spec[Math.min(spec.length-1,Math.max(0,fi))];
  else{row=spec[0];col=Math.min(spec[1]-1,Math.max(0,fi));}
  return {cell,sx:col*cell,sy:row*cell};
}
function unitColor(side,st){return side?(st.era===2?'purple':'red'):(st.era===2?'black':'blue');}
const SFX={};
let MUSIC=null, meleeAlt=false, lastCoinS=0;
(function loadAssets(){
  const imgs={props:'assets/img/props.png'};
  for(const k in imgs){
    const im=new Image();
    im.onload=()=>{
      ASSETS.img[k]=im;
      if(k==='props')paintGround();
    };
    im.src=imgs[k];
  }
  const tsFiles=new Set();
  for(const u in TS_UNITS)for(const a in TS_UNITS[u])tsFiles.add(TS_UNITS[u][a]);
  for(const c of TS_COLORS)for(const f of tsFiles){
    const im=new Image();
    im.onload=()=>{
      ASSETS.ts[c][f]=im;
      if(c==='blue'&&typeof G!=='undefined'&&G)buildUnitButtons();
    };
    im.src='assets/ts/'+c+'_'+f+'.png';
  }
  for(const c of ['red','purple'])for(const u of ['torch','tnt','barrel']){
    const im=new Image();
    /* 军阀的出兵栏图标要用这批图，加载完必须重建按钮，否则一直停在 emoji 兜底 */
    im.onload=()=>{
      ASSETS.gob[c][u]=im;
      if(typeof G!=='undefined'&&G&&typeof buildUnitButtons==='function')buildUnitButtons();
    };
    im.src='assets/ts/gob_'+c+'_'+u+'.png';
  }
  for(const k in HERO_TANK_ANIMS){
    const im=new Image();
    im.onload=()=>{
      ASSETS.heroTank[k]=im;
      if(k==='idle'&&typeof G!=='undefined'&&G&&typeof buildUnitButtons==='function')buildUnitButtons();
    };
    im.src='assets/era3/engineer_tank/'+HERO_TANK_ANIMS[k].file+'.png';
  }
  for(const k in HERO_RANGER_ANIMS){
    const im=new Image();
    im.onload=()=>{
      ASSETS.heroRanger[k]=im;
      if(k==='idle'&&typeof G!=='undefined'&&G&&typeof buildUnitButtons==='function')buildUnitButtons();
    };
    im.src='assets/era3/engineer_ranger/'+HERO_RANGER_ANIMS[k].file+'.png';
  }
  const misc={castle_blue:1,castle_red:1,castle_destroyed:1,arrow:1,explosion:1,dynamite:1};
  for(const k in misc){
    const im=new Image();
    im.onload=()=>{ASSETS.ts.misc[k]=im;};
    im.src='assets/ts/'+k+'.png';
  }
  for(let i=1;i<=8;i++){
    const im=new Image(), idx=i-1;
    im.onload=()=>{ASSETS.ts.misc.decos[idx]=im;};
    im.src='assets/ts/deco_0'+i+'.png';
  }
  ASSETS.bldg={blue:{},red:{}};
  for(const bc of ['blue','red'])for(const bk of ['tower','house']){
    const im=new Image();
    im.onload=()=>{ASSETS.bldg[bc][bk]=im;};
    im.src='assets/ts/bldg_'+bc+'_'+bk+'.png';
  }
  /* 机械军团（Foozle Sci-Fi Lab, CC0）：单位动画 + 弹道 + 建筑 */
  ASSETS.mech={blue:{},red:{}};
  const mechUnits=['cyborg','droid01','droid02','droid03','mecha','drone'];
  const mechMisc=['proj_a','impact_a','proj_b','impact_b','tower_base','tower_gun','factory','proj_tower'];
  for(const mc of ['blue','red']){
    for(const mu of mechUnits)for(const an of ['idle','run','atk']){
      const im=new Image(), key=mu+'_'+an;
      im.onload=()=>{
        ASSETS.mech[mc][key]=im;
        if(mc==='blue'&&an==='idle'&&typeof G!=='undefined'&&G)buildUnitButtons();
      };
      im.src='assets/mech/'+mc+'_'+key+'.png';
    }
    for(const mm of mechMisc){
      const im=new Image(), key=mm;
      im.onload=()=>{ASSETS.mech[mc][key]=im;};
      im.src='assets/mech/'+mc+'_'+mm+'.png';
    }
  }
  const au={melee1:'assets/audio/melee1.wav',melee2:'assets/audio/melee2.wav',
            magic:'assets/audio/magic.wav',coin:'assets/audio/coin.wav',bow:'assets/audio/bow.wav'};
  for(const k in au){
    try{const a=new Audio();a.preload='auto';a.src=au[k];SFX[k]=a;}catch(e){}
  }
  try{MUSIC=new Audio('assets/audio/music.mp3');MUSIC.loop=true;MUSIC.volume=0.35;MUSIC.preload='auto';}catch(e){}
})();
let volMul=1;
function setVolume(v){
  volMul=v;
  if(MUSIC)MUSIC.volume=0.35*volMul;
}
function playSfx(k,vol){
  const a=SFX[k];
  if(!a||muted||a.readyState===0)return false;
  try{
    const n=a.cloneNode();
    n.volume=Math.min(1,(vol||0.5)*volMul);
    const p=n.play();
    if(p&&p.catch)p.catch(()=>{});
    return true;
  }catch(e){return false;}
}
const sBow=()=>{if(!playSfx('bow',0.4))beep(950,0.07,'sine',0.05,-520);};
const sMagic=()=>{if(!playSfx('magic',0.3))beep(700,0.12,'sine',0.06,-400);};
let lastHealS=0;
function sHeal(){
  const n=performance.now();
  if(n-lastHealS<600)return;
  lastHealS=n;
  if(!playSfx('magic',0.09))beep(700,0.1,'sine',0.025,-300);
}
function sCoin(){
  const n=performance.now();
  if(n-lastCoinS<200)return;
  lastCoinS=n;
  playSfx('coin',0.35);
}
function startMusic(){
  if(MUSIC&&!muted){try{const p=MUSIC.play();if(p&&p.catch)p.catch(()=>{});}catch(e){}}
}
