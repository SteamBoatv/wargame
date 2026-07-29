# 🏰 皇城远征 · 皇城对决

> 像素风塔攻 Roguelike + WebRTC P2P 好友对战。零构建、零依赖安装，打开网页即玩。

一款纯前端的 Canvas 2D 即时战术游戏：金币自动累积 → 生产士兵 → 沿 S 形山路自动进军 → 摧毁对方城堡。
单人模式是杀戮尖塔式的分叉远征地图，每站敌人性格各异；多人模式是浏览器直连的 P2P 对战，还支持第三人观战。

---

## 目录

- [玩法概览](#玩法概览)
- [启动方式](#启动方式)
- [技术架构](#技术架构)
- [模块详解](#模块详解)
- [联机协议](#联机协议)
- [依赖](#依赖)
- [目录结构](#目录结构)
- [开发约定](#开发约定)
- [素材版权](#素材版权)

---

## 玩法概览

### 核心循环

金币按 `income/秒` 自动累积 → 在底部兵种栏花钱排产（队列上限 5）→ 士兵造好后自动沿路推进 →
接敌自动交战 → 击杀敌人返还其造价的一部分作为金币与进化经验 → 攒够经验 + 500 金可进化到 **时代 II**，
解锁更强的兵种。任意一方城堡血量（`BASE_HP = 900`）归零即分出胜负。

### 兵种克制环

| 职业 | 克制 | 说明 |
| --- | --- | --- |
| 🗡️ 剑士 `inf` | 枪兵 ×1.5、建筑 ×1.6 | 廉价前排 |
| 🔱 长枪兵 `spear` | 重甲 ×1.6、爆破 ×1.6、攻城 ×1.6 | 反坦克 |
| 🛡️ 盾卫 `tank` | — | 受远程伤害减半 |
| 🏹 弓手 `ranged` | 步兵 ×1.5、修士 ×1.5 | 远程输出 |
| ✝️ 修士 `heal` | — | 不攻击，治疗射程内最残血的友军 |
| 🚜 攻城/机甲 `siege` | 建筑 ×2.5、重甲 ×1.3 | 拆家 |
| 💣 滚桶兵 `bomb` | 建筑 ×1.8 | 接敌自爆，范围伤害 |

克制关系定义在 `js/data.js` 的 `COUNTER` 表，暴击基础概率 10%（伤害 ×2）。

### 指挥官系统

开局二选一，决定兵种池、经济模式与专属技能：

| 指挥官 | 经济 | 兵种池 | 专属部署 |
| --- | --- | --- | --- |
| ⚖️ **王国元帅** | 基础 +8/秒，可花钱**挖矿**升级（10 级，成本 `100 × 1.5^lvl`） | 剑士/长枪/弓手/盾卫/修士 | 🪂 **空降守备队** — 限时 25 秒、不推进的三人小队，随时代变强 |
| 🏗️ **机械军团** | 基础 +6/秒，无挖矿；靠**前线反应堆**产金（越靠近敌方产量越高，2~6/秒） | 改造兵/浮游炮/工程重车（科幻机械单位） | 🎯 **火力覆盖** — 圈定圆形区域，3 轮炮击每轮间隔 5 秒；🚧 能量路障、🗼 激光塔、🏭 反应堆 |

火力覆盖有意保留 1.3 秒预警窗口（红圈可见），且**打不到城堡**——否则会退化成"隔空拆家"的必胜手段。
轮次间隔（5 秒）比行军速度长：站着打的战线会被三轮全吃，行军中的部队能走出去，这是它的博弈点。

### 战场机制

- **哨站占领** 🚩 — 路上有 2 个中立哨站，单方部队在附近停留 3 秒即可占领，每个 +3 金/秒
- **老兵晋升** ⭐🔥 — 累计 3 杀升「老兵」、8 杀升「精锐」，获得伤害/上限/再生加成。
  晋升**不回血**，只抬上限，所以血条比例当场下降，靠新获得的再生慢慢补满
- **随机天气** — 开局 40~80 秒后随机降临（暴雪/暴雨/沙暴），持续 22~38 秒转晴，循环。影响全军移速与远程射程
- **中立事件** — 💰 金币空投（先到先得）、☄️ 陨石雨（双方阵线同时受创）、💰 双倍赏金（30 秒击杀奖励翻倍）
- **地形** — 每关随机生成 S 形路径，含**隘口**（道路收窄）与**岔路**（双车道分离，近战无法跨路攻击）

### 远征模式（Roguelike）

9 层 × 4 列的杀戮尖塔式路网，由 3 条随机步道决定节点与连边。节点类型：

`⚔️ 战斗` · `⭐ 精英`（属性 ×1.22）· `🎁 宝箱` · `❓ 奇遇` · `🏕️ 训练营` · `👹 魔王要塞`（终点）

胜利后三选一收集强化（`PERKS` 通用强化 + `PERKS_UNIT_*` 兵种特训，特训卡池随指挥官切换）。
AI 有 5 种性格模板（`PERSONAS`）：猪突之营 / 龟缩堡垒 / 商人领主 / 诡诈巢穴 / 魔王要塞，
分别在出兵池、决策节奏、经济倾向、是否进化上有差异。

---

## 启动方式

### 单人模式（最简）

需要一个 HTTP 服务器——`file://` 协议下联机功能不可用（ES module 动态 `import()` 受同源策略限制），
但单人远征可以正常玩。

```bash
# 任选其一，在项目根目录执行

python -m http.server 8080          # Python 3
npx serve .                          # Node.js
php -S localhost:8080                # PHP
```

然后浏览器打开 <http://localhost:8080>。

### 联机对战

联机走 WebRTC 打洞，**必须通过 `http://` 或 `https://` 访问**（见 `js/net.js:24` 的 `netSupported()`）。
局域网内用 `python -m http.server` 即可，跨网络需要公网部署。

1. 主机点击「⚔️ 好友对战（P2P）」创建房间，得到 6 位房间码
2. 复制邀请链接 `?pvp=<code>` 发给好友，对方打开即自动进房
3. 双方在大厅内**暗牌**选择指挥官并确认，全部锁定后互相揭晓
4. 房主点「⚔️ 开始对战」开战

**观战**：主机另有「👁️ 复制观战链接」`?watch=<code>`，观众进入后是上帝视角
（双方经济、进化进度全开），可 🔄 切换视角，只能发表情不能干预对局。

### 部署

纯静态站点，仓库根目录已有 `.nojekyll`（禁用 GitHub Pages 的 Jekyll 处理，保证 `js/`、`assets/` 原样服务）。
直接把仓库推到 GitHub Pages / Netlify / Vercel / 任意静态托管即可，**无需构建步骤**。

---

## 技术架构

### 设计取向

这个项目刻意选择了**零构建的全局脚本**架构：没有 `package.json`、没有打包器、没有模块系统
（唯一的 ES module 是动态 `import()` 加载的 Trystero 库）。9 个 JS 文件按 `index.html` 中的顺序加载，
共享全局作用域，靠命名约定而非 `import`/`export` 组织依赖。

代价是没有静态检查和树摇；收益是**改一行刷新即见效**，零环境配置，任何静态服务器都能跑。
对这个体量（业务代码 3441 行 / 138 KB）而言这是合理的取舍。

### 加载顺序即依赖顺序

`index.html:139-148` 中的 `<script>` 顺序不能随意调整——后面的文件在**顶层**就使用前面文件的产物：

```
core.js         工具函数（$、clamp、rand、TAU、ASSETS）
  ↓
data.js         纯数值配置：UNITS / COUNTER / COMMANDERS / PLACEABLES / PERSONAS / WEATHERS
  ↓
world.js        地图生成，末尾直接调用 buildWorld(null) 初始化 PATH / BASE0 / BASE1
  ↓
camera.js       顶层读取 BASE0 初始化 cam，绑定 canvas 指针事件
  ↓
audio_assets.js IIFE 立即启动所有图片/音频的异步加载
  ↓
game.js         战斗模拟：update() 及其全部子系统
  ↓
render.js       Canvas 绘制：draw() 及其全部子函数
  ↓
ui.js           HUD 刷新、DOM 事件绑定、Roguelike 流程；顶层调用 buildCmdrPick()
  ↓
net.js          P2P 联机与观战
  ↓
main.js         主循环 frame()，末尾 newGame(null) + 解析 URL 参数启动
```

### 主循环

`js/main.js:18-40` 是唯一的 `requestAnimationFrame` 循环，每帧固定四步：

```js
function frame(ts){
  requestAnimationFrame(frame);
  let dt = (ts-last)/1000;  last = ts;
  if(dt > 0.05) dt = 0.05;              // 掉帧保护：单帧最多推进 50ms

  if(mode==='play' && !paused && !G.over){
    if(G.pvp && NET && !NET.isHost)  netGuestTick(dt);   // 客机/观众：只插值，不模拟
    else if(G.pvp){
      const sp = G.pvpSpeed||1, n = Math.ceil(sp);       // 主机：按协商倍速分步模拟
      for(let i=0; i<n && !G.over; i++) update(dt*sp/n);
    }else{
      for(let i=0; i<gameSpeed && !G.over; i++) update(dt);
    }
  }
  if(followMode && ...) followCam(dt*gameSpeed);
  draw();
  tickEmoteCd(dt);      // 表情冷却走真实时间，不受暂停/倍速影响
  refreshHUD();
}
```

**倍速分步模拟**是关键细节：高倍速下若一次性推进 `dt*sp`，单位可能一帧穿过整个攻击距离导致判定失效，
所以拆成 `ceil(sp)` 个小步。

### 坐标系统

战场是一条**一维路径**上的推进，而非自由 2D 移动：

- 每个单位只有两个位置量：`u.s`（路径弧长，`0` 到 `L`）与 `u.off`（横向偏移，5 条车道 `LANE_SLOTS`）
- `pathPos(s)` 把弧长映射回世界坐标 `(x, y)`，同时返回切向量 `(tx,ty)`、法向量 `(nx,ny)`、
  隘口收窄系数 `wf` 与岔路分离度 `sep`
- `unitPos(u)` 组合两者得到最终屏幕位置：`p.x + p.nx * (off*wf + sign(off)*sep/2)`

路径本身是 Catmull-Rom 样条（`buildPath`），按固定弧长 `STEP=6` 重采样成查找表，
所以 `s` 的推进速度与真实距离成正比，不受曲率影响。

**这个设计让一维碰撞/索敌变得极简**：判断能否攻击只需 `Math.abs(e.s - u.s) <= range`，
判断是否被友军挡路只需前方 20 单位内有无同阵营单位。

### 渲染管线

`js/render.js:498` 的 `draw()`：

1. 清屏 → 应用镜头变换（含 `G.shake` 屏震）
2. 绘制离屏预渲染的地面 `ground` canvas（在 `paintGround()` 中一次性画好道路/草地/贴花，道路按 1/4 分辨率像素化）
3. **视锥剔除 + Y 排序**：把可见的装饰物/城堡/哨站/单位收进 `spr` 数组，按 `y` 升序排序后统一绘制，实现伪 2.5D 遮挡
4. 打击区域贴花画在单位**之前**（地面贴花语义）
5. 弹道、空投、爆炸、飘字
6. 切回屏幕空间坐标：天气粒子、小地图、横幅、闪光

所有 `ctx.imageSmoothingEnabled = false`，保持像素风硬边。

---

## 模块详解

### `js/data.js` — 数值配置（216 行）

**唯一的纯数据文件**，改平衡性只需动这里。包含 `UNITS`（22 个单位定义）、`COUNTER`（克制表）、
`COMMANDERS`、`PLACEABLES`、`STRIKE`、`VET_RANKS`、`WEATHERS`、`PERSONAS`、`EMOTES`，
以及远征地图生成 `genMap()` 与关卡参数计算 `makeStage()`。

⚠️ 两个**索引即协议**的常量，只能追加不能重排——索引会写进 PvP 快照：
- `WEATHER_KEYS`（`js/data.js:111`）
- `PROJ_KINDS`（`js/net.js:8`）

同理 `TYPE_KEYS = Object.keys(UNITS)`（`js/net.js:6`）依赖 `UNITS` 的**键序**，
在中间插入新单位会让新旧版本客户端错位。

### `js/world.js` — 战场生成（196 行）

`genMapDef()` 生成一张战场定义（控制点 / 岔路 / 隘口 / 哨站位置）→ `buildPath()` 转成弧长查找表 →
`genDecos()` 撒装饰物（避开道路与基地）→ `paintGround()` 把地面烘焙到离屏 canvas。

`mirrorDef()`（在 `js/net.js:363`）能把一张地图定义旋转 180°，这是客机镜像的基础。

### `js/game.js` — 战斗模拟（749 行）

`update(dt)` 是权威模拟入口，依次推进：经济 → 生产队列 → AI 决策 → 单位 → 弹道 → 哨站 →
火力覆盖 → 老兵再生 → 冷却 → 天气 → 事件 → 空投 → 飘字。

`updateUnits()` 内的索敌是 O(n²)，但每帧先缓存了 `u._lat`（横向位置）避免重复调用 `pathPos`。
近战（`range <= 50`）会跳过横向距离 > 46 的目标，实现"不能隔着岔路打"。

### `js/render.js` — 绘制（605 行）

单位精灵有三套绘制路径：**机械军团**（`drawMechUnit`，按 `mpx` 每源像素固定屏幕尺寸缩放并底部对齐）、
**哥布林**（多行动画表，`GOB_META` 定义行号与帧数）、**Tiny Swords**（单行动画表，帧数 = 宽/高）。
任一素材缺失都会回退到 emoji 绘制。

### `js/ui.js` — HUD 与流程（597 行）

`refreshHUD()` 每帧调用，用 `qSig` / `lastMoneyTxt` / `lastIncomeLvlShown` 做脏检查，
避免每帧重写 DOM。同时承载 Roguelike 全流程（地图渲染、SVG 连线、强化卡池、结算）。

### `js/net.js` — 联机（760 行，见下节）

---

## 联机协议

### 架构：主机权威 + 全镜像

一方是 **host**（跑完整 `update()` 模拟），另一方是 **guest**（只跑 `netGuestTick()` 插值），
第三方可作为 **spectator** 加入。

**镜像原则**是这套设计的核心：客机把收到的一切按 180° 旋转存储——

```
s    → L - s          off  → -off
side → 1 - side       x,y  → WORLD_W - x, WORLD_H - y
ang  → ang + π
```

于是**客机的"自己"永远是下方的蓝方 side 0**，全部现有渲染/HUD 代码无需感知联机的存在。
观众则多一个 `specMirror` 开关，决定要不要翻转，两种模式共用同一段代码（`netApplySnap`）。

### 消息通道

Trystero 的 `makeAction` 建立 5 条逻辑通道：

| 通道 | 方向 | 内容 |
| --- | --- | --- |
| `c` cmd | guest → host | 购买 `{a:'b'}` / 挖矿 `{a:'i'}` / 进化 `{a:'e'}` / 部署 `{a:'p'}` |
| `s` snap | host → all | 10 Hz 全量状态快照（数组编码压缩） |
| `f` fx | host → all | 特效与提示中继（占领/进化/天气/空投） |
| `m` meta | 双向 | 握手 `iam` / 满员 `full` / 选人 `cmdrLock` / 开局 `start` / 结算 `end` / 倍速协商 `spdReq`·`spdRes` |
| `g` emote | 双向 | 快速表情索引 |

快照全部用**数组而非对象**编码以压缩体积，例如单位是
`[uid, typeIndex, side, s, off, hp, max, flags]`，`flags` 位掩码：`1=移动 2=老兵 4=死亡 8=攻击 16=精锐`。

### 席位管理

为防第三者乱入，握手是**角色化**的（`js/net.js:37-40`）：

- `NET.peer` 仅指"我的对手"——房主认第一个 guest，客机只认 host，观众永远为 `null`
- `NET.hostId` 所有人都记录，观众靠它判断房主是否掉线
- `NET.roles` peer id → 角色，用于校验每条入站消息的来源身份
- 房间满员时房主向多余的 guest 发 `full`，对方退房并提示改用观战链接

观众加入后房主会**定向补发** `start` 消息（仅限对局仍在进行），所以中途进来也能看。
观众数 ≥ 3 时快照对观众降频到 5 Hz（插值渲染够用），避免吃掉房主上行带宽。

### 倍速协商

PvP 不能单方面改倍速。申请 +0.25/次，对方 12 秒内不回应不算拒绝；被明确拒绝则 1 分钟冷却。
主机按协商后的 `G.pvpSpeed` 分步模拟并写进快照，客机跟随。

---

## 依赖

### 运行时依赖：1 个（已内联）

| 依赖 | 版本/形态 | 用途 |
| --- | --- | --- |
| [Trystero](https://github.com/dmotz/trystero) | `js/lib/trystero-mqtt.min.js`（MQTT 策略预打包，370 KB） | WebRTC P2P 房间与信令 |

**没有 `package.json`，无需 `npm install`。** Trystero 以预构建的 ES module 形式直接放在仓库里，
由 `js/net.js:13-17` 的 `netLib()` 在首次联机时动态 `import()`（所以单人模式完全不加载它）。

Trystero MQTT 策略用公共 MQTT broker（emqx.io / hivemq.com / mosquitto.org）交换 WebRTC offer/answer，
STUN 用 `stun.cloudflare.com:3478` 打洞。**没有自建服务器，也没有 TURN 中继**——
少数网络（对称 NAT 的公司网、部分手机热点）会打洞失败，这是已知限制，页面上有说明。

### 浏览器 API 依赖

`Canvas 2D` · `WebRTC`（联机）· `Web Audio API`（合成音效）· `Pointer Events`（统一鼠标/触屏）·
`Screen Wake Lock`（手机对战防息屏）· `localStorage`（音量记忆）· `Clipboard API`（复制邀请链接）

后四项全部有 `try/catch` 或特性检测回退，缺失不影响核心玩法。

### 开发依赖：0 个

没有构建、没有 lint、没有测试框架、没有 CI。改代码 → 刷新浏览器就是全部工作流。

---

## 目录结构

```
.
├── index.html              # 唯一入口：DOM 骨架 + 9 个 <script> 顺序加载
├── .nojekyll               # GitHub Pages 禁用 Jekyll
├── ART_PROMPTS.md          # AI 生图提示词手册（指挥官立绘/菜单背景/胜负插图）
├── css/
│   └── style.css           # 全部样式，含像素风九宫格边框与移动端断点
├── js/
│   ├── core.js             # 工具函数
│   ├── data.js             # ★ 数值配置（改平衡只动这里）
│   ├── world.js            # 战场生成与地面烘焙
│   ├── camera.js           # 镜头变换与指针输入
│   ├── audio_assets.js     # 素材加载与音效
│   ├── game.js             # ★ 战斗模拟
│   ├── render.js           # ★ Canvas 绘制
│   ├── ui.js               # HUD 与 Roguelike 流程
│   ├── net.js              # ★ P2P 联机与观战
│   ├── main.js             # 主循环与启动
│   └── lib/
│       └── trystero-mqtt.min.js
└── assets/
    ├── CREDITS.txt         # 素材出处与许可
    ├── ts/                 # Tiny Swords 中世纪单位（4 种队伍色）
    ├── mech/               # Foozle 科幻机械单位（蓝/红双色）+ meta.json 几何元数据
    ├── img/                # 地面贴图、爆炸
    ├── art/                # AI 生成美术（指挥官立绘/菜单背景/胜负插图）
    └── audio/              # 音效与 BGM
```

`assets/mech/meta.json` 记录每个机械图集的格边长 `cell` 与格内实际内容高度 `ch`
（内容贴格底对齐）。这份数据在 `js/data.js:47` 的 `MECH_META` 中有一份镜像，
**换素材时两处必须同步**，否则血条和按钮图标会错位。

---

## 开发约定

- **`js/data.js` 是数值的唯一来源**。调平衡、加单位、改指挥官都从这里开始
- **`WEATHER_KEYS` / `PROJ_KINDS` / `UNITS` 的键序是网络协议的一部分**，只能追加不能重排
- **新增战斗逻辑要考虑 PvP**：`update()` 只在主机跑，客机靠快照。任何不进快照的状态在客机上都不存在
- **素材缺失必须有回退**。现有代码里图片没加载完会退回 emoji 绘制、音效没加载会退回 Web Audio 合成音
- **移动端是一等公民**：所有按钮用 `pointerdown` 而非 `click`（减少 300ms 延迟），
  触控目标在 `@media (pointer:coarse)` 下加大，`env(safe-area-inset-*)` 处理刘海屏
- 提交信息格式：`<类型>：<中文描述>`

---

## 素材版权

全部素材为免费许可，详见 `assets/CREDITS.txt`：

- **Tiny Swords** by Pixel Frog — 个人与商业免费使用
- **Sci-Fi Lab 系列 / Spire Tower Pack** by [Foozle](https://foozlecc.itch.io/) — CC0（队伍色由原图色相偏移生成）
- **MiniWorldSprites** by Shade · **Explosion Set 1** by M484 Games — CC0
- **Medieval: Battle** BGM by RandomMind · **RPG Sound Pack** / **Battle Sound Effects** by artisticdude — CC0
- `assets/art/*` — 本项目 AI 生成，提示词见 `ART_PROMPTS.md`
