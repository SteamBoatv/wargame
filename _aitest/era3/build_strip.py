from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent
DESIGNS = (4, 5)
GRID_COLUMNS = 3
GRID_ROWS = 2
FRAME_MARGIN = 4
MAX_OPAQUE_COLOURS = 15  # plus one fully transparent RGBA value
CHROMA_KEY = np.array([255, 0, 255], dtype=np.int32)
CHROMA_ALPHA_CUTOFF = 96.0
V5_CANONICAL_FRAME = 2  # zero-based: frame 3 from the raw grid


def source_palette(source_path: Path) -> np.ndarray:
    source = np.asarray(Image.open(source_path).convert("RGBA"))
    opaque_rgb = source[..., :3][source[..., 3] >= 128]
    if opaque_rgb.size == 0:
        raise ValueError(f"{source_path.name} has no opaque source pixels")

    colours, counts = np.unique(opaque_rgb, axis=0, return_counts=True)
    if len(colours) > MAX_OPAQUE_COLOURS:
        order = np.argsort(counts)[::-1][:MAX_OPAQUE_COLOURS]
        colours = colours[order]
    return colours.astype(np.int16)


def load_alpha_grid(raw_path: Path, alpha_work_path: Path) -> np.ndarray:
    """Load the helper-produced alpha grid, falling back to raw magenta keying."""
    selected = alpha_work_path if alpha_work_path.exists() else raw_path
    grid = np.asarray(Image.open(selected).convert("RGBA")).copy()

    if np.any(grid[..., 3] < 255):
        alpha = np.where(grid[..., 3] >= 128, 255, 0).astype(np.uint8)
    else:
        rgb = grid[..., :3].astype(np.int32)
        difference = rgb - CHROMA_KEY
        distance = np.sqrt(np.sum(difference * difference, axis=2, dtype=np.int64))
        alpha = np.where(distance >= CHROMA_ALPHA_CUTOFF, 255, 0).astype(np.uint8)

    grid[..., 3] = alpha
    grid[..., :3][alpha == 0] = 0
    return grid


def slice_grid(grid: np.ndarray) -> list[np.ndarray]:
    height, width = grid.shape[:2]
    if width % GRID_COLUMNS or height % GRID_ROWS:
        raise ValueError(f"grid dimensions {width}x{height} are not divisible by 3x2")

    cell_width = width // GRID_COLUMNS
    cell_height = height // GRID_ROWS
    if cell_width != cell_height:
        raise ValueError(
            f"grid cells must be square, got {cell_width}x{cell_height}"
        )

    frames: list[np.ndarray] = []
    for row in range(GRID_ROWS):
        for column in range(GRID_COLUMNS):
            y0 = row * cell_height
            x0 = column * cell_width
            frames.append(
                grid[y0 : y0 + cell_height, x0 : x0 + cell_width].copy()
            )
    return frames


def alpha_bbox(frame: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(frame[..., 3] == 255)
    if len(xs) == 0:
        raise ValueError("animation frame has no opaque pixels")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def paste_clipped(canvas: np.ndarray, sprite: np.ndarray, x: int, y: int) -> None:
    canvas_height, canvas_width = canvas.shape[:2]
    sprite_height, sprite_width = sprite.shape[:2]

    dst_x0 = max(0, x)
    dst_y0 = max(0, y)
    dst_x1 = min(canvas_width, x + sprite_width)
    dst_y1 = min(canvas_height, y + sprite_height)
    if dst_x0 >= dst_x1 or dst_y0 >= dst_y1:
        raise ValueError("registered sprite lies completely outside its frame")

    src_x0 = dst_x0 - x
    src_y0 = dst_y0 - y
    src_x1 = src_x0 + (dst_x1 - dst_x0)
    src_y1 = src_y0 + (dst_y1 - dst_y0)
    source_region = sprite[src_y0:src_y1, src_x0:src_x1]
    visible = source_region[..., 3] == 255
    destination = canvas[dst_y0:dst_y1, dst_x0:dst_x1]
    destination[visible] = source_region[visible]


def map_to_palette(frame: np.ndarray, palette: np.ndarray) -> np.ndarray:
    result = np.zeros_like(frame)
    visible = frame[..., 3] == 255
    pixels = frame[..., :3][visible].astype(np.int32)
    if pixels.size:
        palette_32 = palette.astype(np.int32)
        difference = pixels[:, np.newaxis, :] - palette_32[np.newaxis, :, :]
        distances = np.sum(difference * difference, axis=2, dtype=np.int64)
        result[..., :3][visible] = palette[np.argmin(distances, axis=1)].astype(
            np.uint8
        )
        result[..., 3][visible] = 255
    return result


def register_frames(
    frames: list[np.ndarray], output_cell: int, palette: np.ndarray
) -> list[np.ndarray]:
    bboxes = [alpha_bbox(frame) for frame in frames]
    target_com_x = (output_cell - 1) / 2
    target_bottom_y = output_cell - FRAME_MARGIN - 1
    available_left = target_com_x - FRAME_MARGIN
    available_right = output_cell - 1 - FRAME_MARGIN - target_com_x
    available_above = target_bottom_y - FRAME_MARGIN

    maximum_left_extent = 0.0
    maximum_right_extent = 0.0
    maximum_above_extent = 0.0
    for frame, (x0, y0, x1, y1) in zip(frames, bboxes):
        mask = frame[y0:y1, x0:x1, 3] == 255
        ys, xs = np.nonzero(mask)
        com_x = float(xs.mean())
        maximum_left_extent = max(maximum_left_extent, com_x)
        maximum_right_extent = max(
            maximum_right_extent, float((x1 - x0 - 1) - com_x)
        )
        maximum_above_extent = max(
            maximum_above_extent, float(ys.max() - ys.min())
        )

    shared_scale = min(
        available_left / maximum_left_extent,
        available_right / maximum_right_extent,
        available_above / maximum_above_extent,
    )
    registered: list[np.ndarray] = []

    for frame, (x0, y0, x1, y1) in zip(frames, bboxes):
        cropped = frame[y0:y1, x0:x1]
        new_width = max(1, round(cropped.shape[1] * shared_scale))
        new_height = max(1, round(cropped.shape[0] * shared_scale))
        resized = np.asarray(
            Image.fromarray(cropped, "RGBA").resize(
                (new_width, new_height), Image.Resampling.NEAREST
            )
        ).copy()
        resized[..., 3] = np.where(resized[..., 3] >= 128, 255, 0).astype(
            np.uint8
        )
        resized[..., :3][resized[..., 3] == 0] = 0

        ys, xs = np.nonzero(resized[..., 3] == 255)
        local_com_x = float(xs.mean())
        local_bottom_y = int(ys.max())
        offset_x = round(target_com_x - local_com_x)
        offset_y = target_bottom_y - local_bottom_y

        canvas = np.zeros((output_cell, output_cell, 4), dtype=np.uint8)
        paste_clipped(canvas, resized, offset_x, offset_y)
        registered.append(map_to_palette(canvas, palette))

    return registered


def freeze_v5_body(
    registered_frames: list[np.ndarray], palette: np.ndarray
) -> list[np.ndarray]:
    """Reuse frame 3's complete body; animate only existing warm light pixels."""
    canonical = registered_frames[V5_CANONICAL_FRAME].copy()
    palette_rgb = palette.astype(np.uint8)
    warm = palette_rgb[
        (palette_rgb[:, 0] > palette_rgb[:, 1] + 30)
        & (palette_rgb[:, 0] > palette_rgb[:, 2] + 50)
    ]
    if len(warm) < 2:
        raise RuntimeError("mech_v5 source palette lacks warm pulse colours")
    warm = warm[np.argsort(np.sum(warm.astype(np.int32), axis=1))]

    colour_rank = {tuple(map(int, colour)): index for index, colour in enumerate(warm)}
    canonical_rgb = canonical[..., :3]
    pulse_mask = np.zeros(canonical.shape[:2], dtype=bool)
    rank_map = np.zeros(canonical.shape[:2], dtype=np.int16)
    for colour, rank in colour_rank.items():
        match = np.all(canonical_rgb == np.array(colour, dtype=np.uint8), axis=2)
        pulse_mask |= match
        rank_map[match] = rank

    # Neutral, dim, neutral, bright, bright, neutral.
    pulse_offsets = (0, -1, 0, 1, 1, 0)
    repaired: list[np.ndarray] = []
    for offset in pulse_offsets:
        frame = canonical.copy()
        shifted_rank = np.clip(rank_map + offset, 0, len(warm) - 1)
        frame[..., :3][pulse_mask] = warm[shifted_rank[pulse_mask]]
        repaired.append(frame)
    return repaired


def shift_mask(mask: np.ndarray, dx: int, dy: int) -> np.ndarray:
    shifted = np.zeros_like(mask)
    height, width = mask.shape
    src_x0 = max(0, -dx)
    src_y0 = max(0, -dy)
    src_x1 = min(width, width - dx)
    src_y1 = min(height, height - dy)
    dst_x0 = src_x0 + dx
    dst_y0 = src_y0 + dy
    dst_x1 = src_x1 + dx
    dst_y1 = src_y1 + dy
    if src_x0 < src_x1 and src_y0 < src_y1:
        shifted[dst_y0:dst_y1, dst_x0:dst_x1] = mask[
            src_y0:src_y1, src_x0:src_x1
        ]
    return shifted


def stable_body_residuals(
    frames: list[np.ndarray], reference_index: int = V5_CANONICAL_FRAME
) -> list[tuple[int, int]]:
    """Audit torso/legs by translation search against the canonical stable body."""
    cell = frames[0].shape[0]
    roi = np.zeros((cell, cell), dtype=bool)
    roi[round(cell * 0.18) : cell - FRAME_MARGIN, round(cell * 0.08) : round(cell * 0.72)] = True
    masks = [(frame[..., 3] == 255) & roi for frame in frames]
    reference = masks[reference_index]

    residuals: list[tuple[int, int]] = []
    search_order = sorted(
        ((dx, dy) for dy in range(-12, 13) for dx in range(-12, 13)),
        key=lambda shift: (
            abs(shift[0]) + abs(shift[1]),
            abs(shift[1]),
            abs(shift[0]),
        ),
    )
    for mask in masks:
        best_shift = (0, 0)
        best_error: int | None = None
        for dx, dy in search_order:
            shifted = shift_mask(mask, dx, dy)
            error = int(np.count_nonzero(np.logical_xor(reference, shifted)))
            if best_error is None or error < best_error:
                best_error = error
                best_shift = (dx, dy)
        residuals.append(best_shift)
    return residuals


def strip_statistics(
    frames: list[np.ndarray], strip: np.ndarray
) -> tuple[int, int, float, float]:
    com_x_values: list[float] = []
    bottom_values: list[int] = []
    for frame in frames:
        x0, y0, x1, y1 = alpha_bbox(frame)
        del x0, y0, x1
        ys, xs = np.nonzero(frame[..., 3] == 255)
        com_x_values.append(float(xs.mean()))
        bottom_values.append(y1 - 1)

    target_com = float(np.median(com_x_values))
    target_bottom = float(np.median(bottom_values))
    drift = [
        max(abs(com_x - target_com), abs(bottom - target_bottom))
        for com_x, bottom in zip(com_x_values, bottom_values)
    ]
    colour_count = len(np.unique(strip.reshape(-1, 4), axis=0))
    return len(frames), colour_count, min(drift), max(drift)


def build_design(
    design: int,
) -> tuple[int, int, int, float, float, list[tuple[int, int]]]:
    raw_grid_path = ROOT / f"mech_v{design}_grid.png"
    alpha_work_path = ROOT / f"mech_v{design}_grid.alpha_work.png"
    source_path = ROOT / f"mech_v{design}.png"
    output_path = ROOT / f"mech_v{design}_idle.png"

    source = Image.open(source_path)
    if source.width != source.height:
        raise ValueError(f"{source_path.name} must be square")
    output_cell = source.height

    grid = load_alpha_grid(raw_grid_path, alpha_work_path)
    frames = slice_grid(grid)
    palette = source_palette(source_path)
    frames = register_frames(frames, output_cell, palette)
    if design == 5:
        frames = freeze_v5_body(frames, palette)
    for index, frame in enumerate(frames, start=1):
        x0, y0, x1, y1 = alpha_bbox(frame)
        if x0 <= 0 or y0 <= 0 or x1 >= output_cell or y1 > output_cell:
            raise RuntimeError(
                f"mech_v{design} frame {index} touches or exceeds a cell edge"
            )
    strip = np.concatenate(frames, axis=1)

    frame_count, colour_count, minimum_drift, maximum_drift = strip_statistics(
        frames, strip
    )
    if maximum_drift > 2:
        raise RuntimeError(
            f"mech_v{design} registration drift {maximum_drift:.2f}px exceeds 2px"
        )
    if colour_count > 16:
        raise RuntimeError(
            f"mech_v{design} uses {colour_count} RGBA colours; expected at most 16"
        )
    alpha_values = set(np.unique(strip[..., 3]).tolist())
    if not alpha_values.issubset({0, 255}):
        raise RuntimeError(f"mech_v{design} contains non-binary alpha")

    residuals = stable_body_residuals(frames)
    if any(abs(dx) > 2 or abs(dy) > 2 for dx, dy in residuals):
        raise RuntimeError(
            f"mech_v{design} stable-body residual exceeds 2px: {residuals}"
        )

    Image.fromarray(strip, "RGBA").save(output_path, format="PNG", optimize=False)
    return (
        frame_count,
        output_cell,
        colour_count,
        minimum_drift,
        maximum_drift,
        residuals,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--design",
        choices=("4", "5", "all"),
        default="all",
        help="build only one design, or both (default)",
    )
    args = parser.parse_args()
    designs = DESIGNS if args.design == "all" else (int(args.design),)
    results = {design: build_design(design) for design in designs}

    print(
        "| strip | frames | cell | RGBA colours | bbox/COM anchor drift (min..max) |"
    )
    print("|---|---:|---:|---:|---:|")
    for design, (
        frame_count,
        cell,
        colour_count,
        minimum_drift,
        maximum_drift,
        residuals,
    ) in results.items():
        print(
            f"| mech_v{design}_idle.png | {frame_count} | {cell}x{cell} | "
            f"{colour_count} | {minimum_drift:.2f}..{maximum_drift:.2f}px |"
        )
        if design == 5:
            print()
            print("| frame | stable torso/legs residual dx | residual dy |")
            print("|---:|---:|---:|")
            for frame_index, (dx, dy) in enumerate(residuals, start=1):
                print(f"| {frame_index} | {dx}px | {dy}px |")


if __name__ == "__main__":
    main()
