# 皇城远征 · AI 生图提示词手册

给对话式生图 AI（ChatGPT / Gemini 等）使用。每段提示词都是**自包含**的，可以单独复制；
但强烈建议按下面的顺序**在同一个对话里连续生成**，风格一致性会好很多。

---

## 使用要点（先看这三条）

1. **在同一个对话里连续生成，不要每张都新开对话。**
   已完成的「王国元帅」那张就是风格基准。生成下一张时，在提示词前面加一句：
   > 请保持与上一张完全相同的像素艺术风格、笔触粗细、明暗处理和调色方式。

2. **风格漂移时的纠正话术**（很有用）：
   > 这张的风格和第一张骑士立绘不一致，请重新生成：更强的像素颗粒感、更硬的色块边缘、更少的柔和渐变。

3. **不用自己做后处理。** 生成的原图直接丢进 `D:\wargame\assets\art\` 即可，
   像素化（降采样对齐网格 + 调色板量化 + 硬化边缘）由我用脚本统一处理成 160px / 96 色。
   你只需要保证**构图和风格对**。

---

## 通用风格前缀

每段提示词里都已经内嵌了，这里单列一份方便你纠正风格时引用：

```
16-bit pixel art, SNES-era JRPG style, crisp pixel edges, limited color palette,
bold clean outlines, flat cel shading, no anti-aliasing, no gradients, no blur,
high contrast, game asset quality
```

## 通用负面提示词

如果你的 AI 支持负面提示词，统一用这段；不支持的话，把它作为一句话附在提示词末尾
（"避免出现：…"）：

```
photorealistic, 3d render, blurry, smooth gradients, anti-aliased edges,
watercolor, oil painting, rough sketch, text, letters, watermark, signature, logo,
extra limbs, deformed hands, modern clothing, low contrast, muddy colors
```

---

# ① 王国元帅 · 指挥官立绘 ✅ 已完成

> 保留在此供将来重制参考。文件名：`cmdr_marshal.png`，正方形。

```
16-bit pixel art, SNES-era JRPG style, crisp pixel edges, limited color palette,
bold clean outlines, flat cel shading, no anti-aliasing, no gradients, no blur,
high contrast, game asset quality.

Bust portrait of a medieval knight commander, veteran human general,
polished steel plate armor with royal BLUE tabard and gold trim, white plume on helm,
helmet held under one arm revealing a stern weathered face with grey beard,
confident commanding pose, facing viewer three-quarter view,
warm torchlight from the left, deep blue heraldic banner background with subtle gold filigree,
centered composition, head and shoulders fill the frame, square image.

Avoid: photorealistic, 3d render, blurry, smooth gradients, anti-aliased edges,
watercolor, text, watermark, signature, extra limbs, modern clothing, muddy colors.
```

---

# ② 机械军团 · 指挥官立绘 ⬅️ 下一张

> 文件名：`cmdr_engineer.png`，**正方形**，尺寸越大越好（1024×1024 起）。
> 这张要和 ① 成对，务必先说"保持与上一张相同的风格"。

```
Keep exactly the same pixel art style, brush weight, shading and palette approach
as the previous knight commander portrait — this is its paired card.

16-bit pixel art, SNES-era JRPG style, crisp pixel edges, limited color palette,
bold clean outlines, flat cel shading, no anti-aliasing, no gradients, no blur,
high contrast, game asset quality.

Bust portrait of a cybernetic siege engineer commander, a hardened mechanized warlord.
Dark gunmetal armored exosuit with exposed hydraulics, rivets and heavy shoulder plating.
Glowing CYAN energy lines running through the suit's seams.
Battle-scarred helmet with a cracked visor, one glowing cyan optic lens,
lower face exposed showing a grim scarred jaw. Mechanical augmented right arm with
industrial claw fingers resting across the chest.
Facing viewer three-quarter view, cold cyan rim lighting from behind,
dark steel bulkhead backdrop with faint circuitry patterns and a hanging dark banner.

Same composition and framing as a paired character card: half-body three-quarter view,
head occupying the upper third, shoulders filling the frame width,
dark ornate border, patterned backdrop behind the character, square image.

Avoid: photorealistic, 3d render, blurry, smooth gradients, anti-aliased edges,
watercolor, text, watermark, signature, extra limbs, modern clothing, muddy colors.
```

---

# ③ 掠夺军阀 · 指挥官立绘（第三位指挥官，可先备着）

> 文件名：`cmdr_warlord.png`，正方形。对应尚未实现的哥布林部落指挥官。

```
Keep exactly the same pixel art style and framing as the previous two commander portraits
— this is the third card in the same set.

16-bit pixel art, SNES-era JRPG style, crisp pixel edges, limited color palette,
bold clean outlines, flat cel shading, no anti-aliasing, no gradients, no blur,
high contrast, game asset quality.

Bust portrait of a savage goblin warlord, a raiding chieftain.
Green-skinned, sharp fangs in a wicked grin, one eye scarred shut, pointed ears
with bone piercings. Crude scavenged armor of mismatched iron scraps and leather straps,
a tattered CRIMSON war cloak, a necklace of enemy teeth and stolen gold coins.
Holding a burning torch that lights his face from below with orange firelight.
Facing viewer three-quarter view, aggressive leaning-forward pose.
Backdrop of dark tribal banners, crude red war paint symbols and smoke.

Same composition and framing as a paired character card: half-body three-quarter view,
head occupying the upper third, shoulders filling the frame width,
dark ornate border, patterned backdrop behind the character, square image.

Avoid: photorealistic, 3d render, blurry, smooth gradients, anti-aliased edges,
watercolor, text, watermark, signature, extra limbs, cute cartoon style, muddy colors.
```

---

# ④ 主菜单背景

> 文件名：`bg_menu.png`，**横版 16:9**（1920×1080）。
> 注意：这张的构图要**中间留空**，因为羊皮纸菜单面板会盖在正中央。

```
Keep the same pixel art style as the commander portraits.

16-bit pixel art, SNES-era JRPG style, crisp pixel edges, limited color palette,
bold clean outlines, flat cel shading, no anti-aliasing, no gradients, no blur,
high contrast, game asset quality.

Epic wide landscape seen from a high three-quarter overhead angle.
A winding dirt road snakes from the bottom-left foreground up to the far horizon.
A BLUE-bannered stone castle guards the lower-left end of the road;
a distant RED-bannered enemy fortress sits on the upper-right hilltop.
Tiny marching armies dot the road between them. Green rolling hills,
scattered pine trees, boulders and small campfires along the roadside.
Dramatic sunset sky with warm orange and purple clouds.

IMPORTANT COMPOSITION: keep the CENTER of the image visually calm and uncluttered
(sky, empty hills or open fields) because a UI panel will be overlaid there.
Put all the interesting detail toward the left, right and bottom edges.
Wide cinematic 16:9 landscape, no close-up characters, no text.

Avoid: photorealistic, 3d render, blurry, smooth gradients, text, watermark,
busy cluttered center, close-up faces.
```

---

# ⑤ 胜利插图

> 文件名：`art_win.png`，正方形或 4:3。显示在胜利结算面板上方。

```
Keep the same pixel art style as the previous images.

16-bit pixel art, SNES-era JRPG style, crisp pixel edges, limited color palette,
bold clean outlines, flat cel shading, no anti-aliasing, no gradients, no blur,
high contrast, game asset quality.

Triumphant victory scene: a group of BLUE-bannered knights seen from behind and the side,
raising swords and blue banners in celebration before a captured enemy fortress
whose gate has been smashed open. Golden sunrise light streaming from behind the fortress,
sparks and floating embers in the air, a broken red enemy banner lying on the ground.
Heroic uplifting mood, medium-wide shot, figures small enough that no face is in close-up.

Avoid: photorealistic, 3d render, blurry, text, watermark, close-up faces, modern items.
```

---

# ⑥ 失败插图

> 文件名：`art_lose.png`，正方形或 4:3。显示在战败结算面板上方。

```
Keep the same pixel art style as the previous images.

16-bit pixel art, SNES-era JRPG style, crisp pixel edges, limited color palette,
bold clean outlines, flat cel shading, no anti-aliasing, no gradients, no blur,
high contrast, game asset quality.

Somber defeat scene: a shattered BLUE banner half-buried in mud in the foreground,
a broken sword stuck upright in the ground beside it, a dented helmet lying nearby.
In the background a ruined castle gate smolders with thin smoke rising.
Cold grey-blue rainy atmosphere, dim light, puddles reflecting the grey sky.
Melancholic defeated mood, no characters, no faces, medium-wide shot.

Avoid: photorealistic, 3d render, blurry, text, watermark, blood, gore, characters.
```

---

## 文件放置

全部放进 `D:\wargame\assets\art\`，**用原始生成图，不要自己压缩或裁剪**：

全部放进 `D:\wargame\assets\art\`。

| 文件名 | 内容 | 原图 | 游戏内 | 状态 |
|---|---|---|---|---|
| `cmdr_marshal.png` | 王国元帅立绘 | 1254² | 168² / 96色 / 19K | ✅ 已接入 |
| `cmdr_engineer.png` | 机械军团立绘 | 1254² | 168² / 96色 / 20K | ✅ 已接入 |
| `cmdr_warlord.png` | 掠夺军阀立绘 | 1254² | 168² / 96色 / 20K | ✅ 已实装（掠夺军阀，2026-07-28） |
| `bg_menu.png` | 主菜单背景 | 1672×941 | 854×481 / 192色 / 265K | ✅ 已接入（主菜单+PvP大厅） |
| `art_win.png` | 胜利插图 | 1448×1086 | 480×360 / 144色 / 120K | ✅ 已接入 |
| `art_lose.png` | 失败插图 | 1448×1086 | 480×360 / 144色 / 110K | ✅ 已接入 |

游戏内素材合计 **553K**。

## 素材流水线（需要重新导出时看这里）

AI 生成的原图（约 14MB）归档在 `assets/art/raw/`，**已 gitignore**，不进仓库也不参与运行——
它们只是重新导出的母版。要改尺寸/色数就改脚本里的 `JOBS` 表再跑一次：

```
原图 (1254²/1672×941)
  → LANCZOS 降采样到目标宽度
  → MEDIANCUT 调色板量化（关 dither，避免破坏像素块）
  → 存为调色板 PNG（比 24bit 小 4~5 倍）
```

关键点：**量化时必须关掉抖动（dither）**，否则会在色块内撒噪点，像素画的干净感就没了。

## 游戏内呈现

- **指挥官立绘**：选人卡片顶部 84×84（源图 168px = 2× 视网膜），`image-rendering:pixelated`；
  图加载失败时 `buildCmdrPick` 自动退回 emoji 图标，不会开天窗
- **菜单背景**：`#menu` / `#pvpov` 的 `background`，`center/cover` + 径向压暗暗角衬托羊皮纸面板
- **结算插图**：`#gameover` / `#runover` 面板顶部，`max-width:min(340px,74vw)` + `max-height:46vh`
  （横屏手机上限高很关键，否则会把标题和按钮挤出面板）。
  大图**不加** `pixelated`：显示尺寸与源图不是整数倍，硬采样会让像素块大小不均，平滑反而更好看
- **观战结算**：观众没有胜负立场，分出胜负时配胜利图，掉线中断则不配图

## 实测验收数据（供后续生成对照）

| 指标 | 六张实测 | 判定 |
|---|---|---|
| 原始尺寸 | 1254²～1672×941 | ✅ 够大 |
| 原始颜色数 | 14万～32万 | ⚠️ 正常，量化解决 |
| 84px 卡片可读性 | 元帅/机械/军阀均可一眼分辨 | ✅ 关键项通过 |
| 风格一致性 | 三张立绘同框不违和 | ✅ 连续生成的效果 |

**最重要的一条**：立绘缩到 84px 还认得出是谁。构图上让人物主体占满画面、避免过多细碎背景细节，就能达标。
