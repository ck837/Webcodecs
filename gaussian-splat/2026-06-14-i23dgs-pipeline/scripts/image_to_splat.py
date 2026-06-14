"""Build a local image-conditioned .splat baseline from a transparent PNG.

This is not a neural single-image 3DGS reconstruction. It is a deterministic
2.5D Gaussian baseline used when no industrial 3D provider is configured:
RGBA pixels become colored splats, alpha controls visibility, and a shallow
depth prior gives the object thickness for orbit previews.
"""

from __future__ import annotations

import argparse
import math
import random
import struct
from pathlib import Path

from PIL import Image, ImageFilter


ROW_SIZE = 32


def clamp_byte(value: float) -> int:
    return max(0, min(255, int(round(value))))


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("input image has no visible alpha pixels")
    return bbox


def load_normalized_rgba(input_path: Path, max_side: int) -> Image.Image:
    image = Image.open(input_path).convert("RGBA")
    image = image.crop(alpha_bbox(image))
    scale = min(1.0, max_side / max(image.size))
    if scale < 1.0:
        next_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        image = image.resize(next_size, Image.Resampling.LANCZOS)
    return image


def splat_rows(image: Image.Image, max_splats: int, seed: int) -> list[bytes]:
    rng = random.Random(seed)
    width, height = image.size
    rgba = image.load()
    alpha_blur = image.getchannel("A").filter(ImageFilter.GaussianBlur(radius=2.0)).load()
    visible: list[tuple[int, int]] = []

    for y in range(height):
      for x in range(width):
        if rgba[x, y][3] > 24:
          visible.append((x, y))

    if not visible:
        raise ValueError("input image has no visible pixels after alpha threshold")

    stride = max(1, math.ceil(math.sqrt(len(visible) / max_splats)))
    candidates = [(x, y) for x, y in visible if x % stride == 0 and y % stride == 0]
    if len(candidates) > max_splats:
        candidates = rng.sample(candidates, max_splats)

    rows: list[bytes] = []
    object_scale = max(width, height)
    thickness = 0.24

    for x, y in candidates:
        r, g, b, a = rgba[x, y]
        nx = (x - width * 0.5) / object_scale * 2.0
        ny = -(y - height * 0.5) / object_scale * 2.0
        radial = min(1.0, math.sqrt((nx * 0.9) ** 2 + (ny * 1.08) ** 2))
        luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0

        # A shallow convex depth prior: center pixels sit forward, silhouette
        # pixels recede. Luminance adds tiny surface variation, not geometry truth.
        base_depth = thickness * math.sqrt(max(0.0, 1.0 - radial * radial))
        z = base_depth * 0.5 + (luminance - 0.5) * 0.035 + rng.gauss(0, 0.006)

        alpha_soft = alpha_blur[x, y] / 255.0
        point_alpha = max(70, min(235, a * (0.45 + alpha_soft * 0.55)))
        base_size = 1.45 / object_scale * stride
        sx = base_size * rng.uniform(0.75, 1.25)
        sy = base_size * rng.uniform(0.75, 1.25)
        sz = base_size * rng.uniform(0.7, 1.15)

        rows.append(pack_row(nx, ny, z, sx, sy, sz, r, g, b, point_alpha))

        # Sparse back layer gives side views a bit of volume instead of a pure card.
        if rng.random() < 0.42 and a > 100:
            rows.append(
                pack_row(
                    nx * 0.96 + rng.gauss(0, base_size * 0.4),
                    ny * 0.96 + rng.gauss(0, base_size * 0.4),
                    z - thickness * rng.uniform(0.32, 0.68),
                    sx * 1.12,
                    sy * 1.12,
                    sz * 1.35,
                    r * 0.78,
                    g * 0.78,
                    b * 0.78,
                    point_alpha * 0.58,
                )
            )

    return rows


def pack_row(
    x: float,
    y: float,
    z: float,
    sx: float,
    sy: float,
    sz: float,
    r: float,
    g: float,
    b: float,
    a: float,
) -> bytes:
    return struct.pack(
        "<ffffffBBBBBBBB",
        x,
        y,
        z,
        sx,
        sy,
        sz,
        clamp_byte(r),
        clamp_byte(g),
        clamp_byte(b),
        clamp_byte(a),
        255,
        128,
        128,
        128,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_png", type=Path)
    parser.add_argument("output_splat", type=Path)
    parser.add_argument("--max-side", type=int, default=520)
    parser.add_argument("--max-splats", type=int, default=36000)
    parser.add_argument("--seed", type=int, default=23)
    args = parser.parse_args()

    image = load_normalized_rgba(args.input_png, args.max_side)
    rows = splat_rows(image, args.max_splats, args.seed)
    args.output_splat.parent.mkdir(parents=True, exist_ok=True)
    args.output_splat.write_bytes(b"".join(rows))
    print(f"{len(rows)} splats -> {args.output_splat}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
