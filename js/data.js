'use strict';
/* ---------------- 兵种与数值 ---------------- */
const UNITS={
  /* ---- 时代 I 蓝色骑士团 ---- */
  sword:{emoji:'🗡️',name:'剑士', cls:'inf',   ts:'warrior',era:1,w:26,cost:50, hp:110,dmg:13,cd:0.8,range:30, speed:70,build:1.2},
  spear:{emoji:'🔱',name:'长枪兵',cls:'spear', ts:'lancer', era:1,w:20,cost:75, hp:120,dmg:12,cd:0.9,range:40, speed:62,build:1.5},
  archer:{emoji:'🏹',name:'弓手', cls:'ranged',ts:'archer', era:1,w:22,cost:80, hp:70, dmg:11,cd:1.2,range:190,speed:60,build:1.8,proj:'arrow'},
  shield:{emoji:'🛡️',name:'盾卫', cls:'tank',  ts:'guard',  era:1,w:14,cost:130,hp:320,dmg:9, cd:1.1,range:30, speed:45,build:2.6},
  monk:{emoji:'✝️',name:'修士', cls:'heal',  ts:'monk',   era:1,w:9, cost:120,hp:75, dmg:0,heal:14,cd:1.6,range:130,speed:55,build:2.0},
  /* ---- 时代 II 黑铁精锐 ---- */
  sword2:{emoji:'⚔️',name:'黑铁剑士',cls:'inf',   ts:'warrior',era:2,w:24,cost:80, hp:185,dmg:22,cd:0.8,range:30, speed:70,build:1.4},
  spear2:{emoji:'🔱',name:'黑铁枪兵',cls:'spear', ts:'lancer', era:2,w:18,cost:120,hp:200,dmg:20,cd:0.9,range:40, speed:62,build:1.7},
  archer2:{emoji:'🏹',name:'黑铁弓手',cls:'ranged',ts:'archer', era:2,w:20,cost:130,hp:115,dmg:19,cd:1.1,range:200,speed:60,build:2.0,proj:'arrow'},
  shield2:{emoji:'🛡️',name:'黑铁重盾',cls:'tank',  ts:'guard',  era:2,w:14,cost:210,hp:520,dmg:15,cd:1.1,range:30, speed:43,build:2.8},
  monk2:{emoji:'✝️',name:'大修士', cls:'heal',  ts:'monk',   era:2,w:9, cost:190,hp:130,dmg:0,heal:26,cd:1.5,range:140,speed:55,build:2.2},
  /* ---- 哥布林阵营（Roguelike 敌方关卡） ---- */
  torch:{emoji:'🔥',name:'火把狂徒',cls:'inf',   gob:'torch', era:1,w:30,cost:45, hp:95, dmg:12,cd:0.7,range:28, speed:95,build:1.0},
  tnt:{emoji:'🧨',name:'TNT投手', cls:'ranged',gob:'tnt',   era:1,w:16,cost:110,hp:85, dmg:22,cd:1.8,range:180,speed:55,build:1.9,proj:'dynamite',splash:60},
  barrel:{emoji:'💣',name:'滚桶兵', cls:'bomb',  gob:'barrel',era:1,w:14,cost:90, hp:140,dmg:46,cd:1,  range:26, speed:85,build:1.6,splash:55},
  /* ---- 攻城工程师兵种 ---- */
  militia:{emoji:'🪓',name:'民兵', cls:'inf',   ts:'pawn',era:1,w:28,cost:40, hp:90, dmg:10,cd:0.8,range:28, speed:66,build:1.0},
  crossbow:{emoji:'🏹',name:'弩卫', cls:'ranged',ts:'archer',era:1,w:20,cost:95, hp:80, dmg:14,cd:1.4,range:200,speed:52,build:2.0,proj:'arrow'},
  ram:{emoji:'🔨',name:'撞锤兵',cls:'siege', ts:'guard', era:1,w:14,cost:150,hp:260,dmg:20,cd:1.2,range:30, speed:44,build:2.4},
  militia2:{emoji:'🪓',name:'黑铁民兵',cls:'inf',  ts:'pawn',era:2,w:28,cost:60, hp:150,dmg:17,cd:0.8,range:28,speed:66,build:1.2},
  crossbow2:{emoji:'🏹',name:'黑铁弩卫',cls:'ranged',ts:'archer',era:2,w:20,cost:145,hp:130,dmg:23,cd:1.3,range:210,speed:52,build:2.2,proj:'arrow'},
  ram2:{emoji:'🔨',name:'黑铁撞锤',cls:'siege',ts:'guard',era:2,w:14,cost:230,hp:430,dmg:33,cd:1.2,range:30,speed:42,build:2.6},
  /* ---- 建筑（速度为0的路上实体，占位阻路可被攻击） ---- */
  b_barricade:{emoji:'🚧',name:'拒马', cls:'bldg',bk:'barricade',era:1,w:0,cost:120,hp:900,dmg:0, cd:9,  range:0,  speed:0,build:0},
  b_tower:{emoji:'🗼',name:'箭塔', cls:'bldg',bk:'tower',    era:1,w:0,cost:220,hp:450,dmg:14,cd:0.9,range:230,speed:0,build:0,proj:'arrow'},
  b_workshop:{emoji:'🏭',name:'工坊', cls:'bldg',bk:'workshop', era:1,w:0,cost:200,hp:300,dmg:0, cd:9,  range:0,  speed:0,build:0},
};
const ERA_ROSTER={
  1:['sword','spear','archer','shield','monk'],
  2:['sword2','spear2','archer2','shield2','monk2'],
};
const COUNTER={ /* 克制环：剑克枪 → 枪克盾/爆破 → 盾挡箭 → 弓克步兵/修士；攻城克建筑 */
  inf:{spear:1.5},
  spear:{tank:1.6,bomb:1.6},
  ranged:{inf:1.5,heal:1.5},
  siege:{bldg:2.5,tank:1.3},
  bomb:{bldg:1.8},
};
const CLS_NAME={inf:'步兵',spear:'枪兵',ranged:'远程',tank:'重甲',heal:'修士',bomb:'爆破',siege:'攻城',bldg:'建筑'};
/* ---------------- 指挥官 ---------------- */
const COMMANDERS={
  marshal:{
    icon:'⚖️',name:'王国元帅',
    desc:'均衡之道：五兵种克制环 · 挖矿经济 · 限时重炮',
    income:8,killMult:0.35,mining:true,
    roster:{1:['sword','spear','archer','shield','monk'],2:['sword2','spear2','archer2','shield2','monk2']},
    place:['turret'],
  },
  engineer:{
    icon:'🏗️',name:'攻城工程师',
    desc:'阵地之王：拒马锁路 · 箭塔火力 · 前线工坊经济（越靠前产量越高）',
    income:6,killMult:0.3,mining:false,
    roster:{1:['militia','crossbow','ram'],2:['militia2','crossbow2','ram2']},
    place:['barricade','tower','workshop','turret'],
  },
};
function cmdrOf(side){
  const k=side?(G&&G.cmdr1)||'marshal':(G&&G.cmdr0)||'marshal';
  return COMMANDERS[k]||COMMANDERS.marshal;
}
/* 可放置物（turret=限时重炮，其余为建筑实体） */
const PLACEABLES={
  turret:{icon:null,emoji:'🛢',name:'重炮',cost:250,cd:45,road:false},
  barricade:{emoji:'🚧',name:'拒马',cost:120,cd:20,road:true,maxAlive:2,unit:'b_barricade'},
  tower:{emoji:'🗼',name:'箭塔',cost:220,cd:35,road:true,maxAlive:2,unit:'b_tower'},
  workshop:{emoji:'🏭',name:'工坊',cost:200,cd:25,road:true,maxAlive:3,unit:'b_workshop'},
};
function wsYield(u){ /* 工坊产量：越靠近敌方越高 2~6/秒 */
  const f=u.side?1-u.s/L:u.s/L;
  return 2+4*clamp((f-0.08)/0.84,0,1);
}
const BASE_HP=900, KILL_REWARD=0.35, QUEUE_MAX=5, INCOME_STEP=3, INCOME_MAX_LVL=10;
const EVOLVE_XP=300, EVOLVE_COST=500, FLAG_INCOME=3, FLAG_RANGE=90, FLAG_TIME=3;
const TURRET={cost:250,cd:45,life:25,range:260,dmg:35,splash:55,turn:1.6,fireCd:2.2,shellSp:300};
const incomeCost=lvl=>Math.round(100*Math.pow(1.5,lvl));
const DIFFS={easy:{mult:0.8},normal:{mult:1.0},hard:{mult:1.22}};
/* ---------------- 天气 ---------------- */
const WEATHERS={
  clear:{icon:'☀️',name:'晴朗',desc:''},
  snow:{icon:'❄️',name:'大雪',speedMul:0.72,tint:'rgba(215,232,255,0.16)',part:'snow',desc:'全军移速 -28%'},
  heat:{icon:'🔥',name:'酷热',dot:2.5,tint:'rgba(255,120,40,0.10)',part:'heat',desc:'士兵持续失水掉血(不会渴死)，战场更短'},
  rain:{icon:'🌧️',name:'暴雨',rangedMul:0.75,speedMul:0.9,tint:'rgba(50,70,130,0.14)',part:'rain',desc:'远程射程 -25%，移速 -10%'},
};
/* PvP 快速表情表 */
const EMOTES=['😄','😡','😏','❤️','💀','😢','👍','🤝'];
/* ---------------- 兵种家族加成（Roguelike 特训） ---------------- */
function famOf(t){return t.replace(/2$/,'');}
function famMod(type,k){
  if(!RUN)return 1;
  const fm=RUN.unitMods[famOf(type)];
  return (fm&&fm[k])||1;
}
/* AI 性格模板：出兵池/决策节奏/经济倾向/进化 */
const PERSONAS={
  rush:  {icon:'🐗',name:'猪突之营',roster:['torch','torch','torch','barrel','tnt'],decide:[0.3,0.8],queue:3,eco:0.06,mult:0.85,smart:false,evolve:false},
  turtle:{icon:'🏰',name:'龟缩堡垒',roster:null,weights:{shield:34,archer:28,spear:16,monk:14,sword:8},decide:[0.7,1.3],queue:4,eco:0.2,mult:1.0,smart:true,evolve:true,evolveMul:1.2},
  economy:{icon:'💰',name:'商人领主',roster:null,decide:[0.6,1.2],queue:3,eco:0.5,mult:0.78,smart:true,evolve:true,evolveMul:0.85},
  tricky:{icon:'🎲',name:'诡诈巢穴',roster:['tnt','tnt','barrel','barrel','torch'],decide:[0.5,1.0],queue:3,eco:0.15,mult:0.95,smart:false,evolve:false},
  boss:  {icon:'👹',name:'魔王要塞',roster:['torch','barrel','tnt','sword2','spear2','archer2','shield2'],decide:[0.35,0.8],queue:4,eco:0.3,mult:1.3,smart:true,evolve:false,aiEra:2},
};
let RUN=null;
function newRun(diffKey){
  RUN={diffKey,layer:0,map:genMap(),curNode:null,chosenIdx:0,pendingIdx:0,
       goldCarry:0,perks:[],unitMods:{},
       mods:{dmg:1,hp:1,speed:1,build:1,heal:1,income:0,gold:0,critAdd:0,xp0:0,turCd:1,turDmg:1}};
}
/* 杀戮尖塔式路网：9层×4列，3条随机步道决定节点与连边，同层只能走相连节点 */
function genMap(){
  const LAYERS=9, COLS=4, ps=['rush','turtle','economy','tricky'];
  const WPOOL=['clear','clear','clear','snow','heat','rain'];
  const grid=Array.from({length:LAYERS},()=>Array(COLS).fill(null));
  const walkCols=[];
  for(let w=0;w<3;w++){
    let col=(Math.random()*COLS)|0;
    const cols=[col];
    for(let l=2;l<LAYERS-1;l++){
      col=clamp(col+((Math.random()*3)|0)-1,0,COLS-1);
      cols.push(col);
    }
    walkCols.push(cols);
  }
  for(const cols of walkCols)
    cols.forEach((c,i)=>{
      const l=i+1;
      if(!grid[l][c])grid[l][c]={col:c,done:false,edges:new Set()};
    });
  for(const cols of walkCols)
    for(let i=0;i+1<cols.length;i++)
      grid[i+1][cols[i]].edges.add(cols[i+1]);
  for(let l=1;l<LAYERS-1;l++)for(let c=0;c<COLS;c++){
    const nd=grid[l][c];
    if(!nd)continue;
    const r=Math.random(), pk=ps[(Math.random()*ps.length)|0];
    if(l===1){nd.t='battle';nd.p=pk;}
    else if(r<0.42||(r<0.56&&l<3)){nd.t='battle';nd.p=pk;}
    else if(r<0.56){nd.t='elite';nd.p=pk;}
    else if(r<0.71)nd.t='chest';
    else if(r<0.86)nd.t='event';
    else nd.t='camp';
    nd.w=(nd.t==='battle'||nd.t==='elite')?WPOOL[(Math.random()*WPOOL.length)|0]:'clear';
  }
  const start={t:'battle',p:'rush',w:'clear',col:1,done:false,next:[]};
  const boss={t:'boss',p:'boss',w:'clear',col:1,done:false,next:[]};
  const map=[[start]];
  const idxByCol=[null];
  for(let l=1;l<LAYERS-1;l++){
    const row=[], ic={};
    for(let c=0;c<COLS;c++)if(grid[l][c]){ic[c]=row.length;row.push(grid[l][c]);}
    map.push(row);
    idxByCol.push(ic);
  }
  map.push([boss]);
  start.next=map[1].map((_,i)=>i);
  for(let l=1;l<LAYERS-2;l++){
    for(const nd of map[l]){
      nd.next=[...nd.edges].map(c=>idxByCol[l+1][c]).filter(x=>x!==undefined);
      if(!nd.next.length)nd.next=[0];
      delete nd.edges;
    }
  }
  for(const nd of map[LAYERS-2]){nd.next=[0];delete nd.edges;}
  return map;
}
function makeStage(nd){
  nd=nd||{t:'battle',p:'turtle',w:'clear'};
  const per=PERSONAS[nd.p||'turtle'];
  const dm=DIFFS[RUN?RUN.diffKey:'normal'].mult;
  const layer=RUN?RUN.layer:0;
  let scale=(1+layer*0.08)*dm;
  if(nd.t==='elite')scale*=1.22;
  const weather=nd.w||'clear';
  const events=[];
  if(nd.t!=='boss'||Math.random()<0.5){
    const nEv=Math.random()<0.65?(Math.random()<0.35?2:1):0;
    const pool=['gold','meteor','bounty'];
    for(let i=0;i<nEv;i++)
      events.push({at:40+Math.random()*70,type:pool[(Math.random()*pool.length)|0],done:false});
  }
  return {node:nd,per,weather,events,
    mapDef:genMapDef({short:weather==='heat',noFork:false}),
    aiIncomeMul:per.mult*scale,
    hpMul:clamp(scale,0.75,2.0),
    dmgMul:clamp(1+(scale-1)*0.6,0.8,1.7),
    gobColor:(nd.t==='boss'||nd.t==='elite')?'purple':'red'};
}
