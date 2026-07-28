# Task: generate pixel-art sprite candidates for a boss-class mech

You are generating **candidate art for evaluation**, not final assets. Work autonomously and
do not ask follow-up questions. When done, print a plain list of every file you created.

## Context

`D:\wargame` is a mobile-first browser lane-battle game in pixel art. One faction is a
mechanized legion whose sprites come from the Foozle "Sci-Fi Lab" CC0 packs. We are adding a
third era whose centerpiece is a single **limited hero unit**: a boss-class mech. Every existing
mech sheet is already used by another unit, so this is the one gap we cannot fill from stock art.

## Study the reference FIRST (mandatory)

Before generating anything, open and look at these existing in-game sprites so your output
matches their style:

- `D:\wargame\assets\mech\blue_mecha_idle.png` — 640x80, 8 frames of 80x80. This is the current
  heaviest mech ("Mecha Boss" in the source pack). Actual pixel content is only ~61px tall
  inside each 80px cell, bottom-aligned.
- `D:\wargame\assets\mech\blue_droid03_idle.png` — 192x48, 4 frames of 48x48.
- `D:\wargame\assets\mech\red_mecha_idle.png` — the same mech in the enemy team color.

Note how few colors they use, how hard the outlines are, and that there is **no anti-aliasing**:
every pixel is fully opaque or fully transparent.

## What to generate

**Six distinct variants** of a single **idle pose**, side view, **facing right**. Do not attempt
animation frames yet — we are choosing a silhouette and a style first.

Design intent: this unit must read instantly as "the most dangerous thing on the field" when
drawn about 150 pixels tall on a phone screen, next to 60-90px infantry.

Vary the variants meaningfully — e.g. bipedal walker, quad/spider stance, hover tank, heavy
artillery platform, shielded siege frame, insectoid. Do not produce six versions of one idea.

## Hard constraints (these decide pass/fail)

1. **True pixel art.** Blocky, aliased edges. No gradients, no soft shadows, no glow blur,
   no anti-aliasing. Every edge pixel fully opaque or fully transparent.
2. **Bold dark outline** around the whole silhouette, roughly 2 source-pixels thick.
3. **At most 16 distinct colors** in the whole image, including the outline.
4. **High contrast between adjacent shapes** — the sprite must stay readable when scaled down.
5. **Transparent background.** If your generator cannot do alpha directly, render on a flat
   pure magenta `#FF00FF` field and then run
   `C:\Users\admin\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py` on it.
6. **Cool steel / blue-grey body** with a small number of warm accent lights (amber or orange)
   so it belongs to the same family as the reference sprites.
7. Square canvas, and the mech should fill most of the frame with its feet near the bottom edge.

## Output

Save every candidate into `D:\wargame\_aitest\era3\` using exactly this naming:

```
mech_v1.png  mech_v2.png  mech_v3.png  mech_v4.png  mech_v5.png  mech_v6.png
```

If a generated file lands somewhere else first (e.g. under `$CODEX_HOME/generated_images/`),
copy it to the path above and keep the copy.

Then write `D:\wargame\_aitest\era3\NOTES.md` containing, per variant: one line describing the
concept, the actual pixel dimensions, and whether the background ended up truly transparent.

Finally print the list of created files. Do not modify any file outside `D:\wargame\_aitest\era3\`.
