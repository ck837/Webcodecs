"""Resize demo images before matting to keep local CPU runs predictable."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: prepare_sample_image.py <input> <output> <max-side>", file=sys.stderr)
        return 2

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    max_side = int(sys.argv[3])
    image = Image.open(input_path).convert("RGBA")
    scale = min(1.0, max_side / max(image.size))
    if scale < 1.0:
        image = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)
    print(f"{image.width}x{image.height} -> {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
