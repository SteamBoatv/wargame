# Task: animation-consistency test for two chosen mech designs

This is a **feasibility test**, not final art. The single question we are answering is:
**can frames of the same mech be generated consistently enough to use as a game sprite sheet?**

Work autonomously. Do not ask questions. Print the list of files you created when done.

## The two chosen designs

- `D:\wargame\_aitest\era3\mech_v4.png` — tracked heavy-artillery platform. Will be a **long-range** unit.
- `D:\wargame\_aitest\era3\mech_v5.png` — hunched shielded siege frame. Will be a **melee** unit.

Open both first. Every frame you generate must be recognisably **the same machine** as its source:
same proportions, same palette, same silhouette, same team colour.

## Why this is hard, and how to work around it

Generating frames one at a time makes the model drift — proportions wander and the body shifts
around the canvas. Two rules exist to fight that:

1. **Generate all frames of one animation inside a single image.** Ask for a grid of frames in
   one generation, not N separate generations. Consistency within one image is far higher.
   A 3-column x 2-row grid of 6 frames is a good shape; do not request a 6:1 strip, generators
   handle near-square canvases much better.
2. **Animate as little as possible.** These are heavy machines. The chassis must stay
   *completely still*. Only small parts may move.
   - `mech_v4` idle: barrel recoil/settle, exhaust puff, antenna sway, a blinking indicator light.
   - `mech_v5` idle: shield shifting slightly, piston/pile-driver cycling, vent glow pulsing.

## Deliverables

For **each** of the two designs, produce:

1. `mech_vN_grid.png` — the raw generated grid, exactly as the generator produced it (do not
   retouch). We need this to measure how much native drift there is.
2. `mech_vN_idle.png` — a finished **horizontal strip**: 6 frames, each frame square,
   strip width = 6 x strip height. This is the format the game engine reads
   (`cell = image height`, `frame i = source rect [i*cell, 0, cell, cell]`).

To build the strip from the grid, write a Python script (Pillow + numpy) that:

- slices the 6 cells out of the grid,
- **registers** them: for every frame compute the alpha silhouette, then translate the frame so
  that (a) the lowest opaque row is at an identical y in all frames, and (b) the silhouette's
  horizontal centre of mass is at an identical x in all frames. Registration is the whole point
  — the engine crops on a fixed grid, so a 3px drift is a visible jitter in game.
- quantises every frame against **one shared palette** taken from the source `mech_vN.png`
  (at most 16 colours), with **no dithering**,
- forces binary alpha (a pixel is either fully opaque or fully transparent),
- writes the strip.

Keep the script as `D:\wargame\_aitest\era3\build_strip.py` so the process is repeatable.

## Self-check before you finish

Print a small table with, for each finished strip: frame count, cell size, colour count, and the
per-frame bounding-box drift in pixels (min/max) **after** registration. If any drift exceeds
2px, fix the registration and rebuild rather than shipping it.

Write everything to `D:\wargame\_aitest\era3\`. Do not touch anything outside that folder.
