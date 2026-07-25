'use strict';
/* ---------------- HUD ---------------- */
let qSig='__init', lastIncomeLvlShown=-1, lastMoneyTxt='';
function renderQueue(){
  const q=G.queue;
  let prog=0;
  if(q.length)prog=1-q[0].t/UNITS[q[0].type].build;
  const sig=q.map(i=>i.type).join(',')+'|'+Math.floor(prog*24);
  if(sig===qSig)return;
  qSig=sig;
  $('queuebar').innerHTML=q.map((it,i)=>
    '<div class="qitem">'+UNITS[it.type].emoji+
    (i===0?'<div class="qbar"><div class="qfill" style="width:'+Math.floor(prog*100)+'%"></div></div>':'')+
    '</div>').join('');
}
function refreshHUD(){
  if(!G)return;
  const m='💰'+Math.floor(G.money);
  if(m!==lastMoneyTxt){lastMoneyTxt=m;$('money').textContent=m;}
  /* 含反应堆产量：工程师的经济几乎全靠工坊，不算进去 HUD 会显示成"零增长" */
  let wsy=0;
  for(const u of G.units)if(!u.dying&&u.side===0&&u.type==='b_workshop')wsy+=wsYield(u);
  $('incomeTxt').textContent='+'+Math.round(G.income+FLAG_INCOME*ownedFlags(0)+wsy)+'/秒';
  $('hpL').style.width=(G.baseHp[0]/BASE_HP*100)+'%';
  $('hpR').style.width=(G.baseHp[1]/BASE_HP*100)+'%';
  const lock=mode!=='play'||!!G.over||paused;
  for(const k of cmdrOf(0).roster[G.era]){
    const b=$('btn-'+k);
    if(b)b.disabled=lock||G.money<UNITS[k].cost||G.queue.length>=QUEUE_MAX;
  }
  const be=$('btnEvolve');
  if(G.era===2){be.textContent='👑'; be.classList.remove('ready');}
  else{
    const pct=Math.min(100,Math.floor(G.xp/EVOLVE_XP*100));
    be.textContent=pct>=100?(G.money>=EVOLVE_COST?'⬆️进化!':'⬆️💰'+EVOLVE_COST):'⬆️'+pct+'%';
    be.classList.toggle('ready',!lock&&G.xp>=EVOLVE_XP&&G.money>=EVOLVE_COST);
  }
  const ib=$('btn-inc');
  if(ib){
    if(G.incomeLvl>=INCOME_MAX_LVL)ib.disabled=true;
    else ib.disabled=lock||G.money<incomeCost(G.incomeLvl);
    if(lastIncomeLvlShown!==G.incomeLvl){
      lastIncomeLvlShown=G.incomeLvl;
      const ic=$('inc-cost');
      if(ic)ic.textContent=G.incomeLvl>=INCOME_MAX_LVL?'MAX':'💰'+incomeCost(G.incomeLvl);
    }
  }
  /* 天气标签：显示当前天气与剩余秒数 */
  const wt=$('wTag');
  if(G.weatherKey&&G.weatherKey!=='clear')wt.textContent=G.weather.icon+Math.max(0,Math.ceil(G.weatherT))+'s';
  else if(wt.textContent)wt.textContent='';
  $('emoteWrap').style.display=(G&&mode==='play'&&!G.over)?'flex':'none';
  $('btnEmote').style.display=(G&&G.pvp)?'':'none';
  for(const pt of cmdrOf(0).place){
    const b=$('btn-place-'+pt);
    if(!b)continue;
    const P=PLACEABLES[pt], cs=$('pc-'+pt);
    if(G.pcds[pt][0]>0){
      b.disabled=true;
      if(cs)cs.textContent='⏳'+Math.ceil(G.pcds[pt][0]);
    }else{
      b.disabled=lock||G.money<P.cost;
      if(cs)cs.textContent='💰'+P.cost;
    }
    b.classList.toggle('placing',placing&&placingType===pt);
  }
  renderQueue();
}

/* ---------------- 购买 ---------------- */
function buy(k){
  if(!G||mode!=='play'||paused||G.over)return;
  const c=UNITS[k].cost;
  if(G.money<c||G.queue.length>=QUEUE_MAX)return;
  if(G.pvp&&NET&&!NET.isHost){netSendBuy(k);sClick();return;}
  G.money-=c;
  G.queue.push({type:k,t:UNITS[k].build/(RUN?RUN.mods.build:1)});
  sClick();
}
function buyIncome(){
  if(!G||mode!=='play'||paused||G.over||G.incomeLvl>=INCOME_MAX_LVL)return;
  const c=incomeCost(G.incomeLvl);
  if(G.money<c)return;
  if(G.pvp&&NET&&!NET.isHost){netSendIncome();sClick();return;}
  G.money-=c; G.incomeLvl++; G.income+=INCOME_STEP;
  addFloat(BASE0.x,BASE0.y-130,'⛏️ 收入+'+INCOME_STEP);
  sClick();
}

/* ---------------- DOM 构建与事件 ---------------- */
function buildUnitButtons(){
  const bar=$('unitbar');
  bar.innerHTML='';
  const cmdr=cmdrOf(0);
  for(const k of cmdr.roster[G?G.era:1]){
    const st=UNITS[k];
    const b=document.createElement('button');
    b.className='ub'; b.id='btn-'+k; b.type='button';
    let t=st.name+'：生命'+st.hp+(st.heal?' 治疗'+st.heal:' 攻击'+st.dmg)+(st.proj?' 远程':(st.heal?'':' 近战'));
    if(COUNTER[st.cls])t+=' 克:'+Object.keys(COUNTER[st.cls]).map(c=>CLS_NAME[c]).join('/');
    if(st.cls==='tank')t+=' 受箭伤减半';
    b.title=t;
    const mIdle=st.mech?(ASSETS.mech&&ASSETS.mech.blue[st.mech+'_idle']):null;
    const set=st.ts?ASSETS.ts[G&&G.era===2?'black':'blue']:null;
    const idle=mIdle||(set?set[TS_UNITS[st.ts].idle]:null);
    if(idle){
      b.innerHTML='<canvas class="be bi" width="40" height="40"></canvas><span class="bn">'+st.name+'</span><span class="bc">💰'+st.cost+'</span>';
      const cc=b.querySelector('canvas').getContext('2d');
      cc.imageSmoothingEnabled=false;
      const cell=idle.height;
      if(mIdle){
        /* 图集格底部才是单位本体，直接整格缩放会画出一大片空白 */
        const mm=MECH_META[st.mech], ch=mm?mm.ch:cell;
        const sc=Math.min(40/cell,40/ch);
        const dw=cell*sc, dh=ch*sc;
        cc.drawImage(idle,0,cell-ch,cell,ch,(40-dw)/2,40-dh,dw,dh);
      }else cc.drawImage(idle,cell*0.22,cell*0.16,cell*0.56,cell*0.64,0,0,40,40);
    }else{
      b.innerHTML='<span class="be">'+st.emoji+'</span><span class="bn">'+st.name+'</span><span class="bc">💰'+st.cost+'</span>';
    }
    b.addEventListener('pointerdown',e=>{e.preventDefault();buy(k);});
    bar.appendChild(b);
  }
  if(cmdr.mining){
    const ib=document.createElement('button');
    ib.className='ub'; ib.id='btn-inc'; ib.type='button';
    ib.title='提升金币收入 +'+INCOME_STEP+'/秒';
    ib.innerHTML='<span class="be">⛏️</span><span class="bn">挖矿+'+INCOME_STEP+'</span><span class="bc" id="inc-cost">💰'+incomeCost(0)+'</span>';
    ib.addEventListener('pointerdown',e=>{e.preventDefault();buyIncome();});
    bar.appendChild(ib);
  }
  for(const pt of cmdr.place){
    const P=PLACEABLES[pt];
    const tb=document.createElement('button');
    tb.className='ub dark'; tb.id='btn-place-'+pt; tb.type='button';
    tb.title=P.name+(P.road?'：建在道路上':'：任意位置')+'，冷却 '+P.cd+' 秒'+(P.maxAlive?('，同时最多 '+P.maxAlive+' 座'):'');
    if(pt==='turret'){
      tb.innerHTML='<canvas class="be bi" width="32" height="32"></canvas><span class="bn">重炮</span><span class="bc" id="pc-turret">💰'+P.cost+'</span>';
      const tc=tb.querySelector('canvas').getContext('2d');
      tc.fillStyle='#05070a'; tc.fillRect(13,2,6,16);
      tc.fillStyle='#191c24'; tc.beginPath(); tc.arc(16,20,10,0,Math.PI*2); tc.fill();
      tc.fillStyle='#2c313d'; tc.beginPath(); tc.arc(16,20,6.5,0,Math.PI*2); tc.fill();
    }else{
      tb.innerHTML='<span class="be">'+P.emoji+'</span><span class="bn">'+P.name+'</span><span class="bc" id="pc-'+pt+'">💰'+P.cost+'</span>';
    }
    tb.addEventListener('pointerdown',e=>{e.preventDefault();togglePlace(pt);});
    bar.appendChild(tb);
  }
  lastIncomeLvlShown=-1;
}
function tryEvolve(){
  if(!G||mode!=='play'||paused||G.over||G.era===2)return;
  if(G.xp<EVOLVE_XP){toast('👑 经验不足，还差 '+Math.ceil(EVOLVE_XP-G.xp)+' 点（击杀敌军获取）');return;}
  if(G.money<EVOLVE_COST){toast('👑 进化还需 '+Math.ceil(EVOLVE_COST-G.money)+' 金币');return;}
  if(G.pvp&&NET&&!NET.isHost){netSendEvolve();toast('👑 进化指令已发送');sClick();return;}
  if(G.pvp&&NET&&NET.isHost)NET.sendFx({k:'evh'});
  G.money-=EVOLVE_COST; G.era=2; G.flash=1;
  buildUnitButtons();
  showBanner('👑 时代进化!');
  toast('👑 王国时代：黑铁精锐军团已就位');
  sEvolve();
}
$('btnEvolve').addEventListener('pointerdown',e=>{e.preventDefault();tryEvolve();});
$('btnFollow').addEventListener('pointerdown',e=>{e.preventDefault();setFollow(!followMode);});
$('btnPause').addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(mode!=='play'||!G||G.over)return;
  setPaused(!paused);
});
$('btnResume').addEventListener('pointerdown',e=>{e.preventDefault();setPaused(false);});
$('btnSpeedReq').addEventListener('pointerdown',e=>{
  e.preventDefault();
  speedBtnTap();
});
$('btnSpdOk').addEventListener('pointerdown',e=>{e.preventDefault();answerSpd(true);});
$('btnSpdNo').addEventListener('pointerdown',e=>{e.preventDefault();answerSpd(false);});
/* 音量：可拖动滑块（0-100），记忆到 localStorage */
function volIconFor(p){return p<=0?'🔇':(p<34?'🔈':(p<70?'🔉':'🔊'));}
function applyVolUI(p,quiet){
  p=clamp(Math.round(p),0,100);
  setVolume(p/100);
  $('btnVol').textContent=volIconFor(p)+p;
  $('volIcon').textContent=volIconFor(p);
  $('volNum').textContent=p;
  if($('volRange').value!=String(p))$('volRange').value=p;
  try{localStorage.setItem('wg_vol',p);}catch(e){}
  if(!quiet)sClick();
}
(function initVolume(){
  let saved=100;
  try{const v=localStorage.getItem('wg_vol');if(v!==null)saved=clamp(parseInt(v,10)||0,0,100);}catch(e){}
  applyVolUI(saved,true);
  const rng=$('volRange'), panel=$('volPanel');
  /* 滑块要吃自己的指针事件，别冒泡到画布去拖镜头 */
  ['pointerdown','pointermove','pointerup','touchstart','touchmove','wheel'].forEach(ev=>
    panel.addEventListener(ev,e=>e.stopPropagation()));
  rng.addEventListener('input',()=>applyVolUI(+rng.value,true));
  rng.addEventListener('change',()=>applyVolUI(+rng.value));
  $('btnVol').addEventListener('pointerdown',e=>{
    e.preventDefault();
    panel.classList.toggle('hidden');
    sClick();
  });
  /* 点面板外关闭 */
  document.addEventListener('pointerdown',e=>{
    if(panel.classList.contains('hidden'))return;
    if(panel.contains(e.target)||e.target===$('btnVol'))return;
    panel.classList.add('hidden');
  },true);
})();
$('btnMute').addEventListener('pointerdown',e=>{
  e.preventDefault();
  muted=!muted;
  $('btnMute').textContent=muted?'🔇':'🔊';
  if(MUSIC){
    if(muted)MUSIC.pause();
    else if(mode==='play')startMusic();
  }
});
function setPaused(v){
  if(v&&G&&G.pvp)return; /* 对战不能暂停 */
  paused=v;
  $('pauseov').classList.toggle('hidden',!v);
}
/* ---------------- Roguelike 远征流程 ---------------- */
const PERKS=[
  {id:'atk', icon:'⚔️',name:'磨刀石',  desc:'全军攻击 +12%',apply:m=>m.dmg*=1.12},
  {id:'hp',  icon:'❤️',name:'精钢铠甲',desc:'全军生命 +15%',apply:m=>m.hp*=1.15},
  {id:'eco', icon:'💰',name:'金矿股份',desc:'基础收入 +3/秒',apply:m=>m.income+=3},
  {id:'spd', icon:'💨',name:'行军号角',desc:'全军移速 +12%',apply:m=>m.speed*=1.12},
  {id:'bld', icon:'⏱️',name:'征兵官',  desc:'生产速度 +25%',apply:m=>m.build*=1.25},
  {id:'tur', icon:'🛢️',name:'军械学院',desc:'部署技冷却 -35%、重炮伤害 +30%',apply:m=>{m.turCd*=0.65;m.turDmg*=1.3;}},
  {id:'crit',icon:'🎯',name:'致命打击',desc:'暴击率 +8%',apply:m=>m.critAdd+=0.08},
  {id:'heal',icon:'✚', name:'圣光祝福',desc:'修士治疗 +50%',apply:m=>m.heal*=1.5},
  {id:'xp',  icon:'📜',name:'古代典籍',desc:'每战开局自带 50% 进化经验',apply:m=>m.xp0=Math.min(1,m.xp0+0.5)},
  {id:'gold',icon:'🪙',name:'战争资金',desc:'每战开局金币 +150',apply:m=>m.gold+=150},
];
/* 兵种特训强化（训练营/奖励池）——按指挥官分组，fam 必须匹配 famOf(兵种key) */
const PERKS_UNIT_MECH=[
  {id:'m_militia_d', icon:'🤖',name:'高压电刃',desc:'改造兵系攻击 +30%',fam:'militia', k:'dmg',v:1.3},
  {id:'m_militia_h', icon:'🤖',name:'复合装甲',desc:'改造兵系生命 +35%',fam:'militia', k:'hp', v:1.35},
  {id:'m_crossbow_d',icon:'🛸',name:'聚焦透镜',desc:'浮游炮系攻击 +30%',fam:'crossbow',k:'dmg',v:1.3},
  {id:'m_crossbow_r',icon:'🛸',name:'远程校准',desc:'浮游炮系射程 +15%',fam:'crossbow',k:'range',v:1.15},
  {id:'m_ram_d',     icon:'🚜',name:'动力锤头',desc:'工程车系攻击 +35%',fam:'ram',     k:'dmg',v:1.35},
  {id:'m_ram_h',     icon:'🚜',name:'反应装甲',desc:'工程车系生命 +40%',fam:'ram',     k:'hp', v:1.4},
];
const PERKS_UNIT_KNIGHT=[
  {id:'u_sword_d', icon:'🗡️',name:'剑术大师',desc:'剑士系攻击 +30%',fam:'sword', k:'dmg',v:1.3},
  {id:'u_sword_h', icon:'🗡️',name:'重甲剑士',desc:'剑士系生命 +35%',fam:'sword', k:'hp', v:1.35},
  {id:'u_spear_d', icon:'🔱',name:'破甲枪头',desc:'长枪系攻击 +30%',fam:'spear', k:'dmg',v:1.3},
  {id:'u_spear_h', icon:'🔱',name:'枪阵操典',desc:'长枪系生命 +35%',fam:'spear', k:'hp', v:1.35},
  {id:'u_archer_d',icon:'🏹',name:'穿云箭',  desc:'弓手系攻击 +30%',fam:'archer',k:'dmg',v:1.3},
  {id:'u_archer_r',icon:'🏹',name:'鹰眼',    desc:'弓手系射程 +15%',fam:'archer',k:'range',v:1.15},
  {id:'u_shield_h',icon:'🛡️',name:'城墙之躯',desc:'盾卫系生命 +40%',fam:'shield',k:'hp', v:1.4},
  {id:'u_shield_d',icon:'🛡️',name:'盾击',    desc:'盾卫系攻击 +35%',fam:'shield',k:'dmg',v:1.35},
  {id:'u_monk_e',  icon:'✝️',name:'大祭司',  desc:'修士系治疗 +60%',fam:'monk',  k:'heal',v:1.6},
  {id:'u_monk_h',  icon:'✝️',name:'圣职袍',  desc:'修士系生命 +35%',fam:'monk',  k:'hp', v:1.35},
];
/* 特训卡池随指挥官切换：机械军团的兵种家族是 militia/crossbow/ram，
   骑士团是 sword/spear/archer/shield/monk —— 发错池子会让强化完全不生效 */
function unitPerkPool(){
  return ((RUN&&RUN.cmdr)==='engineer')?PERKS_UNIT_MECH:PERKS_UNIT_KNIGHT;
}
const PERKS_UNIT_ALL=PERKS_UNIT_MECH.concat(PERKS_UNIT_KNIGHT);
function perkById(id){return PERKS.find(x=>x.id===id)||PERKS_UNIT_ALL.find(x=>x.id===id);}
function applyPerk(pk){
  if(pk.fam){
    const um=RUN.unitMods;
    um[pk.fam]=um[pk.fam]||{};
    um[pk.fam][pk.k]=(um[pk.fam][pk.k]||1)*pk.v;
  }else{
    pk.apply(RUN.mods);
  }
  RUN.perks.push(pk.id);
}
function nodeLabel(nd){
  if(nd.t==='boss')return '👹 魔王要塞';
  if(nd.t==='chest')return '🎁 宝箱';
  if(nd.t==='event')return '❓ 奇遇';
  if(nd.t==='camp')return '🏕️ 训练营';
  const per=PERSONAS[nd.p];
  return (nd.t==='elite'?'⭐':per.icon)+' '+per.name+(nd.t==='elite'?'·精英':'');
}
function showMap(){
  mode='map';
  for(const id of ['menu','gameover','rewardov','runover','pauseov'])$(id).classList.add('hidden');
  renderMap();
  $('mapov').classList.remove('hidden');
}
function nodeReachable(li,ni){
  if(li!==RUN.layer)return false;
  if(li===0)return true;
  const prev=RUN.map[li-1][RUN.chosenIdx];
  return !!(prev&&prev.next&&prev.next.includes(ni));
}
function renderMap(){
  $('mapInfo').textContent='第 '+(RUN.layer+1)+' / '+RUN.map.length+' 层 · 收集强化：'+
    (RUN.perks.length?RUN.perks.map(id=>{const p=perkById(id);return p?p.icon:'';}).join(''):'无');
  const el=$('mapNodes');
  el.innerHTML='';
  RUN.map.forEach((row,li)=>{
    const rd=document.createElement('div');
    rd.className='maprow';
    row.forEach((nd,ni)=>{
      const b=document.createElement('button');
      b.className='obtn mnode'+(nd.done?' done':'');
      b.type='button';
      b.textContent=nodeLabel(nd);
      if(row.length===1)b.style.gridColumn='1 / -1';
      else b.style.gridColumn=String(nd.col+1);
      b.disabled=nd.done||!nodeReachable(li,ni);
      b.addEventListener('pointerdown',e=>{e.preventDefault();pickNode(li,ni);});
      rd.appendChild(b);
    });
    el.appendChild(rd);
  });
  requestAnimationFrame(drawMapEdges);
}
/* 用 SVG 画节点连线（决定可走的路线） */
function drawMapEdges(){
  const el=$('mapNodes');
  if(!el||!RUN)return;
  const old=el.querySelector('svg');
  if(old)old.remove();
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  const er=el.getBoundingClientRect();
  if(er.width<10)return;
  svg.setAttribute('width',er.width);
  svg.setAttribute('height',er.height);
  const rows=[...el.children].filter(x=>x.classList&&x.classList.contains('maprow'));
  const ctr=btn=>{
    const r=btn.getBoundingClientRect();
    return [r.left-er.left+r.width/2, r.top-er.top+r.height/2];
  };
  for(let l=0;l+1<RUN.map.length;l++){
    RUN.map[l].forEach((nd,ni)=>{
      const from=rows[l]&&rows[l].children[ni];
      if(!from)return;
      for(const t of (nd.next||[])){
        const to=rows[l+1]&&rows[l+1].children[t];
        if(!to)continue;
        const [x1,y1]=ctr(from),[x2,y2]=ctr(to);
        const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
        ln.setAttribute('x1',x1);ln.setAttribute('y1',y1);
        ln.setAttribute('x2',x2);ln.setAttribute('y2',y2);
        ln.setAttribute('stroke',nd.done?'#6f9a4a':'#a97f4b');
        ln.setAttribute('stroke-width','3');
        ln.setAttribute('stroke-dasharray','6 5');
        svg.appendChild(ln);
      }
    });
  }
  el.prepend(svg);
}
function pickNode(li,ni){
  const nd=RUN.map[li][ni];
  if(nd.done||!nodeReachable(li,ni))return;
  RUN.pendingIdx=ni;
  sClick();
  if(nd.t==='chest'){
    nd.done=true; RUN.curNode=nd; RUN.chosenIdx=ni;
    showReward('🎁 宝箱：三选一','mix');
    return;
  }
  if(nd.t==='camp'){
    nd.done=true; RUN.curNode=nd; RUN.chosenIdx=ni;
    showReward('🏕️ 训练营：兵种特训','unit');
    return;
  }
  if(nd.t==='event'){
    nd.done=true; RUN.chosenIdx=ni;
    runEventNode();
    RUN.layer++;
    renderMap();
    return;
  }
  startStage(nd);
}
function runEventNode(){
  const r=Math.random();
  if(r<0.34){
    RUN.goldCarry+=200;
    toast('❓ 旅商赠礼：下一战开局 +200 金');
  }else if(r<0.67){
    const p=PERKS[(Math.random()*PERKS.length)|0];
    applyPerk(p);
    toast('❓ 神秘祭坛：获得 '+p.icon+p.name);
  }else{
    const up=unitPerkPool();
    const p=up[(Math.random()*up.length)|0];
    applyPerk(p);
    toast('❓ 游方教头：获得 '+p.icon+p.name);
  }
}
function startStage(nd){
  RUN.curNode=nd;
  const stage=makeStage(nd);
  newGame(stage);
  mode='play';
  $('mapov').classList.add('hidden');
  toast(stage.per.icon+' '+stage.per.name+(nd.t==='elite'?'（精英）':'')+' — 战斗开始！');
  keepAwake();
  $('wTag').textContent='';
  startMusic();
}
function showReward(title,poolMode){
  mode='map';
  $('mapov').classList.add('hidden');
  $('rewardTitle').textContent=title;
  const cards=[];
  if(poolMode==='unit'){
    const pool=[...unitPerkPool()];
    for(let i=0;i<3&&pool.length;i++)cards.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
  }else{
    const pg=[...PERKS], pu=[...unitPerkPool()];
    for(let i=0;i<3;i++){
      const useUnit=Math.random()<0.35&&pu.length;
      const pool=useUnit?pu:pg;
      if(!pool.length)break;
      cards.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
    }
  }
  const el=$('perkCards');
  el.innerHTML='';
  for(const pk of cards){
    const b=document.createElement('button');
    b.className='obtn pcard'; b.type='button';
    b.innerHTML='<span class="pic">'+pk.icon+'</span><b>'+pk.name+'</b><small>'+pk.desc+'</small>';
    b.addEventListener('pointerdown',e=>{
      e.preventDefault();
      applyPerk(pk);
      $('rewardov').classList.add('hidden');
      RUN.layer++;
      showMap();
      sClick();
    });
    el.appendChild(b);
  }
  $('rewardov').classList.remove('hidden');
}
function showRunEnd(win){
  mode='map';
  $('mapov').classList.add('hidden');
  $('runTitle').textContent=win?'👑 远征成功！魔王要塞已陷落':'💀 远征失败于第 '+(RUN.layer+1)+' 层';
  $('runDesc').textContent='本次收集强化：'+
    (RUN.perks.length?RUN.perks.map(id=>{const p=perkById(id);return p?p.icon:'';}).join(' '):'无');
  $('runover').classList.remove('hidden');
  if(win)showBanner('👑 远征成功!');
}
$('btnRunAgain').addEventListener('pointerdown',e=>{
  e.preventDefault();
  newRun(RUN?RUN.diffKey:'normal');
  showMap();
});
$('btnRunMenu').addEventListener('pointerdown',e=>{
  e.preventDefault();
  $('runover').classList.add('hidden');
  $('menu').classList.remove('hidden');
  mode='menu';
});
document.querySelectorAll('#menu [data-diff]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{
    e.preventDefault();
    newRun(b.dataset.diff);
    RUN.cmdr=selCmdr;
    $('menu').classList.add('hidden');
    showMap();
    sClick(); startMusic();
  });
});
$('btnAgain').addEventListener('pointerdown',e=>{
  e.preventDefault();
  $('gameover').classList.add('hidden');
  newRun(RUN?RUN.diffKey:'normal');
  showMap();
});
$('btnMenu').addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(typeof NET!=='undefined'&&NET)netLeave();
  $('gameover').classList.add('hidden');
  $('menu').classList.remove('hidden');
  mode='menu';
});
$('btnPvp').addEventListener('pointerdown',e=>{e.preventDefault();netCreate();});
$('btnPvpStart').addEventListener('pointerdown',e=>{e.preventDefault();netStartMatch();});
$('btnCmdrLock').addEventListener('pointerdown',e=>{e.preventDefault();netLockCmdr();});
$('btnPvpCancel').addEventListener('pointerdown',e=>{
  e.preventDefault();
  netLeave();
  $('menu').classList.remove('hidden');
  mode='menu';
});
/* ---------------- 指挥官选择（菜单+PvP大厅共用） ---------------- */
let selCmdr='marshal';
function buildCmdrPick(elId){
  const el=$(elId);
  if(!el)return;
  el.innerHTML='';
  for(const key in COMMANDERS){
    const c=COMMANDERS[key];
    const b=document.createElement('button');
    b.className='obtn cmbtn'+(selCmdr===key?' sel':'');
    b.type='button';
    b.innerHTML='<span class="pic">'+c.icon+'</span><b>'+c.name+'</b><small>'+c.desc+'</small>';
    if(elId==='pvpCmdrPick'&&typeof NET!=='undefined'&&NET&&NET.myLocked)b.disabled=true;
    b.addEventListener('pointerdown',e=>{
      e.preventDefault();
      if(typeof NET!=='undefined'&&NET&&NET.myLocked){toast('已确认指挥官，无法更改');return;}
      selCmdr=key;
      buildCmdrPick('cmdrPickMenu');
      buildCmdrPick('pvpCmdrPick');
      sClick();
    });
    el.appendChild(b);
  }
}
buildCmdrPick('cmdrPickMenu');
buildCmdrPick('pvpCmdrPick');

(function buildEmoteBar(){
  const bar=$('emoteBar');
  EMOTES.forEach((em,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.textContent=em;
    b.addEventListener('pointerdown',e=>{e.preventDefault();sendEmoteIdx(i);});
    bar.appendChild(b);
  });
})();
$('btnEmote').addEventListener('pointerdown',e=>{
  e.preventDefault();
  $('emoteBar').classList.toggle('hidden');
});
$('btnPvpCopy').addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(!NET)return;
  const link=netLink();
  if(navigator.clipboard&&navigator.clipboard.writeText)
    navigator.clipboard.writeText(link).then(()=>toast('📋 已复制邀请链接'),()=>prompt('手动复制链接：',link));
  else prompt('手动复制链接：',link);
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(mode==='play'&&G&&!G.over&&!G.pvp)setPaused(true);
    if(MUSIC)MUSIC.pause();
  }else if(!muted&&mode==='play'){
    startMusic();
  }
});
