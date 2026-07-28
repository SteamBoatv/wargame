from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "mech_v5.png"
STRIP_PATH = ROOT / "mech_v5_rigged_idle.png"
PREVIEW_PATH = ROOT / "mech_v5_rigged_preview.png"
PREVIEW_80_PATH = ROOT / "mech_v5_rigged_preview_80px.png"
AUDIT_PATH = ROOT / "audit.json"
LAYERS_DIR = ROOT / "layers"

CELL = 192
FRAME_COUNT = 6
SHIELD_PIVOT_Y = 68
SHIELD_BOTTOM_Y = 185
# Enhanced idle profile: 50% more shield travel than the accepted base rig,
# with a restrained drill follow-through so the motion remains an idle loop.
SHIELD_BOTTOM_DX = (0, -3, -6, -3, 0, 3)
DRILL_EXTENSION_DX = (0, 2, 6, 3, 0, -2)

OUTLINE = (8, 13, 30, 255)
DARK_JOINT = (53, 58, 67, 255)
MID_JOINT = (91, 99, 110, 255)
LIGHT_JOINT = (174, 190, 205, 255)

SHIELD_POLYGON = (
    (96, 55),
    (118, 55),
    (124, 66),
    (140, 70),
    (142, 78),
    (153, 78),
    (159, 86),
    (161, 98),
    (163, 105),
    (163, 174),
    (158, 185),
    (109, 185),
    (104, 180),
    (103, 165),
    (101, 147),
    (100, 128),
    (98, 111),
    (96, 92),
)

DRILL_POLYGON = (
    (157, 101),
    (166, 103),
    (177, 110),
    (182, 117),
    (182, 124),
    (176, 129),
    (160, 132),
    (156, 126),
)

BEHIND_SHIELD_POLYGON = (
    (92, 67),
    (118, 67),
    (135, 82),
    (139, 109),
    (133, 137),
    (124, 158),
    (112, 178),
    (96, 178),
    (92, 154),
    (91, 128),
    (91, 94),
)


def polygon_mask(points: Iterable[tuple[int, int]]) -> np.ndarray:
    image = Image.new("1", (CELL, CELL), 0)
    ImageDraw.Draw(image).polygon(tuple(points), fill=1)
    return np.asarray(image, dtype=bool)


def alpha_bbox(image: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(image[..., 3] == 255)
    if not len(xs):
        raise RuntimeError("image has no opaque pixels")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def extract_layer(source: np.ndarray, mask: np.ndarray) -> np.ndarray:
    layer = np.zeros_like(source)
    layer[mask] = source[mask]
    return layer


def nearest_source_fill(
    image: np.ndarray, target_mask: np.ndarray, seed_mask: np.ndarray
) -> np.ndarray:
    result = image.copy()
    targets = np.argwhere(target_mask)
    seeds = np.argwhere(seed_mask)
    if not len(targets):
        return result
    if not len(seeds):
        raise RuntimeError("no source pixels available for deterministic occlusion fill")

    for start in range(0, len(targets), 128):
        target_chunk = targets[start : start + 128]
        delta = target_chunk[:, np.newaxis, :] - seeds[np.newaxis, :, :]
        distance = np.sum(delta * delta, axis=2, dtype=np.int32)
        nearest = seeds[np.argmin(distance, axis=1)]
        for (target_y, target_x), (seed_y, seed_x) in zip(target_chunk, nearest):
            result[target_y, target_x] = image[seed_y, seed_x]
    return result


def shear_from_pivot(layer: np.ndarray, bottom_dx: int) -> np.ndarray:
    output = np.zeros_like(layer)
    for y in range(CELL):
        if y <= SHIELD_PIVOT_Y:
            dx = 0
        else:
            ratio = min(
                1.0,
                (y - SHIELD_PIVOT_Y) / (SHIELD_BOTTOM_Y - SHIELD_PIVOT_Y),
            )
            dx = round(bottom_dx * ratio)
        if dx >= 0:
            output[y, dx:] = layer[y, : CELL - dx]
        else:
            output[y, : CELL + dx] = layer[y, -dx:]
    return output


def translate_layer(layer: np.ndarray, dx: int, dy: int = 0) -> np.ndarray:
    output = np.zeros_like(layer)
    src_x0 = max(0, -dx)
    src_y0 = max(0, -dy)
    src_x1 = min(CELL, CELL - dx)
    src_y1 = min(CELL, CELL - dy)
    dst_x0 = src_x0 + dx
    dst_y0 = src_y0 + dy
    dst_x1 = src_x1 + dx
    dst_y1 = src_y1 + dy
    if src_x0 < src_x1 and src_y0 < src_y1:
        output[dst_y0:dst_y1, dst_x0:dst_x1] = layer[
            src_y0:src_y1, src_x0:src_x1
        ]
    return output


def binary_over(base: np.ndarray, overlay: np.ndarray) -> np.ndarray:
    result = base.copy()
    visible = overlay[..., 3] == 255
    result[visible] = overlay[visible]
    return result


def piston_layer(shield_bottom_dx: int) -> np.ndarray:
    layer = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    body_anchor = (90, 92)
    attach_ratio = (112 - SHIELD_PIVOT_Y) / (
        SHIELD_BOTTOM_Y - SHIELD_PIVOT_Y
    )
    attach_dx = round(shield_bottom_dx * attach_ratio)
    shield_anchor = (108 + attach_dx, 112)

    draw.line((body_anchor, shield_anchor), fill=OUTLINE, width=7)
    draw.line((body_anchor, shield_anchor), fill=DARK_JOINT, width=5)
    draw.line((body_anchor, shield_anchor), fill=MID_JOINT, width=2)
    draw.rectangle(
        (
            body_anchor[0] - 3,
            body_anchor[1] - 3,
            body_anchor[0] + 3,
            body_anchor[1] + 3,
        ),
        fill=OUTLINE,
    )
    draw.rectangle(
        (
            body_anchor[0] - 1,
            body_anchor[1] - 1,
            body_anchor[0] + 1,
            body_anchor[1] + 1,
        ),
        fill=LIGHT_JOINT,
    )
    draw.rectangle(
        (
            shield_anchor[0] - 2,
            shield_anchor[1] - 2,
            shield_anchor[0] + 2,
            shield_anchor[1] + 2,
        ),
        fill=OUTLINE,
    )
    draw.point(shield_anchor, fill=LIGHT_JOINT)
    return np.asarray(layer, dtype=np.uint8)


def build_layers(source: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    opaque = source[..., 3] == 255
    drill_mask = polygon_mask(DRILL_POLYGON) & opaque
    shield_mask = polygon_mask(SHIELD_POLYGON) & opaque & ~drill_mask

    shield = extract_layer(source, shield_mask)
    drill = extract_layer(source, drill_mask)

    fixed = source.copy()
    removed_mask = shield_mask | drill_mask
    fixed[removed_mask] = 0

    behind = polygon_mask(BEHIND_SHIELD_POLYGON)
    always_covered = np.ones((CELL, CELL), dtype=bool)
    for shield_dx, extension_dx in zip(SHIELD_BOTTOM_DX, DRILL_EXTENSION_DX):
        moved_shield = shear_from_pivot(shield, shield_dx)
        attach_ratio = (118 - SHIELD_PIVOT_Y) / (
            SHIELD_BOTTOM_Y - SHIELD_PIVOT_Y
        )
        attach_dx = round(shield_dx * attach_ratio)
        moved_drill = translate_layer(drill, attach_dx + extension_dx)
        frame_coverage = (moved_shield[..., 3] == 255) | (
            moved_drill[..., 3] == 255
        )
        always_covered &= frame_coverage

    # Only repair pixels that can actually become visible in at least one frame.
    # The large shield footprint that remains covered throughout stays transparent.
    fill_target = behind & removed_mask & ~always_covered
    yy, xx = np.indices((CELL, CELL))
    seed_window = (
        (fixed[..., 3] == 255)
        & (xx >= 80)
        & (xx <= 142)
        & (yy >= 55)
        & (yy <= 181)
    )
    fixed = nearest_source_fill(fixed, fill_target, seed_window)
    return fixed, shield, drill


def build_frames(
    fixed: np.ndarray, shield: np.ndarray, drill: np.ndarray
) -> tuple[list[np.ndarray], list[np.ndarray]]:
    frames: list[np.ndarray] = []
    moving_layers: list[np.ndarray] = []
    for shield_dx, extension_dx in zip(SHIELD_BOTTOM_DX, DRILL_EXTENSION_DX):
        moved_shield = shear_from_pivot(shield, shield_dx)
        attach_ratio = (118 - SHIELD_PIVOT_Y) / (
            SHIELD_BOTTOM_Y - SHIELD_PIVOT_Y
        )
        attach_dx = round(shield_dx * attach_ratio)
        moved_drill = translate_layer(drill, attach_dx + extension_dx)
        piston = piston_layer(shield_dx)

        moving = binary_over(piston, moved_shield)
        moving = binary_over(moving, moved_drill)
        frame = binary_over(fixed, piston)
        frame = binary_over(frame, moved_shield)
        frame = binary_over(frame, moved_drill)
        frames.append(frame)
        moving_layers.append(moving)
    return frames, moving_layers


def expand_mask(mask: np.ndarray, radius: int = 1) -> np.ndarray:
    image = Image.fromarray((mask.astype(np.uint8) * 255), "L")
    expanded = image.filter(ImageFilter.MaxFilter(radius * 2 + 1))
    return np.asarray(expanded) > 0


def shifted_rgba(image: np.ndarray, dx: int, dy: int) -> np.ndarray:
    return translate_layer(image, dx, dy)


def residual_shift(
    reference: np.ndarray, candidate: np.ndarray, roi: np.ndarray
) -> tuple[int, int]:
    best = (0, 0)
    best_error: int | None = None
    shifts = sorted(
        ((dx, dy) for dy in range(-4, 5) for dx in range(-4, 5)),
        key=lambda item: (abs(item[0]) + abs(item[1]), abs(item[1]), abs(item[0])),
    )
    for dx, dy in shifts:
        shifted = shifted_rgba(candidate, dx, dy)
        error = int(np.count_nonzero(np.any(reference[roi] != shifted[roi], axis=1)))
        if best_error is None or error < best_error:
            best_error = error
            best = (dx, dy)
    return best


def rgba_palette(source: np.ndarray) -> set[tuple[int, int, int, int]]:
    return {tuple(map(int, colour)) for colour in np.unique(source.reshape(-1, 4), axis=0)}


def checkerboard(width: int, height: int, cell: int = 12) -> np.ndarray:
    yy, xx = np.indices((height, width))
    tile = ((xx // cell) + (yy // cell)) % 2
    output = np.empty((height, width, 4), dtype=np.uint8)
    output[tile == 0] = (24, 31, 43, 255)
    output[tile == 1] = (40, 50, 66, 255)
    return output


def composite_preview(background: np.ndarray, sprite: np.ndarray) -> np.ndarray:
    result = background.copy()
    visible = sprite[..., 3] == 255
    result[visible] = sprite[visible]
    return result


def save_previews(frames: list[np.ndarray]) -> None:
    grid = checkerboard(CELL * 3, CELL * 2)
    for index, frame in enumerate(frames):
        row, column = divmod(index, 3)
        y0 = row * CELL
        x0 = column * CELL
        grid[y0 : y0 + CELL, x0 : x0 + CELL] = composite_preview(
            grid[y0 : y0 + CELL, x0 : x0 + CELL], frame
        )
    Image.fromarray(grid, "RGBA").save(PREVIEW_PATH)

    small_frames = [
        np.asarray(
            Image.fromarray(frame, "RGBA").resize(
                (80, 80), Image.Resampling.NEAREST
            )
        )
        for frame in frames
    ]
    small = np.full((80, 80 * FRAME_COUNT, 4), (7, 11, 18, 255), dtype=np.uint8)
    for index, frame in enumerate(small_frames):
        visible = frame[..., 3] == 255
        region = small[:, index * 80 : (index + 1) * 80]
        region[visible] = frame[visible]
    Image.fromarray(small, "RGBA").save(PREVIEW_80_PATH)


def save_mask_preview(
    source: np.ndarray, fixed: np.ndarray, shield: np.ndarray, drill: np.ndarray
) -> None:
    piston = piston_layer(0)
    preview = source.copy()
    preview[..., :3] = (preview[..., :3].astype(np.uint16) // 3).astype(np.uint8)
    preview[..., 3] = np.where(source[..., 3] == 255, 255, 0).astype(np.uint8)

    shield_visible = shield[..., 3] == 255
    drill_visible = drill[..., 3] == 255
    piston_visible = piston[..., 3] == 255
    fixed_visible = fixed[..., 3] == 255
    preview[fixed_visible, :3] = np.maximum(
        preview[fixed_visible, :3], np.array((24, 48, 80), dtype=np.uint8)
    )
    preview[shield_visible, :3] = (220, 62, 72)
    preview[piston_visible, :3] = (52, 210, 205)
    preview[drill_visible, :3] = (255, 185, 45)
    Image.fromarray(preview, "RGBA").save(LAYERS_DIR / "part_masks_preview.png")


def audit(
    source: np.ndarray,
    fixed: np.ndarray,
    frames: list[np.ndarray],
    moving_layers: list[np.ndarray],
) -> dict[str, object]:
    strip = np.concatenate(frames, axis=1)
    moving_union = np.zeros((CELL, CELL), dtype=bool)
    for layer in moving_layers:
        moving_union |= layer[..., 3] == 255
    moving_union = expand_mask(moving_union, 1)

    yy, xx = np.indices((CELL, CELL))
    semantic_fixed = (
        ((xx < 104) & (yy >= 32) & (yy < 148))
        | ((xx < 112) & (yy >= 118) & (yy < 188))
    )
    fixed_roi = (fixed[..., 3] == 255) & semantic_fixed & ~moving_union
    torso_roi = fixed_roi & (yy < 148)
    feet_roi = fixed_roi & (yy >= 145)
    if not np.any(torso_roi) or not np.any(feet_roi):
        raise RuntimeError("stable-body audit ROIs are empty")

    fixed_differences: list[int] = []
    torso_residuals: list[tuple[int, int]] = []
    feet_residuals: list[tuple[int, int]] = []
    bboxes: list[tuple[int, int, int, int]] = []
    bottom_anchors: list[int] = []
    edge_touches: list[bool] = []
    moving_pixels: list[int] = []
    reference = frames[0]

    for frame in frames:
        fixed_differences.append(
            int(np.count_nonzero(np.any(frame[fixed_roi] != reference[fixed_roi], axis=1)))
        )
        torso_residuals.append(residual_shift(reference, frame, torso_roi))
        feet_residuals.append(residual_shift(reference, frame, feet_roi))
        bbox = alpha_bbox(frame)
        bboxes.append(bbox)
        bottom_anchors.append(bbox[3] - 1)
        edge_touches.append(
            bbox[0] <= 0 or bbox[1] <= 0 or bbox[2] >= CELL or bbox[3] >= CELL
        )
        moving_pixels.append(
            int(np.count_nonzero(np.any(frame != reference, axis=2)))
        )

    colours = rgba_palette(strip)
    source_colours = rgba_palette(source)
    alpha_values = sorted({colour[3] for colour in colours})
    unexpected_colours = sorted(colours - source_colours)

    checks = {
        "strip_size": list((strip.shape[1], strip.shape[0])),
        "frame_count": len(frames),
        "cell_size": [CELL, CELL],
        "rgba_colour_count": len(colours),
        "alpha_values": alpha_values,
        "no_unexpected_colours": not unexpected_colours,
        "unexpected_colours": [list(colour) for colour in unexpected_colours],
        "bboxes": [list(bbox) for bbox in bboxes],
        "edge_touches": edge_touches,
        "bottom_anchors": bottom_anchors,
        "fixed_roi_pixel_count": int(np.count_nonzero(fixed_roi)),
        "fixed_roi_changed_pixels": fixed_differences,
        "torso_residual_dx_dy": [list(shift) for shift in torso_residuals],
        "feet_residual_dx_dy": [list(shift) for shift in feet_residuals],
        "moving_pixels_vs_frame_1": moving_pixels,
        "shield_bottom_dx": list(SHIELD_BOTTOM_DX),
        "drill_extension_dx": list(DRILL_EXTENSION_DX),
    }

    failures: list[str] = []
    if checks["strip_size"] != [1152, 192]:
        failures.append("strip dimensions")
    if len(frames) != FRAME_COUNT:
        failures.append("frame count")
    if len(colours) > 16:
        failures.append("palette size")
    if alpha_values != [0, 255]:
        failures.append("binary alpha")
    if unexpected_colours:
        failures.append("source palette")
    if any(edge_touches):
        failures.append("canvas edge")
    if len(set(bottom_anchors)) != 1:
        failures.append("bottom anchor")
    if any(fixed_differences):
        failures.append("fixed ROI identity")
    if any(shift != (0, 0) for shift in torso_residuals):
        failures.append("torso residual")
    if any(shift != (0, 0) for shift in feet_residuals):
        failures.append("feet residual")
    if not any(value > 0 for value in moving_pixels[1:]):
        failures.append("visible animation")

    checks["passed"] = not failures
    checks["failures"] = failures
    return checks


def main() -> None:
    LAYERS_DIR.mkdir(parents=True, exist_ok=True)
    source = np.asarray(Image.open(SOURCE).convert("RGBA"), dtype=np.uint8)
    if source.shape != (CELL, CELL, 4):
        raise RuntimeError(f"expected 192x192 RGBA source, got {source.shape}")
    if set(np.unique(source[..., 3]).tolist()) != {0, 255}:
        raise RuntimeError("source alpha is not binary")

    fixed, shield, drill = build_layers(source)
    frames, moving_layers = build_frames(fixed, shield, drill)
    strip = np.concatenate(frames, axis=1)
    Image.fromarray(strip, "RGBA").save(STRIP_PATH, format="PNG", optimize=False)

    Image.fromarray(fixed, "RGBA").save(LAYERS_DIR / "fixed_body.png")
    Image.fromarray(shield, "RGBA").save(LAYERS_DIR / "shield.png")
    Image.fromarray(piston_layer(0), "RGBA").save(
        LAYERS_DIR / "piston_neutral.png"
    )
    Image.fromarray(drill, "RGBA").save(LAYERS_DIR / "drill.png")
    save_mask_preview(source, fixed, shield, drill)
    save_previews(frames)

    report = audit(source, fixed, frames, moving_layers)
    report["source"] = str(SOURCE)
    report["source_sha256"] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    AUDIT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    if not report["passed"]:
        raise RuntimeError(f"audit failed: {report['failures']}")

    print("| frame | fixed ROI diff | torso residual | feet residual | shield bottom dx | drill extension dx |")
    print("|---:|---:|---:|---:|---:|---:|")
    for index in range(FRAME_COUNT):
        torso = report["torso_residual_dx_dy"][index]
        feet = report["feet_residual_dx_dy"][index]
        print(
            f"| {index + 1} | {report['fixed_roi_changed_pixels'][index]} | "
            f"({torso[0]},{torso[1]}) | ({feet[0]},{feet[1]}) | "
            f"{SHIELD_BOTTOM_DX[index]}px | {DRILL_EXTENSION_DX[index]}px |"
        )


if __name__ == "__main__":
    main()
