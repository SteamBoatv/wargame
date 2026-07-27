'use strict';
/* 单人远征封存开关：联机模式打磨成熟前，单人入口只展示、不可开局。
   菜单灰显与三处开局拦截（选难度/再来一局/再次远征）都只读这一个开关，放开时改 false 即可。 */
const SOLO_LOCKED=true;
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
  /* PvP 下调：这三行原本是按"被玩家打的 AI 敌人"调的，火把狂徒近乎严格优于剑士
     （更便宜、快 36%、每金币 DPS 高 17%）。降血降伤保留"快而脆"，单人已封存不受影响 */
  torch:{emoji:'🔥',name:'火把狂徒',cls:'inf',   gob:'torch', era:1,w:30,cost:45, hp:88, dmg:11,cd:0.7,range:28, speed:95,build:1.0},
  tnt:{emoji:'🧨',name:'TNT投手', cls:'ranged',gob:'tnt',   era:1,w:16,cost:110,hp:85, dmg:22,cd:1.8,range:180,speed:55,build:1.9,proj:'dynamite',splash:60},
  barrel:{emoji:'💣',name:'滚桶兵', cls:'bomb',  gob:'barrel',era:1,w:14,cost:90, hp:140,dmg:46,cd:1,  range:26, speed:85,build:1.6,splash:55},
  /* ---- 攻城工程师：机械化军团（Foozle Sci-Fi Lab, CC0） ----
     mpx = 每源像素对应的屏幕像素；单位实际高度 = MECH_META[sheet].ch * mpx */
  militia:{emoji:'🤖',name:'改造兵',cls:'inf',   mech:'cyborg', mpx:1.75,era:1,w:28,cost:40, hp:90, dmg:10,cd:0.8,range:28, speed:66,build:1.0},
  crossbow:{emoji:'🛸',name:'浮游炮',cls:'ranged',mech:'droid01',mpx:1.3, era:1,w:20,cost:95, hp:80, dmg:14,cd:1.4,range:200,speed:52,build:2.0,proj:'laser_a'},
  ram:{emoji:'🚜',name:'工程重车',cls:'siege', mech:'mecha',  mpx:1.1, era:1,w:14,cost:150,hp:260,dmg:20,cd:1.2,range:34, speed:44,build:2.4},
  militia2:{emoji:'⚙️',name:'突击炮车',cls:'inf', mech:'droid02',mpx:1.5, era:2,w:28,cost:60, hp:150,dmg:17,cd:0.8,range:40, speed:66,build:1.2},
  crossbow2:{emoji:'🔫',name:'重炮坦克',cls:'ranged',mech:'droid03',mpx:2.0,era:2,w:20,cost:145,hp:130,dmg:23,cd:1.3,range:210,speed:52,build:2.2,proj:'laser_b'},
  ram2:{emoji:'🚜',name:'重型机甲',cls:'siege',mech:'mecha',  mpx:1.38,era:2,w:14,cost:230,hp:430,dmg:33,cd:1.2,range:34, speed:42,build:2.6},
  /* ---- 建筑（速度为0的路上实体，占位阻路可被攻击） ---- */
  b_barricade:{emoji:'🚧',name:'路障', cls:'bldg',bk:'barricade',era:1,w:0,cost:120,hp:900,dmg:0, cd:9,  range:0,  speed:0,build:0},
  b_tower:{emoji:'🗼',name:'激光塔',cls:'bldg',bk:'tower',   era:1,w:0,cost:220,hp:450,dmg:14,cd:0.9,range:230,speed:0,build:0,proj:'laser_t',mz:[14,-78]},
  b_workshop:{emoji:'🏭',name:'反应堆',cls:'bldg',bk:'workshop',era:1,w:0,cost:200,hp:300,dmg:0, cd:9,  range:0,  speed:0,build:0},
  /* ---- 掠夺军阀 时代 II：紫色精英哥布林（素材 gob_purple_* 已就位，与红色逐格同构）----
     ⚠️ 新兵种必须追加在 UNITS 末尾：TYPE_KEYS=Object.keys(UNITS) 的顺序就是快照线材协议，
     插在中间会让跨版本客户端的单位类型整体错位（静默错误，极难排查）。
     命名必须是 xxx2 —— famOf 用 /2$/ 归族，改名会让时代 II 脱离家族特训。 */
  torch2:{emoji:'🔥',name:'狂焰暴徒',cls:'inf',   gob:'torch', era:2,w:30,cost:75, hp:145,dmg:19,cd:0.7,range:28, speed:95,build:1.2},
  tnt2:{emoji:'🧨',name:'炸药狂人',cls:'ranged',gob:'tnt',   era:2,w:16,cost:170,hp:130,dmg:36,cd:1.7,range:190,speed:55,build:2.1,proj:'dynamite',splash:65},
  barrel2:{emoji:'💣',name:'爆桶暴徒',cls:'bomb',  gob:'barrel',era:2,w:14,cost:150,hp:262,dmg:78,cd:1,  range:26, speed:85,build:1.8,splash:60},
};
const ERA_ROSTER={
  1:['sword','spear','archer','shield','monk'],
  2:['sword2','spear2','archer2','shield2','monk2'],
};
const COUNTER={ /* 克制环：剑克枪/建筑 → 枪克盾/爆破/攻城 → 盾挡箭 → 弓克步兵/修士；攻城重克建筑 */
  inf:{spear:1.5,bldg:1.6},
  spear:{tank:1.6,bomb:1.6,siege:1.6},
  ranged:{inf:1.5,heal:1.5},
  siege:{bldg:2.5,tank:1.3,bomb:1.5},   /* 攻城车碾滚桶：否则 siege 对军阀阵容全线无克制 */
  bomb:{bldg:1.8},
};
const CLS_NAME={inf:'步兵',spear:'枪兵',ranged:'远程',tank:'重甲',heal:'修士',bomb:'爆破',siege:'攻城',bldg:'建筑'};
/* 机械素材几何：cell=方形图集格边长，ch=格内实际内容高度（源像素，内容贴格底对齐）。
   由 build_mech_assets.py 输出的 assets/mech/meta.json 同步而来，改素材后需一并更新。 */
const MECH_META={
  cyborg:{cell:64,ch:32}, droid01:{cell:48,ch:39}, droid02:{cell:48,ch:35},
  droid03:{cell:48,ch:19}, mecha:{cell:80,ch:61},  drone:{cell:64,ch:35},
};
/* ---------------- 指挥官 ---------------- */
const COMMANDERS={
  marshal:{
    icon:'⚖️',art:'assets/art/cmdr_marshal.png',name:'王国元帅',
    desc:'均衡之道：五兵种克制环 · 挖矿经济 · 空降守备队',
    income:8,killMult:0.35,mining:true,
    roster:{1:['sword','spear','archer','shield','monk'],2:['sword2','spear2','archer2','shield2','monk2']},
    place:['airdrop'],
  },
  engineer:{
    icon:'🏗️',art:'assets/art/cmdr_engineer.png',name:'机械军团',
    desc:'钢铁阵地：路障锁路 · 激光塔火力 · 前线反应堆经济（越靠前产量越高）· 机械化部队',
    income:6,killMult:0.3,mining:false,
    roster:{1:['militia','crossbow','ram'],2:['militia2','crossbow2','ram2']},
    place:['barricade','tower','workshop','strike'],
  },
  /* 第三条经济路线：不投资、不积累，收入靠"把部队压进敌方半场"现抢。
     曲线与另两位相反——前期碾压、后期乏力，是必须速胜的阵营。
     短板是结构性的：无坦克、无治疗、无建筑，被推回自家半场掠夺就归零。 */
  warlord:{
    icon:'⚔️',art:'assets/art/cmdr_warlord.png',name:'掠夺军阀',
    desc:'以战养战：部队踏入敌方半场即掠夺产金 · 高额人头赏金 · 匪群突袭 · 无坦克无治疗',
    income:3,killMult:0.5,mining:false,plunder:true,
    roster:{1:['torch','tnt','barrel'],2:['torch2','tnt2','barrel2']},
    place:['horde'],
  },
};
/* 掠夺：越过半场线的己方机动单位按"深入程度"产金，ramp 处满额，总量计 cap 个封顶。
   ⚠️ 必须是软坡度而不是硬阈值——硬阈值在两种对局里同时错：
   ① 军阀速度 95 vs 全场对手最快 70，自然接战线恒在 0.57L 之后 → 一开打就无条件满额；
   ② 军阀内战速度对称，接战点恰好落在 L/2、双方前排各停在 ∓14px → 双方恒为 0、经济锁死。
   坡度让"多推一点多赚一点"变成连续的，也消掉了跨一像素从 0 跳到满额的台阶。 */
const PLUNDER={rate:3.0,cap:5,ramp:0.11};
/* 未知指挥官键必须退化而不是抛异常：跨版本时旧端会收到它不认识的 key，
   裸下标会在大厅/开局中途 TypeError，把房间拖成无提示死锁（appId 已升级作为第一道防线） */
function cmdrDef(k){return COMMANDERS[k]||COMMANDERS.marshal;}
/* 放置物三分法：建筑 / 空投驻防 / 突袭。三者的前线规则不同，
   核心与客机预检、放置虚影、前线界标必须全部用同一个谓词，否则会出现"房主能放客机不能" */
const placeKind=P=>P.horde?'horde':(P.drop?'drop':'bldg');
function cmdrOf(side){
  const k=side?(G&&G.cmdr1)||'marshal':(G&&G.cmdr0)||'marshal';
  return COMMANDERS[k]||COMMANDERS.marshal;
}
/* 火力覆盖（机械军团技能）：圈定圆形区域，导弹分 waves 轮落下，每轮间隔 gap 秒。
   只伤单位与建筑，打不到城堡——否则会退化成"隔空拆家"的必胜手段。
   轮次间隔比行军速度长：站着打的战线会被三轮全吃，行军中的部队能走出去，这是它的博弈点。
   （必须定义在 PLACEABLES 之前——下面直接引用了 STRIKE.cost/cd） */
const STRIKE={cost:260,cd:50,radius:118,waves:3,gap:5,shells:7,shellGap:0.16,
              lead:1.3,dmg:38,splash:62,shellSp:620,lobDist:520};
/* 空降守备队（王国元帅技能）：3 近战 + 2 远程，落地就摆成前后两排的小阵型。
   它们只在空降点 leash 范围内活动搜敌，锁不到更远的目标，范围内没敌人就自动归位；
   永远不推进战线——这是它和常规出兵的根本区别。 */
/* 匪群突袭（军阀技能）：在选定位置刷出一波常规部队，落地即向前推进。
   与元帅空降的区别是刻意的——空降是"原地驻防的守备队"，突袭是"直接投放的攻势"。 */
const HORDE={
  cost:250,cd:45,
  comp1:['torch','torch','torch','torch','barrel'],   /* 270 金货 → +8% 溢价 */
  comp2:['torch2','torch2','torch2','barrel2'],      /* 375 金货 → +50%，与空降的 +43%/+130% 同档 */
  lane:[0,-22,22,-44,44],
};
const AIRDROP={
  comp1:['sword','sword','sword','archer','archer'],
  comp2:['sword2','sword2','sword2','archer2','archer2'],
  laneM:[0,-24,24],   /* 近战排横向站位 */
  laneR:[-14,14],     /* 远程排横向站位 */
  rowGap:24,          /* 近战排在前、远程排在后，各偏离空降点这么远 */
  leash:120,          /* 离空降点最远能走多远（索敌距离＝leash+自身射程） */
  homeEps:5,          /* 离归位点这么近就算到家，避免原地抖动 */
  fleeLeash:200,      /* 炮击杀伤半径(118+62)＞常规拴绳：预警时临时放宽到这个值让守备队跑出圈 */
};
/* 前线放置规则：物理放置物（建筑+空降）只能部署在"己方前线+余量"以内。
   前线 = 己方存活机动单位与建筑中最靠前者——建筑刻意计入，工程师用工事一步步把阵地拱前；
   取 8 秒滑窗内的最差值：单个敢死兵冲进深处拉不动前线，要在敌方火力下站满 8 秒才算数。
   floor=近半场保底（刚被团灭时最需要放防御建筑，不能把人锁在家门口）；
   dropCap=空降距敌方城堡的额外硬限（守备队索敌半径 310px，再近就能蹲对方出兵点）；
   eps=主机校验远端指令的从宽量，抵消快照延迟与镜像路径的采样差。 */
const FRONT={margin:100,window:8,floor:0.45,dropCap:420,eps:40};
/* 可放置物（strike=区域炮击，airdrop=限时部队，其余为建筑实体） */
const PLACEABLES={
  strike:{emoji:'🎯',name:'火力覆盖',cost:STRIKE.cost,cd:STRIKE.cd,road:false,strike:true},
  airdrop:{emoji:'🪂',name:'空降',cost:250,cd:50,road:true,drop:true,life:25},
  horde:{emoji:'🏴',name:'匪群突袭',cost:HORDE.cost,cd:HORDE.cd,road:true,horde:true},
  barricade:{emoji:'🚧',name:'路障',cost:120,cd:20,road:true,maxAlive:2,unit:'b_barricade'},
  tower:{emoji:'🗼',name:'激光塔',cost:220,cd:35,road:true,maxAlive:2,unit:'b_tower'},
  workshop:{emoji:'🏭',name:'反应堆',cost:200,cd:25,road:true,maxAlive:3,unit:'b_workshop'},
};
/* 反应堆资产化：可升级 + 有残值。
   升级挖出对标元帅挖矿的投资深度（200/450/850 金，修"600 金封顶没有后期"）；
   升级与新建共用 workshop 冷却——经济动作被限频，被拆的真实代价里含时间惩罚。
   残值：被拆返还 kill 比例、主动引导 channel 秒回收返还 recycle 比例——
   前线失守不再是全损，这是"敢把堆立在前线"的底气，也是高风险高回报的下行保护。 */
/* 倍率经统一口径校准（净军费,对手=利润最优元帅,300s/600s）：
   后场零风险≈小亏9%、中场守得住≈小赚12%、前压头奖≈27%、每座只活120s则元帅反超——
   风险梯度必须四档同时成立，改倍率前先跑 econ_final.py 复核 */
const WS_UP=[null,
  {cost:200,mul:1.0,hp:300},
  {cost:250,mul:1.7,hp:450},
  {cost:400,mul:2.3,hp:600}];
const WS_MAX=WS_UP.length-1;
const WS_SALVAGE={kill:0.55,recycle:0.65,channel:3};
const wsInvOf=lv=>{let s=0;for(let i=1;i<=(lv||1);i++)s+=WS_UP[i].cost;return s;};
function wsYield(u){ /* 反应堆产量：位置基础 2~6/秒 × 等级倍率；回收引导中停产 */
  if(u.recT)return 0;
  const f=u.side?1-u.s/L:u.s/L;
  return (2+4*clamp((f-0.08)/0.84,0,1))*WS_UP[u.wlv||1].mul;
}
const BASE_HP=900, KILL_REWARD=0.35, QUEUE_MAX=5, INCOME_STEP=3, INCOME_MAX_LVL=10;
const EVOLVE_XP=300, EVOLVE_COST=500, FLAG_INCOME=3, FLAG_RANGE=90, FLAG_TIME=3;
/* 老兵晋升：按累计击杀升阶。晋升"不回血"——只是获得自动再生的能力；
   同时最大生命上限提高，所以血条比例会立刻变低，再靠再生慢慢补满。
   aura=地面光环粗细，blur=精灵外发光（贵，只给稀有的高军衔用，见 render.js drawUnit） */
const VET_RANKS=[null,
  {kills:3,tag:'⭐',name:'老兵',dmg:1.30,hp:1.22,regen:0.020,scale:1.07,glow:'#ffd76a',aura:3.2,blur:0},
  {kills:8,tag:'🔥',name:'精锐',dmg:1.62,hp:1.50,regen:0.034,scale:1.15,glow:'#ff7a34',aura:3.2,blur:7},
];
const VET_MAX=VET_RANKS.length-1;
const EMOTE_CD=4.5;   /* 秒，表情发送冷却 */
const incomeCost=lvl=>Math.round(100*Math.pow(1.5,lvl));
const DIFFS={easy:{mult:0.8},normal:{mult:1.0},hard:{mult:1.22}};
/* ---------------- 天气 ---------------- */
/* 天气＝战斗中随机降临的临时事件，持续一段时间后转晴（不再是整场固定） */
const WEATHERS={
  clear:{icon:'☀️',name:'晴朗',desc:''},
  snow:{icon:'❄️',name:'暴雪',speedMul:0.72,tint:'rgba(215,232,255,0.16)',part:'snow',desc:'全军移速 -28%'},
  rain:{icon:'🌧️',name:'暴雨',rangedMul:0.75,speedMul:0.9,tint:'rgba(50,70,130,0.14)',part:'rain',desc:'远程射程 -25%，移速 -10%'},
  storm:{icon:'🌪️',name:'沙暴',rangedMul:0.6,speedMul:0.85,tint:'rgba(190,150,80,0.18)',part:'storm',desc:'远程射程 -40%，移速 -15%'},
};
const WEATHER_KEYS=['clear','snow','rain','storm'];   /* 索引用于 PvP 快照，勿重排 */
const WEATHER_ROLL=['snow','snow','rain','rain','storm'];
const WEATHER_FIRST=[40,80];   /* 首次来袭 */
const WEATHER_DUR=[22,38];     /* 持续 */
const WEATHER_GAP=[55,100];    /* 转晴后到下一次 */
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
  RUN={diffKey,cmdr:(typeof selCmdr!=='undefined'?selCmdr:'marshal'),
       layer:0,map:genMap(),curNode:null,chosenIdx:0,pendingIdx:0,
       goldCarry:0,perks:[],unitMods:{},
       mods:{dmg:1,hp:1,speed:1,build:1,heal:1,income:0,gold:0,critAdd:0,xp0:0,turCd:1,turDmg:1}};
}
/* 杀戮尖塔式路网：9层×4列，3条随机步道决定节点与连边，同层只能走相连节点 */
function genMap(){
  const LAYERS=9, COLS=4, ps=['rush','turtle','economy','tricky'];
  void 0; /* 天气不再绑定节点，改为战斗中随机降临 */
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
  nd=nd||{t:'battle',p:'turtle'};
  const per=PERSONAS[nd.p||'turtle'];
  const dm=DIFFS[RUN?RUN.diffKey:'normal'].mult;
  const layer=RUN?RUN.layer:0;
  let scale=(1+layer*0.08)*dm;
  if(nd.t==='elite')scale*=1.22;
  const events=[];
  if(nd.t!=='boss'||Math.random()<0.5){
    const nEv=Math.random()<0.65?(Math.random()<0.35?2:1):0;
    const pool=['gold','meteor','bounty'];
    for(let i=0;i<nEv;i++)
      events.push({at:40+Math.random()*70,type:pool[(Math.random()*pool.length)|0],done:false});
  }
  return {node:nd,per,events,
    mapDef:genMapDef({noFork:false}),
    aiIncomeMul:per.mult*scale,
    hpMul:clamp(scale,0.75,2.0),
    dmgMul:clamp(1+(scale-1)*0.6,0.8,1.7),
    gobColor:(nd.t==='boss'||nd.t==='elite')?'purple':'red'};
}
