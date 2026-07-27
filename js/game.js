'use strict';
/* ---------------- 游戏状态 ---------------- */
let G=null, mode='menu', paused=false, followMode=true, gameSpeed=1;
function newGame(stage){
  stage=stage||makeStage(null);
  buildWorld(stage.mapDef||null);
  const per=stage.per;
  const c0=stage.cmdr0||(RUN&&RUN.cmdr)||'marshal';
  const c1=stage.cmdr1||'marshal';
  const isPvp=stage.node&&stage.node.t==='pvp';
  G={stage,per,t:0,over:0,
     cmdr0:c0,cmdr1:c1,
     weather:WEATHERS.clear,weatherKey:'clear',weatherT:0,
     weatherNext:rand(WEATHER_FIRST[0],WEATHER_FIRST[1]),
     events:(stage.events||[]).map(e=>({...e})),
     piles:[],bountyT:0,
     money:150+(RUN?RUN.mods.gold+RUN.goldCarry:0),
     income:COMMANDERS[c0].income+(RUN?RUN.mods.income:0),
     incomeLvl:0,era:1,
     xp:RUN?Math.round(EVOLVE_XP*RUN.mods.xp0):0,
     aiMoney:150,aiIncome:isPvp?COMMANDERS[c1].income:8*stage.aiIncomeMul,aiIncomeLvl:0,aiDecide:2,aiPlan:null,
     aiEra:per.aiEra||1,aiXp:0,
     baseHp:[BASE_HP,BASE_HP],
     units:[],projs:[],floats:[],queue:[],aiQueue:[],shake:0,spawnCnt:[0,0],
     flags:CUR_DEF.flags.map(fs=>({s:fs*L,owner:-1,prog:0})),
     strikes:[],pcds:{strike:[0,0],airdrop:[0,0],barricade:[0,0],tower:[0,0],workshop:[0,0]},booms:[],
     streakN:0,streakT:-9,lastWarn:-9,banner:null,flash:0};
  if(RUN)RUN.goldCarry=0;
  placing=false; placePos=null;
  setPaused(false);
  buildUnitButtons();
  qSig='__init'; lastIncomeLvlShown=-1; lastMoneyTxt='';
  cam.z=clamp(cssW/WORLD_W,0.5,1.1);
  cam.x=BASE0.x; cam.y=BASE0.y-120; clampCam();
  setFollow(true);
  refreshHUD();
}
function unitPos(u){
  const p=pathPos(u.s);
  const lat=u.off*p.wf+(u.off<0?-1:1)*(p.sep/2);
  return {x:p.x+p.nx*lat, y:p.y+p.ny*lat, tx:p.tx, ty:p.ty};
}
const LANE_SLOTS=[0,-22,22,-44,44];
function spawnUnit(side,type){
  const st=UNITS[type];
  const off=LANE_SLOTS[G.spawnCnt[side]++%LANE_SLOTS.length]+rand(-5,5);
  const hpMul=side?(G.stage?G.stage.hpMul:1):(RUN?RUN.mods.hp:1)*famMod(type,'hp');
  const hp=Math.round(st.hp*hpMul);
  G.units.push({uid:(G.uidSeq=(G.uidSeq||0)+1),side,type,s:side?L-70:70,off,hp,max:hp,
    cd:rand(0.1,0.4),walk:rand(0,6),lunge:0,dying:0,moving:false,kills:0,vet:0,
    atkT:9,animT:rand(0,9)});
  sSpawn();
}
function addFloat(x,y,txt,c,sz){G.floats.push({x,y,txt,a:1.4,c:c||'#ffd76a',sz:sz||22});}
function toast(txt){
  const d=document.createElement('div');
  d.className='tmsg'; d.textContent=txt;
  $('toast').appendChild(d);
  setTimeout(()=>d.remove(),3100);
}
function showBanner(txt){G.banner={txt,a:1.6};}
function bumpStreak(){
  if(G.t-G.streakT<2.5)G.streakN++; else G.streakN=1;
  G.streakT=G.t;
  if(G.streakN===3)showBanner('⚡ 三连斩!');
  else if(G.streakN===5)showBanner('🔥 五连斩!');
  else if(G.streakN===8)showBanner('💥 八连斩!!');
}

function damage(e,dmg,bySide,attacker){
  if(e.dying)return;
  /* 受击打断回收引导（不退款、恢复产出）：否则"看到红圈点回收"3 秒内要打出 600 伤害
     才拦得住，火力覆盖单轮期望仅 203——回收会变成敌方火力下的无风险撤资 */
  if(e.recT&&UNITS[e.type].cls==='bldg')e.recT=0;
  e.hp-=dmg;
  if(e.hp<=0){
    e.dying=1e-4;
    /* 拆建筑只捡废料：赏金减半、零经验、零军衔、零连斩、双倍赏金不生效。
       建筑的价值主要在"断掉对方产出"，全额悬赏是重复计价——旧规则下拆全套建筑
       等于白送对手一次完整进化，是元帅免疫、只有工程师在交的单向税。 */
    const isBldg=UNITS[e.type].cls==='bldg';
    const c=(isBldg&&e.type==='b_workshop')?wsInvOf(e.wlv):UNITS[e.type].cost; /* 税基=实际投资额 */
    const km=bySide===0?cmdrOf(0).killMult:(G.pvp?cmdrOf(1).killMult:KILL_REWARD);
    let reward=Math.round(c*km*(isBldg?0.5:1));
    if(G.bountyT>0&&!isBldg)reward*=2;
    const p=unitPos(e);
    if(bySide===0){
      G.money+=reward; if(!isBldg)G.xp+=c*0.25;
      addFloat(p.x,p.y-46,'+'+reward+'💰');
      if(!isBldg){bumpStreak(); sCoin();}
    }else if(bySide===1){
      G.aiMoney+=reward;
      if(G.per.evolve&&!isBldg)G.aiXp+=c*0.25;
    }
    /* 反应堆残值：被拆返还所有者部分投资（bySide=2 的天灾击杀同样返还）。
       side1 的所有者是客机玩家：飘字不进快照，必须走 fx 通道补回执，
       否则"前线失守不再全损"这个核心反馈对客机玩家完全隐形 */
    if(isBldg&&e.type==='b_workshop'&&!e.recycled){
      const back=Math.round(wsInvOf(e.wlv)*WS_SALVAGE.kill);
      if(e.side){G.aiMoney+=back; netFx({k:'ts',side:1,x:' 反应堆残值 ♻️+'+back+'💰'});}
      else{G.money+=back; addFloat(p.x,p.y-24,'♻️+'+back,'#9fe8a0',15);}
    }
    if(attacker&&!attacker.dying&&!isBldg){
      attacker.kills++;
      promoteVet(attacker);
    }
    teleEvent('kill',e.side?1:0,e.type+'@'+Math.round(e.s));
    sDie();
  }
}
/* 老兵晋升：够击杀数就升阶。刻意"只抬上限、不补当前血"——
   晋升瞬间血条比例反而下降，全靠新获得的再生能力慢慢填回去 */
function promoteVet(u){
  const cur=u.vet||0;
  if(cur>=VET_MAX)return;
  if(UNITS[u.type].cls==='bldg')return;   /* 建筑不升军衔：drawBuilding 走的另一条分支，加了也看不见 */
  const nx=VET_RANKS[cur+1];
  if(u.kills<nx.kills)return;
  u.vet=cur+1;
  u.max=Math.round(u.max*nx.hp/(cur?VET_RANKS[cur].hp:1)); /* 按档位比例递增，不重算基础血量 */
  const p=unitPos(u);
  addFloat(p.x,p.y-58,nx.tag+nx.name+'!',nx.glow,16);
  /* 混战里晋升会扎堆，节流一下免得音效糊成一片 */
  if(u.side===0&&G.t-(G._vetSfx||-9)>0.8){G._vetSfx=G.t;sFlag();}
}
/* 老兵自动回血：只有晋升后才有，主机权威（客机血量走快照） */
function updateVets(dt){
  for(const u of G.units){
    if(!u.vet||u.dying||u.hp>=u.max)continue;
    u.hp=Math.min(u.max,u.hp+u.max*VET_RANKS[u.vet].regen*dt);
  }
}
/* 克制/暴击/老兵伤害结算 */
function rollDmg(st,def,attacker,side){
  let m=(COUNTER[st.cls]&&COUNTER[st.cls][UNITS[def.type].cls])||1;
  if(UNITS[def.type].cls==='tank'&&st.cls==='ranged')m*=0.5;
  const critP=side===0?0.1+(RUN?RUN.mods.critAdd:0):0.1;
  const crit=Math.random()<critP;
  let dmg=st.dmg*m*(crit?2:1);
  if(attacker&&attacker.vet)dmg*=VET_RANKS[attacker.vet].dmg;
  dmg*=side===1?(G.stage?G.stage.dmgMul:1):(RUN?RUN.mods.dmg:1);
  if(side===0&&attacker&&attacker.type)dmg*=famMod(attacker.type,'dmg');
  return {dmg,counter:m>1,crit};
}
function applyDamage(e,r,bySide,attacker){
  if(e.dying)return;
  if(r.crit||r.counter){
    const p=unitPos(e);
    if(r.crit)addFloat(p.x,p.y-58,'暴击'+Math.round(r.dmg)+'!','#ff9040',19);
    else addFloat(p.x,p.y-58,'克制'+Math.round(r.dmg)+'!','#ff6a6a',15);
  }
  damage(e,r.dmg,bySide,attacker);
}
/* 哨站占领 */
function ownedFlags(side){let n=0;for(const f of G.flags)if(f.owner===side)n++;return n;}
function updateFlags(dt){
  for(const f of G.flags){
    let p=0,a=0;
    for(const u of G.units){
      if(u.dying||UNITS[u.type].cls==='bldg')continue;
      if(Math.abs(u.s-f.s)<FLAG_RANGE){if(u.side)a++;else p++;}
    }
    if(p>0&&a===0)f.prog=Math.min(1,f.prog+dt/FLAG_TIME);
    else if(a>0&&p===0)f.prog=Math.max(-1,f.prog-dt/FLAG_TIME);
    if(f.prog>=1&&f.owner!==0){f.owner=0;toast('🚩 占领哨站！收入+'+FLAG_INCOME+'/秒');sFlag();netFx({k:'fc',side:0});teleEvent('flag',0,Math.round(f.s));}
    if(f.prog<=-1&&f.owner!==1){f.owner=1;toast('⚠️ 敌军占领了哨站');sFlag();netFx({k:'fc',side:1});teleEvent('flag',1,Math.round(f.s));}
  }
}
function hitBase(side,dmg){
  if(G.over)return;
  G.baseHp[side]=Math.max(0,G.baseHp[side]-dmg);
  G.shake=0.3;
  if(G.baseHp[side]<=0)endGame(side===1?1:-1);
}
function endGame(r){
  G.over=r;
  if(r>0)sWin();else sLose();
  setTimeout(()=>{
    if(!G||G.over!==r)return;
    if(G.pvp){
      if(NET&&NET.isHost){
        NET.sendMeta({k:'end',winner:r>0?0:1});
        NET.started=false; NET.lastStart=null; /* 别再给新观众补发已结束的对局 */
      }
      netShowEnd(r>0,null);
      return;
    }
    if(RUN){
      if(r>0){
        RUN.goldCarry=Math.round(G.money*0.2);
        const nd=RUN.curNode;
        if(nd)nd.done=true;
        RUN.chosenIdx=RUN.pendingIdx;
        if(nd&&nd.t==='boss')showRunEnd(true);
        else showReward('🎁 战利品：三选一','mix');
      }else{
        showRunEnd(false);
      }
    }else{
      setEndArt('goArt',r>0);
      $('goTitle').textContent=r>0?'🎉 胜利！':'💀 战败…';
      $('gameover').classList.remove('hidden');
    }
  },1100);
}

function fire(u,st,tgt,onBase){
  const enemySide=1-u.side;
  if(st.proj){
    const from=unitPos(u);
    /* 高大建筑（激光塔）的炮口远高于步兵，用 mz 覆盖默认枪口高度 */
    const mzx=st.mz?st.mz[0]*(u.side?-1:1):0, mzy=st.mz?st.mz[1]:-26;
    let to,ts=null;
    if(onBase){const b=u.side?BASE0:BASE1;to={x:b.x,y:b.y-30};}
    else{to=unitPos(tgt);ts=tgt;}
    G.projs.push({kind:st.proj,side:u.side,x:from.x+mzx,y:from.y+mzy,tx:to.x,ty:to.y-14,tgt:ts,
      dmg:st.dmg,cls:st.cls,shooter:u,splash:st.splash||0,
      sp:st.proj==='arrow'?520:(st.proj&&st.proj.startsWith('laser')?640:330),ang:0,dead:false});
    if(st.proj==='arrow')sBow(); else sMagic();
  }else{
    if(onBase)hitBase(enemySide,st.dmg);
    else{
      const r=rollDmg(st,tgt,u,u.side);
      if(UNITS[tgt.type].cls!=='bldg')tgt.s=clamp(tgt.s+(u.side?-4:4),10,L-10);
      applyDamage(tgt,r,u.side,u);
    }
    sHit();
  }
}

/* 守备队走位：朝目标靠但绝不越出空降点 leash 范围；没目标就回到自己的落点。
   与常规单位不同，这里是双向移动（可能往己方后方走），所以不能复用 dir 那套单向推进逻辑。 */
/* 炮击杀伤半径(118+62=180)＞拴绳 120：不放宽的话守备队被圈住只能站着挨三轮
   （260 金火力覆盖无反制全灭 250 金空降）。预警圈盖到头上时临时放宽拴绳、朝圈外撤。
   三条审查教训都焊在这里：①撤离方向固定朝己方后方（按圆心哪侧算会被对手用圆心劈阵型，
   把近战排推向敌方火力网）；②目标点一旦选定就粘滞到该次炮击结束（判定阈值和目标点只差
   10px，无粘滞会在圈边界 60Hz 抖动翻面，还经快照位 32 传给客机）；③己方炮击不触发撤离 */
function guardFleeDest(u){
  if(u.fleeK){
    if(G.strikes.includes(u.fleeK))return u.fleeD;
    u.fleeK=null;
  }
  for(const k of G.strikes){
    if(k.side===u.side)continue;
    if(k.pd===undefined||k.pd>k.r+70)continue;
    if(Math.abs(u.s-k.ps)>=k.r+70)continue;
    const away=u.side?1:-1, lo=u.homeS-AIRDROP.fleeLeash, hi=u.homeS+AIRDROP.fleeLeash;
    let dest=clamp(k.ps+away*(k.r+90),lo,hi);
    if(Math.abs(dest-k.ps)<k.r+70){ /* 后方被拴绳拦在圈里：改走另一侧逃生 */
      const alt=clamp(k.ps-away*(k.r+90),lo,hi);
      if(Math.abs(alt-k.ps)>Math.abs(dest-k.ps))dest=alt;
    }
    u.fleeK=k; u.fleeD=dest;
    return dest;
  }
  return null;
}
function guardStep(u,st,tgt,dt,wSpd){
  const flee=guardFleeDest(u);
  const leash=flee!==null?AIRDROP.fleeLeash:u.leash;
  const lo=u.homeS-leash, hi=u.homeS+leash;
  const dest=flee!==null?clamp(flee,lo,hi):(tgt?clamp(tgt.s,lo,hi):u.homeS);
  const gap=dest-u.s;
  const sp=st.speed*wSpd*(u.side?1:(RUN?RUN.mods.speed:1));
  if(Math.abs(gap)>AIRDROP.homeEps){
    u.s+=Math.sign(gap)*Math.min(Math.abs(gap),sp*dt);
    u.walk+=dt*st.speed*0.16; u.animT+=dt; u.moving=true;
    u.back=gap*(u.side?-1:1)<0;   /* 往己方后方走：渲染时要把朝向翻过来，否则会倒着滑行 */
  }else u.back=false;
  if(!tgt){                        /* 归队时横向也慢慢回到自己那一格，重新站成阵型 */
    const od=u.homeOff-u.off;
    if(Math.abs(od)>0.5)u.off+=Math.sign(od)*Math.min(Math.abs(od),sp*0.6*dt);
  }
}
function updateUnits(dt){
  const us=G.units;
  /* 每帧缓存路径横向位置（含岔路分离），供索敌/阻挡/溅射使用 */
  for(const u of us){
    const pp=pathPos(u.s);
    u._lat=u.off*pp.wf+(u.off<0?-1:1)*(pp.sep/2);
  }
  const wSpd=G.weather.speedMul||1;
  for(const u of us){
    if(u.dying){u.dying+=dt;continue;}
    if(u.expireT!==undefined){
      u.expireT-=dt;
      if(u.expireT<=0){
        u.dying=1e-4; /* 空降部队到期消散：无击杀奖励 */
        const ep=unitPos(u);
        addFloat(ep.x,ep.y-40,'⌛','#cfe0ff',15);
        continue;
      }
    }
    const st=UNITS[u.type], dir=u.side?-1:1;
    u.cd-=dt;
    u.atkT+=dt;
    u.lunge=Math.max(0,u.lunge-dt*5);
    /* 修士：不攻击，治疗射程内最残血的友军；无人可治则跟队推进 */
    if(st.cls==='heal'){
      let ally=null,worst=0.999;
      for(const a of us){
        if(a.side!==u.side||a.dying||a===u||UNITS[a.type].cls==='bldg')continue;
        if(Math.abs(a._lat-u._lat)>60)continue;
        if(Math.abs(a.s-u.s)<=st.range){
          const r=a.hp/a.max;
          if(r<worst){worst=r;ally=a;}
        }
      }
      u.moving=false;
      if(ally){
        if(u.cd<=0){
          u.cd=st.cd; u.atkT=0;
          const hAmt=Math.round(st.heal*(u.side?1:(RUN?RUN.mods.heal:1)*famMod(u.type,'heal')));
          ally.hp=Math.min(ally.max,ally.hp+hAmt);
          const ap=unitPos(ally);
          addFloat(ap.x,ap.y-52,'+'+hAmt,'#7dff9b',14);
          sHeal();
        }
      }else if(u.guard){
        guardStep(u,st,null,dt,wSpd);   /* 守备队里的修士也归位，不跟队推进 */
      }else{
        let blocked=false;
        for(const a of us){
          if(a===u||a.side!==u.side||a.dying||UNITS[a.type].cls==='bldg')continue;
          if(Math.abs(a._lat-u._lat)>=18)continue;
          const gp=(a.s-u.s)*dir;
          if(gp>0&&gp<20){blocked=true;break;}
        }
        if(!blocked){u.s+=st.speed*wSpd*(u.side?1:(RUN?RUN.mods.speed:1))*dir*dt;u.walk+=dt*st.speed*0.16;u.animT+=dt;u.moving=true;}
      }
      continue;
    }
    let rngEff=st.range;
    if(st.proj){
      if(G.weather.rangedMul)rngEff*=G.weather.rangedMul;
      if(!u.side)rngEff*=famMod(u.type,'range');
    }
    /* 守备队的索敌半径＝能走的距离+自身射程，即"只锁定我够得着的目标"。
       用 rngEff 而不是 st.range，所以沙暴削弱射程时视野会跟着缩。 */
    const sight=u.guard?u.leash+rngEff:0;
    let tgt=null, tscore=1e9, tds=1e9;
    for(const e of us){
      if(e.side===u.side||e.dying)continue;
      if(rngEff<=50&&Math.abs(e._lat-u._lat)>46)continue; /* 近战不能隔着岔路打 */
      const ds=Math.abs(e.s-u.s);
      if(sight&&ds>sight)continue;                       /* 太远的锁不上 */
      const score=ds+Math.abs(e._lat-u._lat)*0.3;
      if(score<tscore){tscore=score;tds=ds;tgt=e;}
    }
    const bd=u.side?u.s-55:L-55-u.s;
    let onBase=false, td=tds;
    /* 守备队不打城堡：它被拴在空降点附近，本来也够不着，留着只会让它朝城堡空转 */
    if(!u.guard&&(!tgt||bd<tds)){td=bd;tgt=null;onBase=true;}
    /* 滚桶兵：接敌自爆，范围伤害 */
    if(st.cls==='bomb'&&td<=st.range){
      u.dying=1e-4;
      u.moving=false;
      for(const e of us){
        if(e.side===u.side||e.dying)continue;
        if(Math.abs(e._lat-u._lat)>70)continue;
        if(Math.abs(e.s-u.s)<=st.splash)applyDamage(e,rollDmg(st,e,null,u.side),u.side,null);
      }
      if(onBase)hitBase(1-u.side,st.dmg);
      const bp=unitPos(u);
      G.booms.push({x:bp.x,y:bp.y,t:0});
      sBoom();
      G.shake=Math.max(G.shake,0.15);
      continue;
    }
    u.moving=false;
    u.back=false;   /* 每帧重置：否则守备队从"归位中"切到"开打"时会保留反向朝向 */
    /* 撤离必须先于开火判定：否则对手用廉价单位贴脸（td<=rngEff 恒成立）就能把守备队
       钉在开火分支里站着挨完三轮炮——那正是这套撤离逻辑要修的场景 */
    if(u.guard&&guardFleeDest(u)!==null){
      guardStep(u,st,tgt,dt,wSpd);
    }else if(td<=rngEff){
      if(u.cd<=0){u.cd=st.cd;u.lunge=1;u.atkT=0;fire(u,st,tgt,onBase);}
    }else if(u.guard){
      guardStep(u,st,tgt,dt,wSpd);
    }else{
      let blocked=false;
      for(const a of us){
        if(a===u||a.side!==u.side||a.dying||UNITS[a.type].cls==='bldg')continue;
        if(Math.abs(a._lat-u._lat)>=18)continue;
        const gp=(a.s-u.s)*dir;
        if(gp>0&&gp<20){blocked=true;break;}
      }
      if(!blocked){u.s+=st.speed*wSpd*(u.side?1:(RUN?RUN.mods.speed:1))*dir*dt;u.walk+=dt*st.speed*0.16;u.animT+=dt;u.moving=true;}
    }
  }
  for(let i=us.length-1;i>=0;i--)if(us[i].dying>0.45)us.splice(i,1);
}

function updateProjs(dt){
  for(const p of G.projs){
    if(p.tgt&&!p.tgt.dying){const t=unitPos(p.tgt);p.tx=t.x;p.ty=t.y-14;}
    const dx=p.tx-p.x, dy=p.ty-p.y, d=Math.hypot(dx,dy), step=p.sp*dt;
    if(d<=step+4){
      p.dead=true;
      if(p.wsplash){
        for(const e of G.units){
          if(e.side===p.side||e.dying)continue;
          const ep=unitPos(e);
          if(Math.hypot(ep.x-p.tx,ep.y-p.ty)<=p.wsplash)applyDamage(e,rollDmg(p,e,null,p.side),p.side,null);
        }
        G.booms.push({x:p.tx,y:p.ty,t:0});
        /* 一轮齐射 7 发会在 1 秒内连炸，全放会糊成噪音——节流后仍听得出是弹幕 */
        if(G.t-(G._boomSfx||-9)>0.22){G._boomSfx=G.t;sBoom();}
        G.shake=Math.max(G.shake,0.1);
      }else if(p.splash){
        const cs=p.tgt?p.tgt.s:(p.side?55:L-55);
        const cl=p.tgt?(p.tgt._lat||0):0;
        for(const e of G.units){
          if(e.side===p.side||e.dying)continue;
          if(Math.abs((e._lat||0)-cl)>70)continue;
          if(Math.abs(e.s-cs)<=p.splash)applyDamage(e,rollDmg(p,e,p.shooter,p.side),p.side,p.shooter);
        }
        if(!p.tgt)hitBase(1-p.side,p.dmg);
        G.booms.push({x:p.tx,y:p.ty,t:0});
        sBoom();
      }else{
        if(p.tgt){if(!p.tgt.dying)applyDamage(p.tgt,rollDmg(p,p.tgt,p.shooter,p.side),p.side,p.shooter);}
        else hitBase(1-p.side,p.dmg);
        sHit();
      }
    }else{
      p.x+=dx/d*step; p.y+=dy/d*step; p.ang=Math.atan2(dy,dx);
    }
  }
  G.projs=G.projs.filter(p=>!p.dead);
}

function updateFloats(dt){
  for(const f of G.floats){f.y-=30*dt;f.a-=dt;}
  G.floats=G.floats.filter(f=>f.a>0);
}

function updQueue(q,dt,side){
  if(!q.length)return;
  q[0].t-=dt;
  if(q[0].t<=0){const it=q.shift();spawnUnit(side,it.type);}
}

function aiThink(dt){
  G.aiDecide-=dt;
  if(G.aiDecide>0)return;
  const per=G.per;
  G.aiDecide=rand(per.decide[0],per.decide[1]);
  if(per.evolve&&G.aiEra===1&&G.aiXp>=EVOLVE_XP*(per.evolveMul||1.15)&&G.aiMoney>=EVOLVE_COST){
    G.aiMoney-=EVOLVE_COST; G.aiEra=2; G.aiPlan=null; G.flash=1;
    toast('⚠️ 敌方进化到了王国时代！'); sEvolve();
  }
  if(G.aiIncomeLvl<INCOME_MAX_LVL&&Math.random()<per.eco){
    const c=incomeCost(G.aiIncomeLvl);
    if(G.aiMoney>=c+50){
      G.aiMoney-=c; G.aiIncomeLvl++; G.aiIncome+=INCOME_STEP*G.stage.aiIncomeMul;
    }
  }
  if(G.aiQueue.length<per.queue){
    if(!G.aiPlan)G.aiPlan=aiPick();
    const c=UNITS[G.aiPlan].cost;
    if(G.aiMoney>=c){
      G.aiMoney-=c;
      G.aiQueue.push({type:G.aiPlan,t:UNITS[G.aiPlan].build});
      if(c>=150&&G.t-G.lastWarn>4){
        G.lastWarn=G.t;
        toast('⚠️ 敌方'+UNITS[G.aiPlan].name+'集结中…');
      }
      G.aiPlan=null;
    }
  }
}
function aiPick(){
  const per=G.per;
  let keys, counts=null;
  if(per.roster){
    counts={};
    for(const k of per.roster)counts[k]=(counts[k]||0)+1;
    keys=Object.keys(counts);
  }else keys=cmdrOf(1).roster[G.aiEra];
  const reach=G.aiMoney+G.aiIncome*6;
  const w={};
  for(const k of keys)if(UNITS[k].cost<=reach)
    w[k]=(per.weights&&per.weights[k])||UNITS[k].w*(counts?counts[k]:1);
  if(!Object.keys(w).length)return keys[0];
  if(per.smart){
    let inf=0,sp=0,rng=0,tank=0;
    for(const u of G.units)if(u.side===0&&!u.dying){
      const c=UNITS[u.type].cls;
      if(c==='inf')inf++;
      else if(c==='spear')sp++;
      else if(c==='ranged')rng++;
      else if(c==='tank')tank++;
    }
    for(const k in w){
      const c=UNITS[k].cls;
      if(tank>=3&&c==='spear')w[k]+=28;
      if(sp>=3&&c==='inf')w[k]+=26;
      if(inf>=4&&c==='ranged')w[k]+=22;
      if(rng>=4&&c==='tank')w[k]+=24;
    }
  }
  let tot=0;for(const k in w)tot+=w[k];
  let r=Math.random()*tot;
  for(const k in w){r-=w[k];if(r<=0)return k;}
  return keys[0];
}

function update(dt){
  G.t+=dt;
  frontTick();
  teleTick();
  let wy0=0,wy1=0;
  for(const u of G.units)
    if(!u.dying&&u.type==='b_workshop'){
      if(u.recT){ /* 回收引导：完成后消散并返还残值，不给对手任何奖励 */
        u.recT-=dt;
        if(u.recT<=0){
          u.recycled=true; u.dying=1e-4;
          const back=Math.round(wsInvOf(u.wlv)*WS_SALVAGE.recycle);
          /* 飘字只给本机所有者；对手的回收金额不该白送给主机（那是对方的经济情报），
             客机所有者走 fx 回执（飘字不进快照） */
          if(u.side){G.aiMoney+=back; netFx({k:'ts',side:1,x:' 反应堆回收 ♻️+'+back+'💰'});}
          else{
            G.money+=back;
            const rp=unitPos(u);
            addFloat(rp.x,rp.y-40,'♻️ +'+back,'#9fe8a0',16);
          }
        }
        continue;
      }
      if(u.side)wy1+=wsYield(u);else wy0+=wsYield(u);
    }
  G.money+=(G.income+FLAG_INCOME*ownedFlags(0)+wy0)*dt;
  G.aiMoney+=(G.aiIncome+FLAG_INCOME*ownedFlags(1)+wy1)*dt;
  updQueue(G.queue,dt,0);
  updQueue(G.aiQueue,dt,1);
  if(!G.pvp)aiThink(dt);
  updateUnits(dt);
  updateProjs(dt);
  updateFlags(dt);
  updateStrikes(dt);
  updateVets(dt);
  for(const k in G.pcds){
    G.pcds[k][0]=Math.max(0,G.pcds[k][0]-dt);
    G.pcds[k][1]=Math.max(0,G.pcds[k][1]-dt);
  }
  for(const b of G.booms)b.t+=dt;
  G.booms=G.booms.filter(b=>b.t<0.9);
  updateWeather(dt);
  if(G.bountyT>0)G.bountyT-=dt;
  for(const ev of G.events)
    if(!ev.done&&G.t>=ev.at){ev.done=true;triggerEvent(ev.type);}
  updatePiles(dt);
  updateFloats(dt);
  /* 被动经验：保证每局都能摸到时代进化 */
  if(G.era===1)G.xp+=2*dt;
  if(G.per.evolve&&G.aiEra===1)G.aiXp+=2*dt;
  if(G.banner){G.banner.a-=dt;if(G.banner.a<=0)G.banner=null;}
  G.flash=Math.max(0,G.flash-dt*1.2);
  G.shake=Math.max(0,G.shake-dt*1.6);
  if(G.pvp&&G.pvpHost&&NET)netHostSnap(dt);
}

/* ---------------- 天气：随机降临 → 持续 → 转晴 ---------------- */
function setWeather(key,dur,silent){
  G.weatherKey=key;
  G.weather=WEATHERS[key]||WEATHERS.clear;
  G.weatherT=dur||0;
  if(silent)return;
  if(key==='clear'){
    toast('☀️ 天气转晴');
    netFx({k:'wx',key:'clear'});
  }else{
    const w=G.weather;
    toast(w.icon+' '+w.name+'来袭：'+w.desc);
    showBanner(w.icon+' '+w.name+'!');
    sFlag();
    netFx({k:'wx',key});
  }
}
function updateWeather(dt){
  if(G.weatherT>0){
    G.weatherT-=dt;
    if(G.weatherT<=0){
      setWeather('clear',0);
      G.weatherNext=rand(WEATHER_GAP[0],WEATHER_GAP[1]);
    }
    return;
  }
  G.weatherNext-=dt;
  if(G.weatherNext<=0)
    setWeather(WEATHER_ROLL[(Math.random()*WEATHER_ROLL.length)|0],
               rand(WEATHER_DUR[0],WEATHER_DUR[1]));
}

/* ---------------- 战场中立事件 ---------------- */
function triggerEvent(type){
  teleEvent('evt',type);
  if(type==='gold'){
    const s=rand(0.35,0.65)*L;
    G.piles.push({s,amt:220});
    const p=pathPos(s);
    addFloat(p.x,p.y-40,'💰 空投!','#ffd76a',20);
    toast('💰 战场空投：金币落在战场中段，先到先得！');
    netFx({k:'tn',x:'💰 战场空投：金币落在战场中段，先到先得！'});
    sFlag();
  }else if(type==='meteor'){
    toast('☄️ 陨石雨来袭：双方阵线遭到轰击！');
    netFx({k:'tn',x:'☄️ 陨石雨来袭：双方阵线遭到轰击！'});
    /* 陨石只轰"阵线"不轰固定资产：建筑走不了位躲不开，会变成只砸工程师的单向天灾税；
       落点质心也同步排除建筑，否则免疫的建筑群会把弹着区拉向围攻它的部队 */
    let cs=L/2,n=1;
    for(const u of G.units)if(!u.dying&&UNITS[u.type].cls!=='bldg'){cs+=u.s;n++;}
    cs/=n;
    for(let i=0;i<4;i++){
      const s=clamp(cs+rand(-260,260),80,L-80);
      const p=pathPos(s);
      G.booms.push({x:p.x+rand(-40,40),y:p.y+rand(-30,30),t:-i*0.25});
      for(const e of G.units){
        if(e.dying||UNITS[e.type].cls==='bldg')continue;
        if(Math.abs(e.s-s)<=70)damage(e,40,2,null);
      }
    }
    G.shake=Math.max(G.shake,0.35);
    sBoom();
  }else if(type==='bounty'){
    G.bountyT=30;
    toast('💰 双倍赏金：30 秒内击杀奖励翻倍！');
    showBanner('💰 双倍赏金!');
    netFx({k:'tn',x:'💰 双倍赏金：30 秒内击杀奖励翻倍！'});
    netFx({k:'bn',x:'💰 双倍赏金!'});
    sFlag();
  }
}
function updatePiles(dt){
  for(let i=G.piles.length-1;i>=0;i--){
    const pl=G.piles[i];
    /* 只有活动部队能拾取空投，建筑不行；同时按距离判定归属而非数组顺序 */
    let claimed=-1,best=1e9;
    for(const u of G.units){
      if(u.dying||UNITS[u.type].cls==='bldg')continue;
      const d=Math.abs(u.s-pl.s);
      if(d<40&&d<best){best=d;claimed=u.side;}
    }
    if(claimed>=0){
      if(claimed===0){
        G.money+=pl.amt;
        const p=pathPos(pl.s);
        addFloat(p.x,p.y-40,'+'+pl.amt+'💰');
        sCoin();
        toast('💰 我方夺得空投！');
      }else{
        G.aiMoney+=pl.amt;
        toast('⚠️ 敌方夺得空投');
      }
      netFx({k:'ts',side:claimed,x:'夺得空投！'});
      G.piles.splice(i,1);
    }
  }
}

/* ---------------- 放置系统（火力覆盖 + 工程师建筑：拒马/箭塔/工坊） ---------------- */
let placing=false, placePos=null, placingType='strike';
function togglePlace(ty){
  if(!G||mode!=='play'||paused||G.over||G.spectator)return;
  ty=ty||'strike';
  if(placing&&placingType===ty){placing=false;placePos=null;toast('已取消部署');return;}
  const P=PLACEABLES[ty];
  if(G.pcds[ty][0]>0||G.money<P.cost)return;
  if(typeof hideWsMenu==='function')hideWsMenu(); /* 放置模式下菜单会挡屏幕底部中央 */
  placing=true; placingType=ty; placePos=null;
  toast(P.strike?('🎯 按住拖动圈定打击区域，松手呼叫火力，再点按钮取消')
                :('🎯 按住拖动选位，松手部署'+P.name+(P.road?'（必须建在道路上）':'')+'，再点按钮取消'));
  sClick();
}
function nearestPath(x,y){
  let bi=-1,bd=1e18;
  for(let i=0;i<PATH.table.length;i+=4){
    const p=PATH.table[i], dx=p.x-x, dy=p.y-y, d=dx*dx+dy*dy;
    if(d<bd){bd=d;bi=i;}
  }
  if(bi<0)return null;
  const p=PATH.table[bi];
  return {s:bi*PATH.STEP,d:Math.sqrt(bd),sep:p.sep,wf:p.wf};
}
function countBldg(side,unitType){
  let n=0;
  for(const u of G.units)if(u.side===side&&!u.dying&&u.type===unitType)n++;
  return n;
}
/* ---------------- 前线追踪与放置校验（规则说明见 data.js 的 FRONT） ---------------- */
function frontInstant(side){
  let m=side?L:0;
  for(const u of G.units){
    if(u.side!==side||u.dying||u.guard)continue;
    m=side?Math.min(m,u.s):Math.max(m,u.s);
  }
  return m;
}
/* 主机在 update()、客机在 netGuestTick() 里各自喂样本；G.front 懒初始化兼容旧存局 */
function frontTick(){
  if(!G.front)G.front={h:[[],[]],lt:G.t};
  /* 客机切后台再回来时 G.t 会被快照一次性拉表——按 G.t 裁剪会把整个滑窗清空、
     退化成瞬时值（界标随即偏乐观 8 秒）。检测到跳变就平移历史，不丢样本 */
  const jump=G.t-G.front.lt;
  if(Math.abs(jump)>1)for(const h of G.front.h)for(const e of h)e.t+=jump;
  G.front.lt=G.t;
  for(let side=0;side<2;side++){
    const h=G.front.h[side];
    h.push({t:G.t,v:frontInstant(side)});
    while(h.length&&h[0].t<G.t-FRONT.window)h.shift();
  }
}
function frontSmooth(side){
  const h=G.front&&G.front.h[side];
  if(!h||!h.length)return frontInstant(side);
  let m=h[0].v;
  for(const e of h)m=side?Math.max(m,e.v):Math.min(m,e.v);
  return m;
}
/* slk 也要作用于全部静态边界：主客各自用自己的路径表把坐标量化到 24px 栅格，
   同一物理点两端算出的 s 实测最大差 ~24px——"静态公式双端一致"并不成立，
   不从宽的话客机在保底/硬限边缘的合法放置会被主机随机驳回 */
function placeLimitS(side,slk){
  const f=frontSmooth(side), m=FRONT.margin+(slk||0), e=slk||0;
  return side?Math.max(260-e,Math.min(f-m,L-FRONT.floor*L-e))
             :Math.min(L-260+e,Math.max(f+m,FRONT.floor*L+e));
}
function nearFlagS(s){
  for(const f of G.flags)if(Math.abs(f.s-s)<=FLAG_RANGE)return true;
  return false;
}
function placeAllowed(side,s,drop,slk){
  const e=slk||0;
  /* dropCap 是无条件硬限，哨站旗也不豁免——世界生成的兜底会把旗放到 0.8L，
     豁免它的话守备队索敌圈（310px）就能盖住对方出兵点 */
  if(drop&&(side?s<FRONT.dropCap-e:s>L-FRONT.dropCap+e))return false;
  const lim=placeLimitS(side,slk);
  if(side?s<lim:s>lim)return !!drop&&nearFlagS(s); /* 空降在哨站旗附近豁免：抢旗翻盘保留 */
  return true;
}
function buildingPlaceCore(side,ty,s,localToast,slk){
  const P=PLACEABLES[ty], ut=P.unit, st=UNITS[ut];
  const money=side?G.aiMoney:G.money;
  if(money<P.cost||G.pcds[ty][side]>0)return false;
  if(countBldg(side,ut)>=P.maxAlive){if(localToast)toast('⚠️ '+P.name+'最多同时存在 '+P.maxAlive+' 座');return false;}
  if(side===0&&s>L-260+(slk||0)){if(localToast)toast('⚠️ 离敌方城堡太近');return false;}
  if(side===1&&s<260-(slk||0))return false;
  if(!placeAllowed(side,s,false,slk)){if(localToast)toast('⚠️ 超出前线：只能建在前线附近或己方半场');return false;}
  if(side)G.aiMoney-=P.cost; else G.money-=P.cost;
  G.pcds[ty][side]=P.cd*(side?1:(RUN?RUN.mods.turCd:1));
  G.units.push({uid:(G.uidSeq=(G.uidSeq||0)+1),side,type:ut,s,off:0,
    wlv:(ty==='workshop'?1:0),
    hp:st.hp,max:st.hp,cd:rand(0.3,0.8),walk:0,lunge:0,dying:0,moving:false,
    kills:0,vet:0,atkT:9,animT:0});
  if(localToast)toast('🔨 '+P.name+'建造完成'+(ty==='workshop'?'（此位置产量 +'+Math.round(wsYield({side,s}))+'/秒）':''));
  sBoom();
  teleCmd(side,'place_'+ty,Math.round(s));
  return true;
}
/* 空降守备队：一支不推进的临时部队，随时代变强，限时后消失 */
function airdropCore(side,s,slk){
  const P=PLACEABLES.airdrop;
  const money=side?G.aiMoney:G.money;
  if(money<P.cost||G.pcds.airdrop[side]>0)return false;
  if(side===0&&s>L-260+(slk||0))return false;
  if(side===1&&s<260-(slk||0))return false;
  if(!placeAllowed(side,s,true,slk))return false;
  if(side)G.aiMoney-=P.cost; else G.money-=P.cost;
  G.pcds.airdrop[side]=P.cd*(side?1:(RUN?RUN.mods.turCd:1));
  const era=side?G.aiEra:G.era;
  const comp=era===2?AIRDROP.comp2:AIRDROP.comp1;
  const toFoe=side?-1:1;   /* s 空间里朝向敌方的方向 */
  let nm=0,nr=0;
  comp.forEach(k=>{
    const st=UNITS[k], ranged=!!st.proj;
    /* 近战列在前、远程列在后，各自横向散开——落地即成阵型，不用等它们自己走位 */
    const lane=(ranged?AIRDROP.laneR[nr++]:AIRDROP.laneM[nm++])+rand(-3,3);
    const hs=clamp(s+(ranged?-AIRDROP.rowGap:AIRDROP.rowGap)*toFoe,20,L-20);
    const hpMul=(side?(G.stage?G.stage.hpMul:1):(RUN?RUN.mods.hp:1)*famMod(k,'hp'))*1.15;
    const hp=Math.round(st.hp*hpMul);
    G.units.push({uid:(G.uidSeq=(G.uidSeq||0)+1),side,type:k,s:hs,off:lane,
      hp,max:hp,cd:rand(0.1,0.3),walk:rand(0,6),lunge:0,dying:0,moving:false,
      kills:0,vet:0,atkT:9,animT:rand(0,9),
      /* 守备队标记：只在自己的 homeS/homeOff 附近 leash 范围内活动，不推进战线 */
      guard:true,homeS:hs,homeOff:lane,leash:AIRDROP.leash,back:false,
      expireT:P.life});
  });
  const p=pathPos(s);
  addFloat(p.x,p.y-50,'🪂 空降!','#ffd76a',20);
  G.booms.push({x:p.x,y:p.y,t:0});
  sSpawn();
  teleCmd(side,'airdrop',Math.round(s));
  return true;
}
/* ---------------- 反应堆资产化：升级 / 主动回收（均主机权威） ---------------- */
function wsFind(side,uid){
  for(const u of G.units)
    if(u.uid===uid&&u.side===side&&!u.dying&&u.type==='b_workshop')return u;
  return null;
}
function wsUpgradeCore(side,uid){
  if(!G||G.over)return false;
  const u=wsFind(side,uid); if(!u||u.recT)return false;
  const lv=u.wlv||1; if(lv>=WS_MAX)return false;
  const up=WS_UP[lv+1];
  const money=side?G.aiMoney:G.money;
  if(money<up.cost||G.pcds.workshop[side]>0)return false;
  if(side)G.aiMoney-=up.cost; else G.money-=up.cost;
  G.pcds.workshop[side]=PLACEABLES.workshop.cd*(side?1:(RUN?RUN.mods.turCd:1));
  u.wlv=lv+1;
  const hpAdd=up.hp-WS_UP[lv].hp;
  u.max+=hpAdd; u.hp=Math.min(u.max,u.hp+hpAdd); /* 只补新增装甲，不免费洗掉已受的伤 */
  const p=unitPos(u);
  addFloat(p.x,p.y-58,'⬆️ 反应堆 Lv'+u.wlv,'#ffd76a',16);
  sBoom();
  teleCmd(side,'wsup',u.wlv);
  return true;
}
function wsRecycleCore(side,uid){
  if(!G||G.over)return false;
  const u=wsFind(side,uid); if(!u||u.recT)return false;
  /* 回收是真实的经济动作：要求且占用 workshop 冷却。否则"回收 130 再前移重建 200"
     只受 25s 限频，工程师不出一兵就能把建筑阶梯循环拱到 L-260 */
  if(G.pcds.workshop[side]>0)return false;
  G.pcds.workshop[side]=PLACEABLES.workshop.cd*(side?1:(RUN?RUN.mods.turCd:1));
  u.recT=WS_SALVAGE.channel; /* 引导期间停产；受击即打断（见 damage 入口），时机是真博弈 */
  teleCmd(side,'wsrec',u.wlv||1);
  return true;
}
function placeAt(wx,wy){
  placing=false;
  const ty=placingType;
  placePos=null;
  if(!G||G.over)return;
  const P=PLACEABLES[ty];
  if(P.road){
    const pr=nearestPath(wx,wy);
    if(!pr||pr.d>76*pr.wf){toast('⚠️ '+P.name+'只能选在道路上');return;}
    if(pr.sep>5){toast('⚠️ 岔路口无法'+(P.drop?'空降':'施工'));return;}
    if(G.pvp&&NET&&!NET.isHost){
      if(G.money<P.cost||G.pcds[ty][0]>0)return;
      if(pr.s>L-260){toast('⚠️ 离敌方城堡太近');return;}
      /* 与主机同样的预检查，避免指令被静默丢弃却提示成功；
         前线是移动边界，客机按快照预检、主机按 FRONT.eps 从宽复验+驳回回执 */
      if(P.maxAlive&&countBldg(0,P.unit)>=P.maxAlive){
        toast('⚠️ '+P.name+'最多同时存在 '+P.maxAlive+' 座');
        return;
      }
      if(!placeAllowed(0,pr.s,!!P.drop)){
        toast(P.drop?'⚠️ 空降超出前线（哨站旗附近可豁免）':'⚠️ 超出前线：只能建在前线附近或己方半场');
        return;
      }
      NET.sendCmd({a:'p',t:ty,x:Math.round(WORLD_W-wx),y:Math.round(WORLD_H-wy)});
      toast(P.drop?'🪂 空降指令已发送':'🔨 建造指令已发送');
      return;
    }
    if(P.drop){
      if(pr.s>L-260){toast('⚠️ 离敌方城堡太近');return;}
      /* 拖动选位期间还能从兵种栏买兵：钱可能已花掉，别把资源问题报成位置问题 */
      if(G.money<P.cost||G.pcds.airdrop[0]>0){toast('⚠️ 金币不足或空降冷却中');return;}
      if(!airdropCore(0,pr.s)){toast('⚠️ 空降超出前线（哨站旗附近可豁免）');return;}
      toast('🪂 守备队空降：'+AIRDROP.comp1.length+' 人就地布防 '+P.life+' 秒，在落点附近搜敌，无敌人则归位');
      return;
    }
    buildingPlaceCore(0,ty,pr.s,true);
    return;
  }
  if(G.pvp&&NET&&!NET.isHost){
    if(G.money<STRIKE.cost||G.pcds.strike[0]>0)return;
    if(!strikeInBounds(wx,wy)){toast('⚠️ 超出战场边界');return;}
    NET.sendCmd({a:'p',t:'strike',x:Math.round(WORLD_W-wx),y:Math.round(WORLD_H-wy)});
    toast('🎯 打击坐标已发送');
    return;
  }
  strikeCore(0,wx,wy,true);
}
function strikeInBounds(wx,wy){
  return wx>=30&&wx<=WORLD_W-30&&wy>=30&&wy<=WORLD_H-30;
}
/* 火力覆盖：在目标圆区呼叫 STRIKE.waves 轮炮击。
   lead 秒的预警窗口是有意的——被打的一方看得见红圈，来得及把部队挪开 */
function strikeCore(side,wx,wy,localToast){
  const money=side?G.aiMoney:G.money;
  if(money<STRIKE.cost||G.pcds.strike[side]>0)return false;
  if(!strikeInBounds(wx,wy)){if(localToast)toast('⚠️ 超出战场边界');return false;}
  if(side)G.aiMoney-=STRIKE.cost; else G.money-=STRIKE.cost;
  G.pcds.strike[side]=STRIKE.cd*(side?1:(RUN?RUN.mods.turCd:1));
  /* ps/pd=打击圈心在路径上的投影，供守备队判断"圈是否盖到路上、往哪边跑"（仅主机用，不进快照） */
  const pp=nearestPath(wx,wy);
  G.strikes.push({side,x:wx,y:wy,r:STRIKE.radius,wave:0,pend:0,shellT:0,waveT:STRIKE.lead,lingerT:0,
    ps:pp?pp.s:-1e9,pd:pp?pp.d:1e9});
  if(localToast)toast('🎯 火力覆盖已呼叫：'+STRIKE.waves+' 轮，每轮间隔 '+STRIKE.gap+' 秒');
  addFloat(wx,wy-30,'🎯 坐标已锁定','#ff9040',18);
  sFlag();
  teleCmd(side,'strike',pp?Math.round(pp.s):0);
  return true;
}
function fireStrikeShell(k){
  /* sqrt 让落点在圆内均匀分布，否则会全挤在圆心 */
  const a=Math.random()*TAU, rr=Math.sqrt(Math.random())*k.r;
  const tx=k.x+Math.cos(a)*rr, ty=k.y+Math.sin(a)*rr;
  /* 出膛点取"己方城堡方向"，而不是世界坐标的正上方。
     快照对弹道走 180° 镜像（MX/MY/MANG），把"上方"写死进世界坐标的话，
     客机和翻转视角的观众会看到导弹倒着飞；跟着 side 走的方向则天然随镜像一起翻。 */
  const home=k.side?BASE1:BASE0;
  const hx=home.x-tx, hy=home.y-ty, hd=Math.hypot(hx,hy)||1;
  G.projs.push({kind:'mortar',side:k.side,
    x:tx+hx/hd*STRIKE.lobDist+rand(-30,30), y:ty+hy/hd*STRIKE.lobDist,
    tx,ty,tgt:null,cls:'siege',shooter:null,
    dmg:STRIKE.dmg*((k.side===0&&RUN)?RUN.mods.turDmg:1),
    splash:0,wsplash:STRIKE.splash,sp:STRIKE.shellSp,
    ang:Math.atan2(-hy,-hx),dead:false});
}
function updateStrikes(dt){
  for(const k of G.strikes){
    /* 轮次计时独立于齐射：从"开火"起算，所以每轮开始正好隔 gap 秒。
       若等一轮打完再起算，间隔会被齐射时长（shells×shellGap）撑长 */
    if(k.wave<STRIKE.waves){
      k.waveT-=dt;
      if(k.waveT<=0){
        k.wave++;
        k.pend=STRIKE.shells;
        k.shellT=0;
        k.waveT=STRIKE.gap;
        G.shake=Math.max(G.shake,0.14);
      }
    }else k.lingerT-=dt;
    if(k.pend>0){
      k.shellT-=dt;
      /* while 而非 if：低帧率/高倍速下一帧可能要补发多发，否则整轮会被拖长 */
      while(k.pend>0&&k.shellT<=0){k.shellT+=STRIKE.shellGap;k.pend--;fireStrikeShell(k);}
      /* 末轮打完后再留一会儿，否则圈会在最后一发落地前就消失 */
      if(k.pend<=0&&k.wave>=STRIKE.waves)k.lingerT=STRIKE.lobDist/STRIKE.shellSp+0.4;
    }
  }
  G.strikes=G.strikes.filter(k=>k.wave<STRIKE.waves||k.pend>0||k.lingerT>0);
}

/* ---------------- 镜头跟随 ---------------- */
function setFollow(v){
  followMode=v;
  $('btnFollow').classList.toggle('on',v);
}
function followCam(dt){
  let tx=BASE0.x, ty=BASE0.y-110;
  if(G){
    let best=null;
    for(const u of G.units)if(u.side===0&&!u.dying&&UNITS[u.type].cls!=='bldg'&&(!best||u.s>best.s))best=u;
    if(best){const p=pathPos(best.s);tx=p.x;ty=p.y;}
  }
  const k=Math.min(1,dt*2.2);
  cam.x+=(tx-cam.x)*k; cam.y+=(ty-cam.y)*k;
  clampCam();
}
