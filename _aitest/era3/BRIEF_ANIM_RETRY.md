# One final retry: remove structural drift from `mech_v5` idle

This is the single permitted retry for the animation-consistency test. Work autonomously
and finish the deliverable in this task. Do not ask follow-up questions.

## Scope

- `mech_v4` has independently passed. Do **not** modify any `mech_v4_*` file.
- Only repair `mech_v5_idle.png` and, when necessary, `build_strip.py`.
- Prefer repairing/compositing the existing raw grid. If its geometry cannot be repaired
  without obvious artifacts, one new `mech_v5_grid.png` generation is allowed.
- Do not modify game code or files outside `D:\wargame\_aitest\era3\`.

## Why the current v5 failed

The current strip passes file-format checks (6 × 192px cells, shared source palette,
15 opaque colours plus transparency, binary alpha, no clipping), but its validation metric
only anchors full-silhouette horizontal COM and the bottom row. That hides structural drift.

An independent audit measured the supposedly stable torso and legs against a medoid frame.
Their horizontal residual translations are approximately:

```
frame 1: 1px
frame 2: 8px
frame 3: 0px
frame 4: 4px
frame 5: 5px
frame 6: 0px
```

The main connected silhouette also varies by 10px on its left edge, 27px on its right edge,
and 36px in width. By comparison, `mech_v4` needs at most 1px residual translation and the
real `assets/mech/blue_mecha_idle.png` has zero horizontal stable-body drift. The problem is
not merely the drill extending: the torso and legs move horizontally too.

## Required repair

The chassis, torso and legs must be the same machine in exactly the same registered position
in all six frames. The safest method is to choose one canonical clean body (frame 3 or 6),
reuse that stable body in every frame, and retain animation only in deliberately isolated
parts:

- shield: at most a subtle shift, without moving the torso or feet;
- piston / pile-driver drill: may cycle;
- vent and indicator lights: may pulse.

Do not use full-silhouette COM as the only registration anchor because the moving shield and
drill bias it. Register from stable torso/leg landmarks or explicitly composite a frozen body.

## Acceptance checks

- 6 frames, each 192×192, horizontal strip 1152×192.
- Binary alpha; one shared palette derived from `mech_v5.png`; at most 16 RGBA values total.
- No opaque pixel touches a cell edge.
- Feet/bottom anchor identical.
- Stable torso/legs require no more than 2px horizontal or vertical residual translation in
  any frame. Print the per-frame residual shifts; do not report only COM drift.
- At game display size, flipping through frames must not make the body or feet shake.
- Preserve the selected v5 identity and silhouette; do not redesign it.

When finished, print the exact files modified and a concise metrics table. This is the final
retry, so do not leave the task at a proposal or intermediate draft.
