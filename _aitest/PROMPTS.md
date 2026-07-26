# AI 生图可行性测试 · 提示词

目的：**划出 AI 生图能用和不能用的边界**，而不是做出成品素材。
所以这四个测试是有意按"从易到难"排的，每个测一个独立变量。

生成后把 PNG 丢进 `D:\wargame\_aitest\`，然后打开 `_aitest\index.html`
（直接双击即可，把图拖进页面），会自动和真实素材同尺寸同帧率并排对比。

---

## 四个测试分别在测什么

| # | 测试 | 变量 | 我的预判 |
|---|---|---|---|
| A | 静态建筑 | 静态物件能不能用 | 🟢 能用 |
| B | 人形 4 帧行走 | **帧间一致性**（最难的一关） | 🔴 大概率不行 |
| C | 大型机械单体 | 大尺寸单体能不能用 | 🟡 有戏 |
| D | 机械 4 帧行走 | **刚性物体是否比人形容易保持一致** | ❓ 关键未知数 |

**B 和 D 是一组对照实验**：同样是 4 帧行走，一个人形一个机械。
如果 D 明显好于 B，就说明"机械化单位"是 AI 生图的可行区间——这直接决定第三时代要不要走机械路线。

---

## 通用要求（已内嵌进每个提示词）

- **透明背景**——没有透明通道的话后处理抠图会毁掉边缘
- **限定调色板**——上次立绘实测 14~21 万色，那是"看起来像像素画的插画"，不是像素画
- **硬边、无抗锯齿**——柔边缩到 68px 会糊成色斑
- **主体占满画面**——单位在游戏里整个人只有 68px 高，留白就是浪费分辨率
- **单一高饱和阵营色**——我们靠色相旋转做红蓝双方，阵营色必须集中

---

# 测试 A · 静态建筑（防御塔）

> 文件名：`test_a_tower.png`，**正方形**。
> 视角要求对应 Tiny Swords 的俯视 3/4 视角。
> 这个如果成了，可以直接替换游戏里还是 emoji 占位的 🗼 激光塔。

```
Pixel art game asset, single object on a fully TRANSPARENT background.

A fantasy defense tower: stone base, wooden platform, blue conical roof with a small
blue banner on top, an arrow slit facing the viewer.

Style: 16-bit pixel art, chunky readable pixels, hard aliased edges, NO anti-aliasing,
NO soft gradients, NO glow, NO blur. Strictly limited palette of about 24 flat colors,
bold dark outline around the whole silhouette.
Viewpoint: three-quarter top-down view, as seen in a top-down strategy game
(camera looking down at roughly 50 degrees), NOT a side view, NOT isometric-flat.
Composition: the tower fills the entire frame edge to edge, no empty margin,
no ground, no shadow, no scenery, no text.
The BLUE roof and banner must be the single dominant saturated color so the asset
can be recolored to red by hue rotation; keep stone and wood desaturated grey/brown.

Transparent background (alpha channel), square image.
```

---

# 测试 B · 人形 4 帧行走序列 ⭐ 最关键的一关

> 文件名：`test_b_walk4.png`，**横向 4:1 长图**（如 2048×512）。
> 这一张决定"AI 能不能做动画素材"。

```
Pixel art sprite sheet on a fully TRANSPARENT background.

A single horizontal row of exactly 4 frames showing one walk cycle of the SAME character:
a golden-armored fantasy knight holding a sword, seen from a three-quarter top-down angle,
facing to the RIGHT.

CRITICAL consistency requirements — this is a sprite sheet, not 4 separate drawings:
- It must be the exact same character in all 4 frames: same height, same body proportions,
  same armor details, same colors, same helmet shape.
- All 4 frames must be evenly spaced in one horizontal row, each frame the same width.
- The character must be the same size in every frame and centered in its own frame.
- The feet must rest on the SAME horizontal baseline in all 4 frames.
- Only the legs, arms and cape change between frames (contact - passing - contact - passing).

Style: 16-bit pixel art, chunky readable pixels, hard aliased edges, NO anti-aliasing,
NO soft gradients, NO glow, NO blur. Strictly limited palette of about 24 flat colors,
bold dark outline around the silhouette.
The GOLD armor must be the single dominant saturated color so the sprite can be recolored
by hue rotation; keep skin and leather desaturated.

Transparent background between and around all frames. No ground, no shadow, no text,
no frame borders, no numbering. Wide image, 4:1 aspect ratio.
```

---

# 测试 C · 大型机械单体（静止）

> 文件名：`test_c_titan.png`，**正方形**。
> 视角对应 Foozle 机械素材的侧视。游戏里机械单位画到 110px，比人形大得多。

```
Pixel art game asset, single mechanical unit on a fully TRANSPARENT background.

A heavy bipedal war walker (mech titan): thick armored legs, boxy torso, a large
shoulder-mounted cannon, exposed hydraulic pistons, cyan glowing energy lines in the seams.
Standing idle pose, seen from a pure SIDE VIEW, facing RIGHT.

Style: 16-bit pixel art, chunky readable pixels, hard aliased edges, NO anti-aliasing,
NO soft gradients, NO bloom, NO blur. Strictly limited palette of about 28 flat colors,
bold dark outline around the whole silhouette.
Composition: the mech fills the entire frame edge to edge, no empty margin,
no ground, no shadow, no background scenery, no text.
The CYAN energy lines must be the single dominant saturated color so the asset can be
recolored to red/orange by hue rotation; keep the armor desaturated gunmetal grey.

Transparent background (alpha channel), square image.
```

---

# 测试 D · 机械 4 帧行走序列（与 B 对照）

> 文件名：`test_d_mechwalk4.png`，**横向 4:1 长图**。
> 和 B 唯一的区别是主体从人形换成机械——用来验证"刚性结构是否更容易保持一致"。

```
Pixel art sprite sheet on a fully TRANSPARENT background.

A single horizontal row of exactly 4 frames showing one walk cycle of the SAME mech:
a heavy bipedal war walker with thick armored legs, boxy torso, shoulder cannon and
cyan glowing seams, seen from a pure SIDE VIEW, facing RIGHT.

CRITICAL consistency requirements — this is a sprite sheet, not 4 separate drawings:
- It must be the exact same mech in all 4 frames: same height, same proportions,
  same panel details, same colors, same cannon shape.
- All 4 frames must be evenly spaced in one horizontal row, each frame the same width.
- The mech must be the same size in every frame and centered in its own frame.
- The feet must rest on the SAME horizontal baseline in all 4 frames.
- Only the leg positions and the torso bob change between frames.

Style: 16-bit pixel art, chunky readable pixels, hard aliased edges, NO anti-aliasing,
NO soft gradients, NO bloom, NO blur. Strictly limited palette of about 28 flat colors,
bold dark outline around the silhouette.
The CYAN glowing seams must be the single dominant saturated color for hue-rotation
recoloring; keep the armor desaturated gunmetal grey.

Transparent background between and around all frames. No ground, no shadow, no text,
no frame borders, no numbering. Wide image, 4:1 aspect ratio.
```

---

## 生成时的注意事项

1. **四张可以分开生成**，不需要在同一个对话里保持风格——这次测的是"能不能用"，不是"风格统不统一"。

2. **如果它给了不透明背景**，追加一句：
   > 背景必须是完全透明的 alpha 通道，不要白色或任何纯色背景。

3. **如果序列帧画成了 4 个不同的角色**（很可能发生），追加：
   > 这是一张精灵图集，四帧必须是同一个角色的连续动作，身高、比例、盔甲细节、配色完全一致，只有腿和手臂的姿势不同。

4. **别自己裁剪或压缩**，原图直接给我，后处理管线我们已经有了。

---

## 我会怎么验收

测试页 `_aitest/index.html` 会自动做这几件事：

- 按目标尺寸降采样 + 调色板量化（可调 16/24/32/48 色），实时看效果
- **和真实的 Tiny Swords 剑士、Foozle 机甲并排，同尺寸、同 10fps 帧率播放**——
  这是最关键的判据，脱离基准谈"好不好看"没有意义
- 切帧预览：一眼看出四帧是不是同一个角色
- 色相旋转红/蓝双方，验证阵营换色可行性
- 统计原图颜色数、量化后颜色数、边缘半透明像素占比（抠图质量）
