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
     turrets:[],pcds:{turret:[0,0],airdrop:[0,0],barricade:[0,0],tower:[0,0],workshop:[0,0]},booms:[],
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
    cd:rand(0.1,0.4),walk:rand(0,6),lunge:0,dying:0,moving:false,kills:0,star:false,
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
  e.hp-=dmg;
  if(e.hp<=0){
    e.dying=1e-4;
    const c=UNITS[e.type].cost;
    const km=bySide===0?cmdrOf(0).killMult:(G.pvp?cmdrOf(1).killMult:KILL_REWARD);
    let reward=Math.round(c*km);
    if(G.bountyT>0)reward*=2;
    const p=unitPos(e);
    if(bySide===0){
      G.money+=reward; G.xp+=c*0.25;
      addFloat(p.x,p.y-46,'+'+reward+'💰');
      bumpStreak(); sCoin();
    }else if(bySide===1){
      G.aiMoney+=reward;
      if(G.per.evolve)G.aiXp+=c*0.25;
    }
    if(attacker&&!attacker.dying){
      attacker.kills++;
      if(attacker.kills>=3&&!attacker.star){
        attacker.star=true;
        attacker.hp=Math.min(attacker.max,attacker.hp+attacker.max*0.3);
        const ap=unitPos(attacker);
        addFloat(ap.x,ap.y-58,'⭐老兵!','#ffd76a',15);
      }
    }
    sDie();
  }
}
/* 克制/暴击/老兵伤害结算 */
function rollDmg(st,def,attacker,side){
  let m=(COUNTER[st.cls]&&COUNTER[st.cls][UNITS[def.type].cls])||1;
  if(UNITS[def.type].cls==='tank'&&st.cls==='ranged')m*=0.5;
  const critP=side===0?0.1+(RUN?RUN.mods.critAdd:0):0.1;
  const crit=Math.random()<critP;
  let dmg=st.dmg*m*(crit?2:1);
  if(attacker&&attacker.star)dmg*=1.3;
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
    if(f.prog>=1&&f.owner!==0){f.owner=0;toast('🚩 占领哨站！收入+'+FLAG_INCOME+'/秒');sFlag();netFx({k:'fc',side:0});}
    if(f.prog<=-1&&f.owner!==1){f.owner=1;toast('⚠️ 敌军占领了哨站');sFlag();netFx({k:'fc',side:1});}
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
    let tgt=null, tscore=1e9, tds=1e9;
    for(const e of us){
      if(e.side===u.side||e.dying)continue;
      if(rngEff<=50&&Math.abs(e._lat-u._lat)>46)continue; /* 近战不能隔着岔路打 */
      const ds=Math.abs(e.s-u.s);
      const score=ds+Math.abs(e._lat-u._lat)*0.3;
      if(score<tscore){tscore=score;tds=ds;tgt=e;}
    }
    const bd=u.side?u.s-55:L-55-u.s;
    let onBase=false, td=tds;
    if(!tgt||bd<tds){td=bd;tgt=null;onBase=true;}
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
    if(td<=rngEff){
      if(u.cd<=0){u.cd=st.cd;u.lunge=1;u.atkT=0;fire(u,st,tgt,onBase);}
    }else{
      if(!u.hold){
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
        sBoom();
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
  let wy0=0,wy1=0;
  for(const u of G.units)
    if(!u.dying&&u.type==='b_workshop'){if(u.side)wy1+=wsYield(u);else wy0+=wsYield(u);}
  G.money+=(G.income+FLAG_INCOME*ownedFlags(0)+wy0)*dt;
  G.aiMoney+=(G.aiIncome+FLAG_INCOME*ownedFlags(1)+wy1)*dt;
  updQueue(G.queue,dt,0);
  updQueue(G.aiQueue,dt,1);
  if(!G.pvp)aiThink(dt);
  updateUnits(dt);
  updateProjs(dt);
  updateFlags(dt);
  updateTurrets(dt);
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
    let cs=L/2,n=1;
    for(const u of G.units)if(!u.dying){cs+=u.s;n++;}
    cs/=n;
    for(let i=0;i<4;i++){
      const s=clamp(cs+rand(-260,260),80,L-80);
      const p=pathPos(s);
      G.booms.push({x:p.x+rand(-40,40),y:p.y+rand(-30,30),t:-i*0.25});
      for(const e of G.units){
        if(e.dying)continue;
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

/* ---------------- 放置系统（重炮 + 工程师建筑：拒马/箭塔/工坊） ---------------- */
let placing=false, placePos=null, placingType='turret';
function togglePlace(ty){
  if(!G||mode!=='play'||paused||G.over||G.spectator)return;
  ty=ty||'turret';
  if(placing&&placingType===ty){placing=false;placePos=null;toast('已取消部署');return;}
  const P=PLACEABLES[ty];
  if(G.pcds[ty][0]>0||G.money<P.cost)return;
  placing=true; placingType=ty; placePos=null;
  toast('🎯 按住拖动选位，松手部署'+P.name+(P.road?'（必须建在道路上）':'')+'，再点按钮取消');
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
function buildingPlaceCore(side,ty,s,localToast){
  const P=PLACEABLES[ty], ut=P.unit, st=UNITS[ut];
  const money=side?G.aiMoney:G.money;
  if(money<P.cost||G.pcds[ty][side]>0)return;
  if(countBldg(side,ut)>=P.maxAlive){if(localToast)toast('⚠️ '+P.name+'最多同时存在 '+P.maxAlive+' 座');return;}
  if(side===0&&s>L-260){if(localToast)toast('⚠️ 离敌方城堡太近');return;}
  if(side===1&&s<260)return;
  if(side)G.aiMoney-=P.cost; else G.money-=P.cost;
  G.pcds[ty][side]=P.cd*(side?1:(RUN?RUN.mods.turCd:1));
  G.units.push({uid:(G.uidSeq=(G.uidSeq||0)+1),side,type:ut,s,off:0,
    hp:st.hp,max:st.hp,cd:rand(0.3,0.8),walk:0,lunge:0,dying:0,moving:false,
    kills:0,star:false,atkT:9,animT:0});
  if(localToast)toast('🔨 '+P.name+'建造完成'+(ty==='workshop'?'（此位置产量 +'+Math.round(wsYield({side,s}))+'/秒）':''));
  sBoom();
}
/* 空降守备队：一支不推进的临时部队，随时代变强，限时后消失 */
function airdropCore(side,s){
  const P=PLACEABLES.airdrop;
  const money=side?G.aiMoney:G.money;
  if(money<P.cost||G.pcds.airdrop[side]>0)return;
  if(side===0&&s>L-260)return;
  if(side===1&&s<260)return;
  if(side)G.aiMoney-=P.cost; else G.money-=P.cost;
  G.pcds.airdrop[side]=P.cd*(side?1:(RUN?RUN.mods.turCd:1));
  const era=side?G.aiEra:G.era;
  const comp=era===2?['sword2','sword2','archer2']:['sword','sword','archer'];
  comp.forEach((k,i)=>{
    const st=UNITS[k];
    const hpMul=(side?(G.stage?G.stage.hpMul:1):(RUN?RUN.mods.hp:1)*famMod(k,'hp'))*1.15;
    const hp=Math.round(st.hp*hpMul);
    G.units.push({uid:(G.uidSeq=(G.uidSeq||0)+1),side,type:k,
      s:clamp(s+(i-1)*26*(side?1:-1),20,L-20),
      off:LANE_SLOTS[i%LANE_SLOTS.length]+rand(-4,4),
      hp,max:hp,cd:rand(0.1,0.3),walk:rand(0,6),lunge:0,dying:0,moving:false,
      kills:0,star:false,atkT:9,animT:rand(0,9),hold:true,expireT:P.life});
  });
  const p=pathPos(s);
  addFloat(p.x,p.y-50,'🪂 空降!','#ffd76a',20);
  G.booms.push({x:p.x,y:p.y,t:0});
  sSpawn();
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
      /* 与主机同样的数量上限预检查，避免指令被静默丢弃却提示成功 */
      if(P.maxAlive&&countBldg(0,P.unit)>=P.maxAlive){
        toast('⚠️ '+P.name+'最多同时存在 '+P.maxAlive+' 座');
        return;
      }
      NET.sendCmd({a:'p',t:ty,x:Math.round(WORLD_W-wx),y:Math.round(WORLD_H-wy)});
      toast(P.drop?'🪂 空降指令已发送':'🔨 建造指令已发送');
      return;
    }
    if(P.drop){
      if(pr.s>L-260){toast('⚠️ 离敌方城堡太近');return;}
      airdropCore(0,pr.s);
      toast('🪂 守备队空降完成，坚守 '+P.life+' 秒');
      return;
    }
    buildingPlaceCore(0,ty,pr.s,true);
    return;
  }
  if(G.pvp&&NET&&!NET.isHost){
    if(G.money<TURRET.cost||G.pcds.turret[0]>0)return;
    if(wx<30||wx>WORLD_W-30||wy<30||wy>WORLD_H-30){toast('⚠️ 超出战场边界');return;}
    if(Math.hypot(wx-BASE1.x,wy-BASE1.y)<200){toast('⚠️ 离敌方城堡太近');return;}
    NET.sendCmd({a:'p',t:'turret',x:Math.round(WORLD_W-wx),y:Math.round(WORLD_H-wy)});
    toast('🛡 部署指令已发送');
    return;
  }
  turretPlaceCore(0,wx,wy,true);
}
function turretPlaceCore(side,wx,wy,localToast){
  const money=side?G.aiMoney:G.money;
  if(money<TURRET.cost||G.pcds.turret[side]>0)return;
  if(wx<30||wx>WORLD_W-30||wy<30||wy>WORLD_H-30){if(localToast)toast('⚠️ 超出战场边界');return;}
  const eb=side?BASE0:BASE1;
  if(Math.hypot(wx-eb.x,wy-eb.y)<200){if(localToast)toast('⚠️ 离敌方城堡太近');return;}
  if(side)G.aiMoney-=TURRET.cost; else G.money-=TURRET.cost;
  G.pcds.turret[side]=TURRET.cd*(side?1:(RUN?RUN.mods.turCd:1));
  G.turrets.push({side,x:wx,y:wy,ang:side?Math.PI/2:-Math.PI/2,cd:0.8,life:TURRET.life,flash:0});
  if(localToast)toast('🛡 重炮部署完成，持续 '+TURRET.life+' 秒');
  sBoom();
}
function updateTurrets(dt){
  for(const t of G.turrets){
    t.life-=dt;
    t.cd-=dt;
    t.flash=Math.max(0,t.flash-dt*3);
    let best=null,bd=1e9,bp=null;
    for(const u of G.units){
      if(u.side===(t.side||0)||u.dying)continue;
      const p=unitPos(u);
      const d=Math.hypot(p.x-t.x,p.y-t.y);
      if(d<bd){bd=d;best=u;bp=p;}
    }
    if(best&&bd<=TURRET.range){
      const want=Math.atan2(bp.y-t.y,bp.x-t.x);
      let diff=want-t.ang;
      while(diff>Math.PI)diff-=TAU;
      while(diff<-Math.PI)diff+=TAU;
      const mx=TURRET.turn*dt;
      t.ang+=clamp(diff,-mx,mx);
      if(Math.abs(diff)<0.12&&t.cd<=0){
        t.cd=TURRET.fireCd; t.flash=1;
        G.projs.push({kind:'shell',side:t.side||0,x:t.x+Math.cos(t.ang)*30,y:t.y+Math.sin(t.ang)*30,
          tx:bp.x,ty:bp.y,tgt:best,dmg:TURRET.dmg*(((t.side||0)===0&&RUN)?RUN.mods.turDmg:1),cls:'siege',shooter:null,
          splash:0,wsplash:TURRET.splash,sp:TURRET.shellSp,ang:t.ang,dead:false});
        sBoom();
        G.shake=Math.max(G.shake,0.12);
      }
    }
  }
  G.turrets=G.turrets.filter(t=>t.life>0);
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
