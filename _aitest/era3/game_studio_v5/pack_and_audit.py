from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent
FRAMES_DIR = ROOT / "frames"
STRIP_PATH = ROOT / "mech_v5_game_studio_idle.png"
REPORT_PATH = ROOT / "audit.json"
ALPHA_THRESHOLD = 8


def frame_metrics(array: np.ndarray) -> dict[str, object]:
    alpha = array[:, :, 3]
    mask = alpha > ALPHA_THRESHOLD
    ys, xs = np.nonzero(mask)
    weights = alpha[mask].astype(np.float64)
    return {
        "bbox": [
            int(xs.min()),
            int(ys.min()),
            int(xs.max()) + 1,
            int(ys.max()) + 1,
        ],
        "bbox_center": [
            round(float((xs.min() + xs.max() + 1) / 2), 3),
            round(float((ys.min() + ys.max() + 1) / 2), 3),
        ],
        "alpha_centroid": [
            round(float(np.average(xs, weights=weights)), 3),
            round(float(np.average(ys, weights=weights)), 3),
        ],
        "opaque_pixels": int(mask.sum()),
    }


def pair_metrics(first: np.ndarray, second: np.ndarray) -> dict[str, float]:
    first_mask = first[:, :, 3] > ALPHA_THRESHOLD
    second_mask = second[:, :, 3] > ALPHA_THRESHOLD
    union = first_mask | second_mask
    intersection = first_mask & second_mask
    changed = np.any(first != second, axis=2) & union

    body_union = union[:, :112]
    body_changed = changed[:, :112]
    return {
        "silhouette_iou": round(
            float(intersection.sum() / max(1, union.sum())), 4
        ),
        "changed_union_ratio": round(
            float(changed.sum() / max(1, union.sum())), 4
        ),
        "body_changed_ratio": round(
            float(body_changed.sum() / max(1, body_union.sum())), 4
        ),
    }


def main() -> None:
    frame_paths = sorted(FRAMES_DIR.glob("*.png"))
    if len(frame_paths) != 6:
        raise SystemExit(f"Expected 6 frames, found {len(frame_paths)}")

    images = [Image.open(path).convert("RGBA") for path in frame_paths]
    if len({image.size for image in images}) != 1:
        raise SystemExit("All normalized frames must have the same dimensions")

    width, height = images[0].size
    strip = Image.new("RGBA", (width * len(images), height), (0, 0, 0, 0))
    for index, image in enumerate(images):
        strip.alpha_composite(image, (index * width, 0))
    strip.save(STRIP_PATH)

    arrays = [np.asarray(image) for image in images]
    report = {
        "frame_size": [width, height],
        "frame_count": len(images),
        "frames": [
            {"frame": index + 1, **frame_metrics(array)}
            for index, array in enumerate(arrays)
        ],
        "consecutive_pairs": [
            {
                "from": index + 1,
                "to": index + 2,
                **pair_metrics(arrays[index], arrays[index + 1]),
            }
            for index in range(len(arrays) - 1)
        ],
        "loop_pair": {
            "from": 6,
            "to": 1,
            **pair_metrics(arrays[-1], arrays[0]),
        },
        "generated_identity_vs_locked_seed": [
            {
                "frame": index + 1,
                **pair_metrics(arrays[0], arrays[index]),
            }
            for index in range(1, len(arrays))
        ],
    }
    REPORT_PATH.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
