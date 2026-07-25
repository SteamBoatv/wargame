'use strict';
/* ---------------- 好友对战（WebRTC P2P：Trystero+公共MQTT 牵线，主机权威同步） ----------------
   镜像原则：客机把收到的一切按 180° 旋转存储（s→L-s, off→-off, side→1-side, xy→W-x,H-y），
   自己永远是"下方蓝方 side0"，全部现有渲染/HUD 代码无需感知联机。 */
let NET=null;
const TYPE_KEYS=Object.keys(UNITS);
/* 弹道类型线材编码表（只可追加，不可重排——索引会写进快照） */
const PROJ_KINDS=['arrow','dynamite','shell','laser_a','laser_b','laser_t'];
const PVP_PER={icon:'⚔️',name:'好友对战',roster:null,decide:[9,9],queue:0,eco:0,mult:1,smart:false,evolve:true};

async function netLib(){
  if(window.__try)return window.__try;
  window.__try=await import('./lib/trystero-mqtt.min.js');
  return window.__try;
}
function netCode(){
  const cs='abcdefghjkmnpqrstuvwxyz23456789';
  let s='';
  for(let i=0;i<6;i++)s+=cs[(Math.random()*cs.length)|0];
  return s;
}
function netSupported(){return location.protocol==='http:'||location.protocol==='https:';}
function netFx(o){if(G&&G.pvp&&G.pvpHost&&NET)NET.sendFx(o);}

async function netOpen(code,role){
  /* role: 'host' | 'guest' | 'spectator' —— 观众只收不发，且不占玩家位 */
  const isHost=role==='host', spectator=role==='spectator';
  const lib=await netLib();
  const room=lib.joinRoom({appId:'kip-wargame-pvp-v1'},'wg-'+code);
  const [sendCmd,onCmd]=room.makeAction('c');
  const [sendSnap,onSnap]=room.makeAction('s');
  const [sendFx,onFx]=room.makeAction('f');
  const [sendMeta,onMeta]=room.makeAction('m');
  const [sendEmote,onEmote]=room.makeAction('g');
  NET={room,code,role,isHost,spectator,peer:null,specs:{},specCount:0,
       specMirror:false,lastStart:null,started:false,
       sendCmd,sendSnap,sendFx,sendMeta,sendEmote,snapT:0,specSnapT:0};
  /* Trystero 房间是全网状连接，广播天然到达所有人，无需主机中继 */
  onEmote(i=>{
    if(!G||!G.pvp)return;
    const d=(i&&typeof i==='object')?i:{i:i|0};
    if(d.spec){showSpecEmote(d.i|0);return;}
    /* 玩家表情：观众按当前视角归位，玩家则一律显示在对面 */
    const side=NET.spectator?(NET.specMirror?1-(d.side||0):(d.side||0)):1;
    showEmote(side,d.i|0);
  });
  room.onPeerJoin(id=>{
    /* 自报身份，让对方知道该把我当玩家还是观众 */
    try{sendMeta({k:'iam',role},id);}catch(e){sendMeta({k:'iam',role});}
    if(!spectator&&!isHost)NET.peer=NET.peer||id;
    netLobbyStatus();
    sFlag();
  });
  room.onPeerLeave(id=>{
    if(NET.specs[id]){
      delete NET.specs[id];
      NET.specCount=Math.max(0,NET.specCount-1);
      netLobbyStatus();
      return; /* 观众进出绝不能影响对局 */
    }
    if(id!==NET.peer&&NET.peer)return;
    NET.peer=null;
    if(G&&G.pvp&&!G.over){
      if(NET.spectator)netSpecEnd('对局已结束（房主离线）');
      else netShowEnd(true,'对方已断线');
    }else netLobbyStatus();
  });
  /* 观众发来的任何指令一律丢弃 */
  onCmd((c,fromId)=>{
    if(!NET||!NET.isHost||!G||!G.pvp||G.over)return;
    if(NET.specs[fromId]||fromId!==NET.peer)return;
    netApplyCmd(c);
  });
  onSnap(sn=>{if(NET&&!NET.isHost)netApplySnap(sn);});
  onFx(f=>{if(NET&&!NET.isHost)netApplyFx(f);});
  onMeta((mt,fromId)=>{
    if(!NET)return;
    if(mt.k==='iam'){
      if(mt.role==='spectator'){
        if(!NET.specs[fromId]){NET.specs[fromId]=1;NET.specCount++;}
        /* 中途进来的观众缺开局信息，主机定向补发一份 */
        if(NET.isHost&&NET.started&&NET.lastStart)
          try{sendMeta(Object.assign({k:'start'},NET.lastStart),fromId);}catch(e){}
        netLobbyStatus();
      }else if(!NET.spectator){
        if(NET.isHost&&NET.peer&&NET.peer!==fromId){
          try{sendMeta({k:'full'},fromId);}catch(e){}
          return;
        }
        NET.peer=fromId;
        if(NET.isHost)sendMeta({k:'hi'},fromId);
        if(NET.myLocked)sendMeta({k:'cmdrLock',c:NET.myCmdr});
        netLobbyStatus();
      }
      return;
    }
    if(mt.k==='full'&&!NET.spectator&&!NET.isHost){
      $('pvpStatus').textContent='⚠️ 房间里已经有两名玩家了 —— 可改用观战链接围观';
      return;
    }
    if(NET.spectator){
      if(mt.k==='start')netStartSpectator(mt);
      else if(mt.k==='end')netSpecEnd(mt.winner===0?'🔵 蓝方获胜':'🔴 红方获胜');
      return;
    }
    if(mt.k==='hi'){NET.peer=NET.peer||fromId||'host';netLobbyStatus();}
    else if(mt.k==='cmdrLock'){NET.peerCmdr=mt.c;NET.peerLocked=true;netLobbyStatus();netMaybeReveal();sFlag();}
    else if(mt.k==='start'&&!NET.isHost)netStartGuest(mt);
    else if(mt.k==='end'&&!NET.isHost)netShowEnd(mt.winner===1,null);
    else if(mt.k==='spdReq')showSpdAsk(mt.to);
    else if(mt.k==='spdRes')onSpdRes(mt);
  });
}
async function netCreate(){
  if(!netSupported()){toast('⚠️ 联机需要通过网页链接访问（file:// 本地模式不可用）');return;}
  showPvpLobby();
  $('pvpStatus').textContent='正在创建房间…';
  try{await netOpen(netCode(),'host');}
  catch(e){$('pvpStatus').textContent='创建失败：'+(e&&e.message||e);return;}
  netLobbyStatus();
}
async function netJoin(code){
  if(!netSupported()){toast('⚠️ 联机需要通过网页链接访问');return;}
  showPvpLobby();
  $('pvpStatus').textContent='正在加入房间 '+code+' …';
  try{await netOpen(code,'guest');}
  catch(e){$('pvpStatus').textContent='加入失败：'+(e&&e.message||e);return;}
  netLobbyStatus();
}
async function netWatch(code){
  if(!netSupported()){toast('⚠️ 观战需要通过网页链接访问');return;}
  showPvpLobby();
  $('pvpPickSec').style.display='none';
  $('pvpStatus').textContent='👁️ 正在连接房间 '+code+' …（等待对局开始）';
  try{await netOpen(code,'spectator');}
  catch(e){$('pvpStatus').textContent='连接失败：'+(e&&e.message||e);return;}
  netLobbyStatus();
}
function showPvpLobby(){
  mode='menu';
  $('menu').classList.add('hidden');
  $('pvpov').classList.remove('hidden');
}
function netLink(){
  return location.origin+location.pathname+'?pvp='+NET.code;
}
function netWatchLink(){
  return location.origin+location.pathname+'?watch='+NET.code;
}
/* 大厅流程：连接 → 双方选人并确认 → 房主开战 */
function netLockCmdr(){
  if(!NET||NET.myLocked)return;
  if(!NET.peer){toast('⌛ 等对方加入后再确认');return;}
  NET.myCmdr=selCmdr;
  NET.myLocked=true;
  NET.sendMeta({k:'cmdrLock',c:selCmdr});
  netLobbyStatus();
  netMaybeReveal();
  sClick();
}
/* 暗牌：双方都锁定后才互相揭晓 */
function netMaybeReveal(){
  if(NET&&NET.myLocked&&NET.peerLocked&&!NET.revealed){
    NET.revealed=true;
    const foe=COMMANDERS[NET.peerCmdr||'marshal'];
    toast('🎭 指挥官揭晓！对方是 '+foe.icon+' '+foe.name);
    netLobbyStatus();
    sEvolve();
  }
}
function netLobbyStatus(){
  if(!NET)return;
  const specTxt=NET.specCount?('　👁️ 观众 '+NET.specCount+' 人'):'';
  if(NET.spectator){
    $('pvpLink').textContent='房间号：'+NET.code;
    $('btnPvpCopy').style.display='none';
    $('btnPvpWatch').style.display='none';
    $('pvpPickSec').style.display='none';
    $('btnPvpStart').style.display='none';
    $('pvpFoeCmdr').textContent='';
    $('pvpStatus').textContent=NET.started?'👁️ 观战中…':'👁️ 已连接，等待房主开战…';
    return;
  }
  $('pvpLink').textContent=NET.isHost?netLink():('房间号：'+NET.code);
  $('btnPvpCopy').style.display=NET.isHost?'':'none';
  $('btnPvpWatch').style.display=NET.isHost?'':'none';
  $('pvpPickSec').style.display=NET.peer?'flex':'none';
  const bothLocked=NET.myLocked&&NET.peerLocked;
  let foeTxt='';
  if(NET.peer){
    if(bothLocked){
      const foe=COMMANDERS[NET.peerCmdr||'marshal'];
      foeTxt='🎭 对方指挥官：'+foe.icon+' '+foe.name;
    }else if(NET.peerLocked)foeTxt='🎭 对方已确认（选择保密，等你确认后揭晓）';
    else foeTxt='⌛ 对方选择指挥官中…';
  }
  $('pvpFoeCmdr').textContent=foeTxt;
  $('btnCmdrLock').style.display=NET.myLocked?'none':'';
  buildCmdrPick('pvpCmdrPick');
  const both=NET.myLocked&&NET.peerLocked;
  if(!NET.peer){
    $('pvpStatus').textContent=(NET.isHost?'⌛ 等待好友通过链接加入…':'⌛ 正在连接房主…（P2P 打洞最多需十几秒）')+specTxt;
    $('btnPvpStart').style.display='none';
  }else if(!NET.myLocked){
    $('pvpStatus').textContent='🎖️ 双方已连接，请选择你的指挥官并确认'+specTxt;
    $('btnPvpStart').style.display='none';
  }else if(!both){
    $('pvpStatus').textContent='✅ 已确认，等待对方选择指挥官…'+specTxt;
    $('btnPvpStart').style.display='none';
  }else{
    $('pvpStatus').textContent=(NET.isHost?'⚔️ 双方就绪，可以开战！':'⚔️ 双方就绪，等待房主开始…')+specTxt;
    $('btnPvpStart').style.display=NET.isHost?'':'none';
  }
}
function netLeave(){
  if(NET){try{NET.room.leave();}catch(e){}}
  NET=null;
  if(G){G.pvp=false;G.spectator=false;}
  document.body.classList.remove('spectating');
  $('specBadge').classList.add('hidden');
  $('btnAgain').style.display='';
  $('pvpov').classList.add('hidden');
}

/* ---- 开局 ---- */
function netStartMatch(){
  if(!NET||!NET.isHost||!NET.peer)return;
  if(!NET.myLocked||!NET.peerLocked){toast('⌛ 双方确认指挥官后才能开战');return;}
  const def=genMapDef({});
  const events=[];
  if(Math.random()<0.7)events.push({at:45+Math.random()*60,type:['gold','meteor','bounty'][(Math.random()*3)|0],done:false});
  const c0=NET.myCmdr||'marshal', c1=NET.peerCmdr||'marshal';
  NET.lastStart={def,events,c0,c1};
  NET.started=true;
  NET.sendMeta({k:'start',def,events,c0,c1});
  netStartCommon(def,events,true,c0,c1);
}
function netStartGuest(mt){
  /* 客机镜像：自己是本地 side0，所以自己的指挥官是 mt.c1 */
  netStartCommon(mt.def,mt.events||[],false,mt.c1||'marshal',mt.c0||'marshal');
}
/* 观众：不镜像，直接用房主坐标系；蓝方=房主(side0)、红方=客人(side1) */
function netStartSpectator(mt){
  RUN=null;
  NET.started=true;
  const stage={
    node:{t:'pvp'},per:PVP_PER,
    cmdr0:mt.c0||'marshal',cmdr1:mt.c1||'marshal',
    events:[],mapDef:NET.specMirror?mirrorDef(mt.def):mt.def,
    aiIncomeMul:1,hpMul:1,dmgMul:1,gobColor:'red',
  };
  NET.specDef=mt.def;
  newGame(stage);
  G.pvp=true; G.pvpHost=false; G.spectator=true; G.pvpSpeed=1;
  G._umap={};G._pmap={};G.uidSeq=0;G.pidSeq=0;
  mode='play';
  ['pvpov','menu','mapov','gameover','runover'].forEach(id=>$(id).classList.add('hidden'));
  document.body.classList.add('spectating');
  toast('👁️ 观战开始：'+COMMANDERS[stage.cmdr0].icon+'蓝方 vs '+COMMANDERS[stage.cmdr1].icon+'红方');
  $('wTag').textContent='';
  keepAwake();
  startMusic();
}
/* 观众切换视角：清空插值缓存，让下一帧快照按新朝向重建 */
function specFlipView(){
  if(!NET||!NET.spectator||!NET.specDef)return;
  NET.specMirror=!NET.specMirror;
  buildWorld(NET.specMirror?mirrorDef(NET.specDef):NET.specDef);
  G.flags=CUR_DEF.flags.map(fs=>({s:fs*L,owner:-1,prog:0}));
  G.units=[];G.projs=[];G.turrets=[];G.piles=[];G.booms=[];
  G._umap={};G._pmap={};
  const c0=G.cmdr0,c1=G.cmdr1;
  G.cmdr0=c1;G.cmdr1=c0;
  cam.x=BASE0.x;cam.y=BASE0.y-120;clampCam();
  buildUnitButtons();
  toast('🔄 已切换到'+(NET.specMirror?'红方':'蓝方')+'视角');
  sClick();
}
function netSpecEnd(txt){
  if(G)G.over=1;
  $('goTitle').textContent='👁️ '+(txt||'对局结束');
  $('btnAgain').style.display='none';
  $('gameover').classList.remove('hidden');
  sWin();
}
function mirrorDef(def){
  return {
    ctrl:def.ctrl.slice().reverse().map(p=>[WORLD_W-p[0],def.H-p[1]]),
    H:def.H,
    forks:def.forks.map(f=>({a:1-f.b,b:1-f.a})),
    chokes:def.chokes.map(c=>({c:1-c.c,w:c.w})),
    flags:def.flags.map(f=>1-f),
  };
}
function netStartCommon(def,events,isHost,myCmdr,foeCmdr){
  RUN=null; /* 对战不带远征强化，保证公平 */
  const stage={
    node:{t:'pvp'},per:PVP_PER,
    cmdr0:myCmdr||'marshal',cmdr1:foeCmdr||'marshal',
    events:isHost?events:[],
    mapDef:isHost?def:mirrorDef(def),
    aiIncomeMul:1,hpMul:1,dmgMul:1,gobColor:'red',
  };
  newGame(stage);
  G.pvp=true;
  G.pvpHost=isHost;
  G.pvpSpeed=1;
  spdPend=0;spdCoolUntil=0;
  $('spdAsk').classList.add('hidden');
  updateSpeedBtn();
  G._umap={};G._pmap={};
  G.uidSeq=0;G.pidSeq=0;
  mode='play';
  ['pvpov','menu','mapov'].forEach(id=>$(id).classList.add('hidden'));
  toast('⚔️ 对战开始！你是蓝方（下方），摧毁对方城堡获胜');
  keepAwake();
  $('wTag').textContent='';
  startMusic();
}

/* ---- 客机指令 ---- */
function netSendBuy(k){NET.sendCmd({a:'b',k});}
function netSendIncome(){NET.sendCmd({a:'i'});}
function netSendEvolve(){NET.sendCmd({a:'e'});}
function netApplyCmd(c){
  if(c.a==='b'){
    const k=c.k;
    if(!cmdrOf(1).roster[G.aiEra].includes(k))return;
    const st=UNITS[k];
    if(G.aiMoney<st.cost||G.aiQueue.length>=QUEUE_MAX)return;
    G.aiMoney-=st.cost;
    G.aiQueue.push({type:k,t:st.build});
  }else if(c.a==='i'){
    if(!cmdrOf(1).mining)return; /* 指挥官门控：机械军团没有挖矿 */
    if(G.aiIncomeLvl>=INCOME_MAX_LVL)return;
    const cost=incomeCost(G.aiIncomeLvl);
    if(G.aiMoney<cost)return;
    G.aiMoney-=cost;G.aiIncomeLvl++;G.aiIncome+=INCOME_STEP;
  }else if(c.a==='e'){
    if(G.aiEra!==1||G.aiXp<EVOLVE_XP||G.aiMoney<EVOLVE_COST)return;
    G.aiMoney-=EVOLVE_COST;G.aiEra=2;G.flash=1;
    toast('⚠️ 对方进化到了王国时代！');
    sEvolve();
    if(NET)NET.sendFx({k:'ev'});
  }else if(c.a==='p'){
    if(!cmdrOf(1).place.includes(c.t))return;
    if(c.t==='turret'){turretPlaceCore(1,c.x,c.y,false);return;}
    const pr=nearestPath(c.x,c.y);
    if(!pr||pr.d>76*pr.wf||pr.sep>5)return;
    if(PLACEABLES[c.t].drop)airdropCore(1,pr.s);
    else buildingPlaceCore(1,c.t,pr.s,false);
  }
}

/* ---- 主机快照 ---- */
function netHostSnap(dt){
  NET.snapT-=dt;
  NET.specSnapT-=dt;
  if(NET.snapT>0)return;
  NET.snapT=0.1;
  /* 观众多了会吃掉房主上行带宽，3 人及以上时观众降到 5Hz（插值渲染够用） */
  const specIds=Object.keys(NET.specs);
  let targets=null;
  if(specIds.length){
    if(specIds.length>=3&&NET.specSnapT>0)targets=NET.peer?[NET.peer]:[];
    else NET.specSnapT=0.2;
  }
  for(const p of G.projs)if(!p.pid)p.pid=++G.pidSeq;
  try{
    const snap={
      t:Math.round(G.t*10)/10,
      sp:Math.round((G.pvpSpeed||1)*100)/100,
      wk:Math.max(0,WEATHER_KEYS.indexOf(G.weatherKey||'clear')),
      wt:Math.round(G.weatherT*10)/10,
      m0:G.money|0,m1:G.aiMoney|0,
      i0:G.income,i1:G.aiIncome,
      e0:G.era,e1:G.aiEra,
      x0:G.xp|0,il0:G.incomeLvl,       /* 观众上帝视角需要双方经济 */
      x1:G.aiXp|0,il1:G.aiIncomeLvl,
      bh:[Math.round(G.baseHp[0]),Math.round(G.baseHp[1])],
      bt:Math.round(G.bountyT*10)/10,
      pc:Object.fromEntries(Object.keys(G.pcds).map(k=>[k,[Math.round(G.pcds[k][0]*10)/10,Math.round(G.pcds[k][1]*10)/10]])),
      fl:G.flags.map(f=>[f.owner,Math.round(f.prog*100)]),
      us:G.units.map(u=>[u.uid,TYPE_KEYS.indexOf(u.type),u.side,Math.round(u.s),Math.round(u.off),
        Math.round(u.hp),u.max,(u.moving?1:0)|(u.star?2:0)|(u.dying?4:0)|(u.atkT<0.4?8:0)]),
      pr:G.projs.map(p=>[p.pid,Math.max(0,PROJ_KINDS.indexOf(p.kind)),
        Math.round(p.x),Math.round(p.y),Math.round(p.ang*100),p.side?1:0]),
      tr:G.turrets.map(t=>[t.side||0,Math.round(t.x),Math.round(t.y),
        Math.round(t.ang*100),Math.round(t.life*10),Math.round((t.flash||0)*100)]),
      pi:G.piles.map(p=>[Math.round(p.s),p.amt]),
      bm:G.booms.map(b=>[Math.round(b.x),Math.round(b.y),Math.round(b.t*100)]),
      q1:G.aiQueue.map(i=>[TYPE_KEYS.indexOf(i.type),Math.round(i.t*10)]),
      q0:G.queue.map(i=>[TYPE_KEYS.indexOf(i.type),Math.round(i.t*10)]),
    };
    if(targets)NET.sendSnap(snap,targets);
    else NET.sendSnap(snap);
  }catch(e){}
}

/* ---- 客机应用快照（全部镜像） ---- */
function netApplySnap(sn){
  if(!G||!G.pvp)return;
  if(Math.abs(G.t-sn.t)>0.5)G.t=sn.t;
  if(sn.sp&&sn.sp!==G.pvpSpeed){G.pvpSpeed=sn.sp;updateSpeedBtn();}
  /* 天气由主机权威决定，客机跟随（否则两边减速不一致会失同步） */
  if(sn.wk!==undefined){
    const wkey=WEATHER_KEYS[sn.wk]||'clear';
    if(wkey!==G.weatherKey)setWeather(wkey,sn.wt,true);
    G.weatherT=sn.wt;
  }
  /* mir=1：客机镜像（自己永远在下方）。mir=0：观众直看房主坐标系。
     观众按 specMirror 决定要不要翻转，两种模式共用同一段代码。 */
  const mir=(NET&&NET.spectator)?(NET.specMirror?1:0):1;
  const MS=v=>mir?L-v:v, MX=v=>mir?WORLD_W-v:v, MY=v=>mir?WORLD_H-v:v;
  const MSIDE=v=>mir?1-v:v, MOFF=v=>mir?-v:v, MANG=v=>mir?v+Math.PI:v;
  const myM=mir?sn.m1:sn.m0, myI=mir?sn.i1:sn.i0, myE=mir?sn.e1:sn.e0;
  const myX=mir?sn.x1:sn.x0, myIL=mir?sn.il1:sn.il0;
  G.money=myM;G.income=myI;
  if(G.era!==myE){G.era=myE;buildUnitButtons();} /* 时代变更必须重建兵种栏（修复客机进化后无法出兵） */
  G.xp=myX;G.incomeLvl=(myIL===undefined?G.incomeLvl:myIL);
  G.aiMoney=mir?sn.m0:sn.m1;
  G.aiEra=mir?sn.e0:sn.e1;
  G.aiIncome=mir?sn.i0:sn.i1;
  G.aiXp=(mir?sn.x0:sn.x1)||0;
  G.baseHp=mir?[sn.bh[1],sn.bh[0]]:[sn.bh[0],sn.bh[1]];
  G.bountyT=sn.bt;
  if(sn.pc)for(const k in sn.pc)if(G.pcds[k])G.pcds[k]=mir?[sn.pc[k][1],sn.pc[k][0]]:[sn.pc[k][0],sn.pc[k][1]];
  G.flags.forEach((f,i)=>{
    const a=sn.fl[mir?i:(sn.fl.length-1-i)];
    if(!a)return;
    f.owner=a[0]===-1?-1:MSIDE(a[0]);
    f.prog=mir?-a[1]/100:a[1]/100;
  });
  const seen={};
  for(const a of sn.us){
    const uid=a[0];
    seen[uid]=1;
    const side=MSIDE(a[2]), s=MS(a[3]), off=MOFF(a[4]), hp=a[5], max=a[6], fl=a[7];
    let u=G._umap[uid];
    if(!u){
      u={uid,side,type:TYPE_KEYS[a[1]],s,off,hp,max,cd:9,walk:rand(0,6),lunge:0,
         dying:(fl&4)?0.001:0,moving:!!(fl&1),kills:0,star:!!(fl&2),atkT:9,animT:rand(0,9),_ts:s};
      G._umap[uid]=u;
      G.units.push(u);
    }else{
      u._ts=s;u.off=off;u.hp=hp;u.max=max;
      u.type=TYPE_KEYS[a[1]];
      u.moving=!!(fl&1);u.star=!!(fl&2);
      if((fl&8)&&u.atkT>0.5)u.atkT=0;
      if((fl&4)&&!u.dying)u.dying=0.001;
    }
  }
  for(const uid in G._umap){
    if(!seen[uid]){
      const u=G._umap[uid];
      if(!u.dying)u.dying=0.001;
      delete G._umap[uid];
    }
  }
  const pseen={}, newPr=[];
  for(const a of sn.pr){
    pseen[a[0]]=1;
    const x=MX(a[2]), y=MY(a[3]), ang=MANG(a[4]/100);
    let p=G._pmap[a[0]];
    const kind=PROJ_KINDS[a[1]]||'shell';
    const mside=MSIDE(a[5]||0);
    if(!p){
      p={pid:a[0],kind,x,y,_tx:x,_ty:y,ang,side:mside,dead:false};
      G._pmap[a[0]]=p;
    }else{p._tx=x;p._ty=y;p.ang=ang;p.kind=kind;p.side=mside;}
    newPr.push(p);
  }
  for(const pid in G._pmap)if(!pseen[pid])delete G._pmap[pid];
  G.projs=newPr;
  G.turrets=sn.tr.map(a=>({side:MSIDE(a[0]),x:MX(a[1]),y:MY(a[2]),
    ang:MANG(a[3]/100),life:a[4]/10,flash:a[5]/100,cd:9}));
  G.piles=sn.pi.map(a=>({s:MS(a[0]),amt:a[1]}));
  const nb=sn.bm.map(a=>({x:MX(a[0]),y:MY(a[1]),t:a[2]/100}));
  if(nb.some(b=>b.t<0.12)&&!G._boomHint){sBoom();G._boomHint=true;}
  if(!nb.length)G._boomHint=false;
  G.booms=nb;
  const myQ=mir?sn.q1:(sn.q0||sn.q1);
  G.queue=(myQ||[]).map(a=>({type:TYPE_KEYS[a[0]],t:a[1]/10}));
  const foeQ=mir?sn.q0:sn.q1;
  G.aiQueue=(foeQ||[]).map(a=>({type:TYPE_KEYS[a[0]],t:a[1]/10}));
}

/* ---- 客机每帧（不模拟战斗，只插值+动画） ---- */
function netGuestTick(dt){
  G.t+=dt;
  for(const u of G.units){
    if(u.dying){u.dying+=dt;continue;}
    u.atkT+=dt;
    if(u._ts!==undefined)u.s+=(u._ts-u.s)*Math.min(1,dt*10);
    if(u.moving){u.animT+=dt;u.walk+=dt*8;}
  }
  G.units=G.units.filter(u=>u.dying<=0.45);
  for(const p of G.projs){
    p.x+=(p._tx-p.x)*Math.min(1,dt*14);
    p.y+=(p._ty-p.y)*Math.min(1,dt*14);
  }
  for(const b of G.booms)b.t+=dt;
  G.booms=G.booms.filter(b=>b.t<0.9);
  updateFloats(dt);
  if(G.banner){G.banner.a-=dt;if(G.banner.a<=0)G.banner=null;}
  G.flash=Math.max(0,G.flash-dt*1.2);
  G.shake=Math.max(0,G.shake-dt*1.6);
  if(G.bountyT>0)G.bountyT-=dt;
}

/* ---- 特效中继 ---- */
function netApplyFx(f){
  if(!G||!G.pvp)return;
  const spec=NET&&NET.spectator;
  /* 观众不属于任何一方，措辞改成蓝方/红方（side 按当前视角归位） */
  const who=s=>{
    const v=NET.specMirror?1-s:s;
    return v===0?'🔵 蓝方':'🔴 红方';
  };
  if(f.k==='tn')toast(f.x);
  else if(f.k==='ts')toast(spec?(who(f.side)+f.x):((f.side===1?'💰 我方':'⚠️ 对方')+f.x));
  else if(f.k==='fc'){
    toast(spec?(who(f.side)+'占领哨站！'):(f.side===1?'🚩 我方占领哨站！':'⚠️ 对方占领了哨站'));
    sFlag();
  }
  else if(f.k==='ev'){toast(spec?(who(1)+'进化完成！'):'👑 我方进化完成！');G.flash=1;sEvolve();}
  else if(f.k==='evh'){toast(spec?(who(0)+'进化完成！'):'⚠️ 对方进化到了王国时代！');G.flash=1;sEvolve();}
  else if(f.k==='bn')showBanner(f.x);
  else if(f.k==='wx'){
    const w=WEATHERS[f.key]||WEATHERS.clear;
    if(f.key==='clear')toast('☀️ 天气转晴');
    else{toast(w.icon+' '+w.name+'来袭：'+w.desc);showBanner(w.icon+' '+w.name+'!');sFlag();}
  }
}

/* ---- 倍速申请（+0.25/次，对方同意才生效；被拒 1 分钟冷却，次数不限） ---- */
let spdPend=0, spdCoolUntil=0, spdAskTo=0, spdAskTimer=null;
function updateSpeedBtn(){
  const el=$('spdVal');
  if(!el)return;
  if(G&&G.pvp)el.textContent=spdPend?'⌛':'×'+(G.pvpSpeed||1);
  else el.textContent='×'+gameSpeed;
}
function speedBtnTap(){
  if(!G||mode!=='play'||G.over||G.spectator)return;
  if(!G.pvp){
    gameSpeed=gameSpeed>=3?1:gameSpeed+1;
    updateSpeedBtn();
    sClick();
    return;
  }
  const now=performance.now();
  if(spdPend){toast('⏳ 提速申请已发出，等待对方回应…');return;}
  if(now<spdCoolUntil){
    toast('🚫 被拒绝后 1 分钟内不能再次申请（还剩 '+Math.ceil((spdCoolUntil-now)/1000)+' 秒）');
    return;
  }
  const to=Math.round(((G.pvpSpeed||1)+0.25)*100)/100;
  spdPend=to;
  NET.sendMeta({k:'spdReq',to});
  toast('⏩ 已申请提速至 ×'+to+'，等待对方同意…');
  updateSpeedBtn();
  sClick();
}
function showSpdAsk(to){
  if(!G||!G.pvp||G.over)return;
  spdAskTo=to;
  $('spdAskTxt').textContent='⏩ 对方申请把战斗速度提升至 ×'+to;
  $('spdAsk').classList.remove('hidden');
  sFlag();
  clearTimeout(spdAskTimer);
  spdAskTimer=setTimeout(()=>{ /* 12 秒未回应：不算拒绝，不触发冷却 */
    if(!$('spdAsk').classList.contains('hidden')){
      $('spdAsk').classList.add('hidden');
      if(NET)NET.sendMeta({k:'spdRes',ok:false,to:spdAskTo,noPen:true});
    }
  },12000);
}
function answerSpd(ok){
  clearTimeout(spdAskTimer);
  $('spdAsk').classList.add('hidden');
  if(!NET)return;
  NET.sendMeta({k:'spdRes',ok,to:spdAskTo});
  if(ok){
    applySpeedLocal(spdAskTo);
    toast('⏩ 已同意，战斗速度提升至 ×'+spdAskTo);
  }else{
    toast('已拒绝对方的提速申请');
  }
}
function onSpdRes(mt){
  if(mt.ok){
    applySpeedLocal(mt.to);
    toast('⏩ 对方同意！战斗速度提升至 ×'+mt.to);
  }else if(mt.noPen){
    toast('⏳ 对方未回应提速申请，可再次申请');
  }else{
    spdCoolUntil=performance.now()+60000;
    toast('🚫 对方拒绝了提速申请，1 分钟后可再次申请');
  }
  spdPend=0;
  updateSpeedBtn();
}
function applySpeedLocal(to){
  if(G)G.pvpSpeed=to;
  updateSpeedBtn();
}

/* ---- 快速表情（仅固定表情，不能发文字；EMOTES 表在 data.js） ---- */
let lastEmoteT=0;
function sendEmoteIdx(i){
  const n=performance.now();
  if(n-lastEmoteT<1500)return;
  lastEmoteT=n;
  const spec=!!(NET&&NET.spectator);
  if(NET&&NET.sendEmote){
    try{NET.sendEmote({i,spec,side:(NET.isHost?0:1)});}catch(e){}
  }
  if(spec)showSpecEmote(i);
  else showEmote(0,i);
  $('emoteBar').classList.add('hidden');
}
/* 观众表情：屏幕边缘的横向气泡流，与玩家表情明确区分 */
function showSpecEmote(i){
  const wrap=$('specEmotes');
  if(!wrap)return;
  const d=document.createElement('div');
  d.className='specbub';
  d.textContent='👁️'+(EMOTES[i]||'😄');
  wrap.appendChild(d);
  while(wrap.children.length>5)wrap.removeChild(wrap.firstChild);
  setTimeout(()=>d.remove(),3400);
}
function showEmote(side,i){
  if(!G)return;
  const e=EMOTES[i]||'😄';
  const b=side?BASE1:BASE0;
  G.emotes=G.emotes||[];
  G.emotes.push({x:b.x+(side?76:-76),y:b.y-70,e,t:0});
  if(G.emotes.length>4)G.emotes.shift();
  sClick();
}

/* ---- 结算 ---- */
function netShowEnd(won,reason){
  clearTimeout(spdAskTimer);
  $('spdAsk').classList.add('hidden');
  if(G)G.over=won?1:-1;
  $('goTitle').textContent=(won?'🎉 胜利！':'💀 战败…')+(reason?'（'+reason+'）':'');
  $('btnAgain').style.display='none';
  $('gameover').classList.remove('hidden');
  if(won)sWin();else sLose();
}
